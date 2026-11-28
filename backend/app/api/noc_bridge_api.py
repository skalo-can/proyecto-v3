import hashlib
import hmac
import json
import os
import platform
import shutil
import socket
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import obtener_usuario_actual
from app.core.database import SessionLocal, get_db
from app.models.estudio import Estudio

router = APIRouter(prefix="/noc", tags=["Central NOC & Soporte"])

# En Docker sobre Windows usa host.docker.internal:8200; en local nativo usa 127.0.0.1:8200
DEFAULT_NOC_URL = "http://127.0.0.1:8200" if os.name == "nt" else "http://host.docker.internal:8200"
CENTRAL_NOC_URL = os.getenv("CENTRAL_NOC_URL", DEFAULT_NOC_URL).rstrip("/")
CENTRAL_HMAC_SECRET = os.getenv(
    "CENTRAL_MASTER_HMAC_SECRET", "MI_PACS_CENTRAL_HMAC_2026_SUPER_SECRETO"
).encode("utf-8")

IDENTITY_FILE = Path(__file__).resolve().parents[2] / "noc_node_identity.json"
_agent_started = False


def obtener_o_crear_identidad() -> dict:
    if IDENTITY_FILE.exists():
        try:
            return json.loads(IDENTITY_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

    identidad = {
        "server_uuid": f"MIPACS-{uuid.uuid4().hex[:12].upper()}",
        "cliente_nombre": os.getenv("MIPACS_CLIENTE_NOMBRE", "Clínica Principal MI_PACS (Nodo Piloto)"),
        "pais": os.getenv("MIPACS_PAIS", "Canada"),
        "ciudad": os.getenv("MIPACS_CIUDAD", "Sault Ste. Marie"),
        "lat": float(os.getenv("MIPACS_LAT", "46.5136")),
        "lng": float(os.getenv("MIPACS_LNG", "-84.3358")),
        "version_mipacs": "v3.1-MPR3D",
    }
    try:
        IDENTITY_FILE.write_text(json.dumps(identidad, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass
    return identidad


def enviar_paquete_firmado(endpoint: str, payload: dict) -> dict:
    raw_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    timestamp = str(int(time.time()))
    mensaje = f"{timestamp}.".encode("utf-8") + raw_body
    firma = hmac.new(CENTRAL_HMAC_SECRET, mensaje, hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        f"{CENTRAL_NOC_URL}{endpoint}",
        data=raw_body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Mipacs-Timestamp": timestamp,
            "X-Mipacs-Signature": firma,
        },
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode("utf-8"))


def verificar_puerto_dicom(db: Session) -> bool:
    puerto = 11112
    try:
        from app.crud.dicom_config_crud import get_config
        cfg = get_config(db)
        if cfg and getattr(cfg, "port", None):
            puerto = int(cfg.port)
    except Exception:
        pass

    try:
        with socket.create_connection(("127.0.0.1", puerto), timeout=1.0):
            return True
    except Exception:
        return False


def recolectar_metricas_locales() -> dict:
    # 1. Espacio libre en NAS externo
    ruta_nas = "D:/MI_PACS_NAS_EXTERNAL" if os.name == "nt" else "/mnt/nas_externo"
    if not os.path.exists(ruta_nas):
        ruta_nas = "D:/" if os.name == "nt" else "/"
    try:
        _, _, free_bytes = shutil.disk_usage(ruta_nas)
        nas_libre_gb = round(free_bytes / (1024 ** 3), 2)
    except Exception:
        nas_libre_gb = 0.0

    # 2. CPU / RAM
    cpu_pct = 10.0
    ram_pct = 35.0
    try:
        import psutil  # type: ignore
        cpu_pct = float(psutil.cpu_percent(interval=0.2))
        ram_pct = float(psutil.virtual_memory().percent)
    except Exception:
        if hasattr(os, "getloadavg"):
            try:
                cpu_pct = round(min(100.0, os.getloadavg()[0] * 15.0), 1)
            except Exception:
                pass

    # 3. Estudios de últimas 24h y estado real del receptor DICOM SCP
    estudios_24h = 0
    dicom_ok = True
    db = SessionLocal()
    try:
        dicom_ok = verificar_puerto_dicom(db)
        hace_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        if hasattr(Estudio, "fecha_creacion"):
            estudios_24h = db.query(Estudio).filter(Estudio.fecha_creacion >= hace_24h).count()
        else:
            estudios_24h = db.query(Estudio).count()
    except Exception:
        pass
    finally:
        db.close()

    return {
        "cpu_pct": cpu_pct,
        "ram_pct": ram_pct,
        "disco_nas_libre_gb": nas_libre_gb,
        "dicom_activo": dicom_ok,
        "estudios_24h": estudios_24h,
        "errores_24h": 0,
    }


def _ciclo_telemetria_background():
    identidad = obtener_o_crear_identidad()
    registrado = False

    while True:
        try:
            if not registrado:
                enviar_paquete_firmado(
                    "/api/v1/nodes/register",
                    {
                        **identidad,
                        "so_info": f"{platform.system()} {platform.release()} ({platform.machine()})",
                    },
                )
                registrado = True

            metricas = recolectar_metricas_locales()
            enviar_paquete_firmado(
                "/api/v1/telemetry/heartbeat",
                {
                    "server_uuid": identidad["server_uuid"],
                    "version_mipacs": identidad["version_mipacs"],
                    **metricas,
                },
            )
        except Exception:
            registrado = False

        time.sleep(30)


def iniciar_agente_noc():
    global _agent_started
    if _agent_started:
        return
    _agent_started = True
    hilo = threading.Thread(
        target=_ciclo_telemetria_background,
        daemon=True,
        name="MIPACS-NOC-Agent",
    )
    hilo.start()


# =========================================================
# ENDPOINT PARA EL BOTÓN DE SOPORTE EN EL FRONTEND MI_PACS
# =========================================================
class SolicitudSoporteIn(BaseModel):
    modulo: str = "VISOR_MPR3D"
    prioridad: str = "ALTA"
    descripcion: str
    diagnostico_cliente: Optional[Dict[str, Any]] = {}


@router.post("/solicitar-soporte")
def solicitar_soporte_remoto(
    payload: SolicitudSoporteIn,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    identidad = obtener_o_crear_identidad()
    metricas = recolectar_metricas_locales()

    if isinstance(usuario, dict):
        nombre_usuario = usuario.get("nombre") or usuario.get("username") or "Usuario Clínico"
        rol_usuario = usuario.get("rol", "medico")
    else:
        nombre_usuario = getattr(usuario, "nombre", None) or getattr(usuario, "username", None) or "Usuario Clínico"
        rol_usuario = getattr(usuario, "rol", "medico")

    snapshot = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "servidor": identidad,
        "salud_actual": metricas,
        "sistema_operativo": platform.platform(),
        "diagnostico_navegador": payload.diagnostico_cliente or {},
    }

    try:
        enviar_paquete_firmado(
            "/api/v1/nodes/register",
            {**identidad, "so_info": platform.platform()},
        )
        respuesta = enviar_paquete_firmado(
            "/api/v1/tickets/incoming",
            {
                "server_uuid": identidad["server_uuid"],
                "usuario_reporta": nombre_usuario,
                "rol_usuario": rol_usuario,
                "modulo": payload.modulo,
                "prioridad": payload.prioridad,
                "descripcion": payload.descripcion,
                "snapshot_logs": snapshot,
            },
        )
        return {
            "status": "ok",
            "codigo_ticket": respuesta.get("codigo_ticket"),
            "mensaje": "Llamada enviada a la Central de Monitoreo MI_PACS.",
        }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo contactar la Central NOC en {CENTRAL_NOC_URL}: {str(e)}",
        )