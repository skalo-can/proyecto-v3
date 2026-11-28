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
            data = json.loads(IDENTITY_FILE.read_text(encoding="utf-8"))
            if data.get("server_uuid"):
                return data
        except Exception:
            pass

    # En instalaciones nuevas deja pais/ciudad/lat/lng en None para que la Central geolocalice por IP automáticamente
    lat_env = os.getenv("MIPACS_LAT")
    lng_env = os.getenv("MIPACS_LNG")
    identidad = {
        "server_uuid": f"MIPACS-{uuid.uuid4().hex[:12].upper()}",
        "cliente_nombre": os.getenv("MIPACS_CLIENTE_NOMBRE", f"Servidor MI_PACS ({socket.gethostname()})"),
        "pais": os.getenv("MIPACS_PAIS") or None,
        "ciudad": os.getenv("MIPACS_CIUDAD") or None,
        "lat": float(lat_env) if lat_env else None,
        "lng": float(lng_env) if lng_env else None,
        "contacto_sitio": os.getenv("MIPACS_CONTACTO", ""),
        "central_noc_url": CENTRAL_NOC_URL,
        "version_mipacs": "v3.1-MPR3D",
    }
    guardar_identidad(identidad)
    return identidad


def guardar_identidad(identidad: dict) -> dict:
    try:
        IDENTITY_FILE.write_text(json.dumps(identidad, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[NOC] No se pudo escribir identidad local: {e}")
    return identidad


def resolver_url_central(identidad: Optional[dict] = None) -> str:
    if identidad and identidad.get("central_noc_url"):
        return str(identidad["central_noc_url"]).rstrip("/")
    return CENTRAL_NOC_URL


def enviar_paquete_firmado(endpoint: str, payload: dict, url_base: Optional[str] = None) -> dict:
    destino = (url_base or resolver_url_central()).rstrip("/")
    raw_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    timestamp = str(int(time.time()))
    mensaje = f"{timestamp}.".encode("utf-8") + raw_body
    firma = hmac.new(CENTRAL_HMAC_SECRET, mensaje, hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        f"{destino}{endpoint}",
        data=raw_body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Mipacs-Timestamp": timestamp,
            "X-Mipacs-Signature": firma,
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _obtener_modelo_cpu() -> str:
    if os.path.exists("/proc/cpuinfo"):
        try:
            with open("/proc/cpuinfo", "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if "model name" in line:
                        return line.split(":", 1)[1].strip()
        except Exception:
            pass
    return platform.processor() or platform.machine() or "CPU Estándar"


def _obtener_memoria_sistema() -> tuple[float, float]:
    try:
        import psutil  # type: ignore
        vm = psutil.virtual_memory()
        return round(vm.total / (1024 ** 3), 2), float(vm.percent)
    except Exception:
        pass

    if os.path.exists("/proc/meminfo"):
        try:
            mem = {}
            with open("/proc/meminfo", "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        mem[parts[0].strip()] = int(parts[1].strip().split()[0])
            total_kb = mem.get("MemTotal", 0)
            avail_kb = mem.get("MemAvailable", mem.get("MemFree", 0))
            if total_kb > 0:
                total_gb = round(total_kb / (1024 ** 2), 2)
                used_pct = round(((total_kb - avail_kb) / total_kb) * 100.0, 1)
                return total_gb, used_pct
        except Exception:
            pass

    return 0.0, 0.0


def obtener_info_dicom(db: Session) -> dict:
    puerto = 11112
    ae_title = "MIPACS_SCP"
    try:
        from app.crud.dicom_config_crud import get_config
        cfg = get_config(db)
        if cfg:
            if getattr(cfg, "port", None):
                puerto = int(cfg.port)
            ae_title = (
                getattr(cfg, "ae_title", None)
                or getattr(cfg, "calling_aet", None)
                or getattr(cfg, "aet", None)
                or "MIPACS_SCP"
            )
    except Exception:
        pass

    activo = False
    try:
        with socket.create_connection(("127.0.0.1", puerto), timeout=1.0):
            activo = True
    except Exception:
        activo = False

    return {"dicom_activo": activo, "puerto_dicom": puerto, "ae_title_dicom": ae_title}


def recolectar_inventario_y_metricas() -> dict:
    # 1. Almacenamiento NAS
    ruta_nas = "D:/MI_PACS_NAS_EXTERNAL" if os.name == "nt" else "/mnt/nas_externo"
    if not os.path.exists(ruta_nas):
        ruta_nas = "D:/" if os.name == "nt" else "/"
    try:
        total_bytes, _, free_bytes = shutil.disk_usage(ruta_nas)
        nas_total_gb = round(total_bytes / (1024 ** 3), 2)
        nas_libre_gb = round(free_bytes / (1024 ** 3), 2)
    except Exception:
        nas_total_gb = 0.0
        nas_libre_gb = 0.0

    # 2. CPU y RAM
    ram_total_gb, ram_pct = _obtener_memoria_sistema()
    cpu_pct = 10.0
    try:
        import psutil  # type: ignore
        cpu_pct = float(psutil.cpu_percent(interval=0.2))
    except Exception:
        if hasattr(os, "getloadavg"):
            try:
                cpu_pct = round(min(100.0, os.getloadavg()[0] * 15.0), 1)
            except Exception:
                pass

    # 3. DICOM y Contadores Históricos de Base de Datos
    estudios_24h = 0
    total_estudios = 0
    total_pacientes = 0
    dicom_info = {"dicom_activo": True, "puerto_dicom": 11112, "ae_title_dicom": "MIPACS_SCP"}

    db = SessionLocal()
    try:
        dicom_info = obtener_info_dicom(db)
        total_estudios = db.query(Estudio).count()
        hace_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        if hasattr(Estudio, "fecha_creacion"):
            estudios_24h = db.query(Estudio).filter(Estudio.fecha_creacion >= hace_24h).count()
        else:
            estudios_24h = total_estudios

        try:
            from app.models.paciente import Paciente
            total_pacientes = db.query(Paciente).count()
        except Exception:
            total_pacientes = 0
    except Exception:
        pass
    finally:
        db.close()

    hostname = socket.gethostname()
    return {
        "hostname": hostname,
        "so_info": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu_modelo": _obtener_modelo_cpu(),
        "nucleos_cpu": os.cpu_count() or 1,
        "ram_total_gb": ram_total_gb,
        "cpu_pct": cpu_pct,
        "ram_pct": ram_pct,
        "disco_nas_total_gb": nas_total_gb,
        "disco_nas_libre_gb": nas_libre_gb,
        "ruta_nas_monitoreada": ruta_nas,
        "dicom_activo": dicom_info["dicom_activo"],
        "ae_title_dicom": dicom_info["ae_title_dicom"],
        "puerto_dicom": dicom_info["puerto_dicom"],
        "estudios_24h": estudios_24h,
        "total_estudios_historico": total_estudios,
        "total_pacientes_historico": total_pacientes,
        "errores_24h": 0,
        "python_version": platform.python_version(),
    }


def construir_payload_registro(identidad: dict, inv: dict) -> dict:
    return {
        "server_uuid": identidad["server_uuid"],
        "cliente_nombre": identidad["cliente_nombre"],
        "pais": identidad.get("pais") or None,
        "ciudad": identidad.get("ciudad") or None,
        "lat": identidad.get("lat"),
        "lng": identidad.get("lng"),
        "version_mipacs": identidad.get("version_mipacs", "v3.1-MPR3D"),
        "so_info": inv["so_info"],
        "hostname": inv["hostname"],
        "cpu_modelo": inv["cpu_modelo"],
        "nucleos_cpu": inv["nucleos_cpu"],
        "ram_total_gb": inv["ram_total_gb"],
        "cpu_pct": inv["cpu_pct"],
        "ram_pct": inv["ram_pct"],
        "disco_nas_total_gb": inv["disco_nas_total_gb"],
        "disco_nas_libre_gb": inv["disco_nas_libre_gb"],
        "dicom_activo": inv["dicom_activo"],
        "ae_title_dicom": inv["ae_title_dicom"],
        "puerto_dicom": inv["puerto_dicom"],
        "total_estudios_historico": inv["total_estudios_historico"],
        "total_pacientes_historico": inv["total_pacientes_historico"],
        "contacto_sitio": identidad.get("contacto_sitio", ""),
        "inventario_completo": inv,
    }


def _ciclo_telemetria_background():
    registrado = False

    while True:
        try:
            identidad = obtener_o_crear_identidad()
            url_central = resolver_url_central(identidad)
            inv = recolectar_inventario_y_metricas()

            if not registrado:
                enviar_paquete_firmado(
                    "/api/v1/nodes/register",
                    construir_payload_registro(identidad, inv),
                    url_base=url_central,
                )
                registrado = True

            enviar_paquete_firmado(
                "/api/v1/telemetry/heartbeat",
                {
                    "server_uuid": identidad["server_uuid"],
                    "version_mipacs": identidad.get("version_mipacs", "v3.1-MPR3D"),
                    "cpu_pct": inv["cpu_pct"],
                    "ram_pct": inv["ram_pct"],
                    "disco_nas_libre_gb": inv["disco_nas_libre_gb"],
                    "dicom_activo": inv["dicom_activo"],
                    "estudios_24h": inv["estudios_24h"],
                    "errores_24h": inv["errores_24h"],
                },
                url_base=url_central,
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


def _validar_superadmin(usuario: Any):
    rol = usuario.get("rol", "") if isinstance(usuario, dict) else getattr(usuario, "rol", "")
    if str(rol).lower().strip() != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso exclusivo para Super Administrador.")


# =========================================================
# ENDPOINTS DE AUTO-REGISTRO E INVENTARIO (SOLO SUPERADMIN)
# =========================================================
class RegistroInventarioIn(BaseModel):
    cliente_nombre: str
    ciudad: Optional[str] = None
    pais: Optional[str] = None
    contacto_sitio: Optional[str] = ""
    central_noc_url: Optional[str] = None
    regenerar_uuid: bool = False


@router.get("/config-nodo")
def obtener_configuracion_nodo(usuario=Depends(obtener_usuario_actual)):
    _validar_superadmin(usuario)
    identidad = obtener_o_crear_identidad()
    inventario = recolectar_inventario_y_metricas()
    return {
        "identidad": identidad,
        "inventario_detectado": inventario,
    }


@router.post("/registrar-inventario")
def registrar_e_inventariar_servidor(
    payload: RegistroInventarioIn,
    usuario=Depends(obtener_usuario_actual),
):
    _validar_superadmin(usuario)
    identidad = obtener_o_crear_identidad()

    if payload.regenerar_uuid:
        identidad["server_uuid"] = f"MIPACS-{uuid.uuid4().hex[:12].upper()}"

    identidad["cliente_nombre"] = payload.cliente_nombre.strip() or identidad["cliente_nombre"]
    identidad["ciudad"] = payload.ciudad.strip() if payload.ciudad and payload.ciudad.strip() else None
    identidad["pais"] = payload.pais.strip() if payload.pais and payload.pais.strip() else None
    identidad["contacto_sitio"] = (payload.contacto_sitio or "").strip()

    if payload.central_noc_url and payload.central_noc_url.strip():
        identidad["central_noc_url"] = payload.central_noc_url.strip().rstrip("/")

    # Si cambió la ciudad/país manualmente, limpiar lat/lng anteriores para que la Central recalcule o use IP
    if payload.ciudad or payload.pais:
        identidad["lat"] = None
        identidad["lng"] = None

    guardar_identidad(identidad)
    inventario = recolectar_inventario_y_metricas()
    url_central = resolver_url_central(identidad)

    try:
        resp_registro = enviar_paquete_firmado(
            "/api/v1/nodes/register",
            construir_payload_registro(identidad, inventario),
            url_base=url_central,
        )
        enviar_paquete_firmado(
            "/api/v1/telemetry/heartbeat",
            {
                "server_uuid": identidad["server_uuid"],
                "version_mipacs": identidad.get("version_mipacs", "v3.1-MPR3D"),
                "cpu_pct": inventario["cpu_pct"],
                "ram_pct": inventario["ram_pct"],
                "disco_nas_libre_gb": inventario["disco_nas_libre_gb"],
                "dicom_activo": inventario["dicom_activo"],
                "estudios_24h": inventario["estudios_24h"],
                "errores_24h": inventario["errores_24h"],
            },
            url_base=url_central,
        )
        return {
            "status": "ok",
            "server_uuid": identidad["server_uuid"],
            "geo_asignada": resp_registro.get("geo", {}),
            "inventario_enviado": inventario,
            "mensaje": "Servidor registrado e inventariado correctamente en MI_PACS Central.",
        }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error conectando con MI_PACS Central ({url_central}): {str(e)}",
        )


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
    inventario = recolectar_inventario_y_metricas()
    url_central = resolver_url_central(identidad)

    if isinstance(usuario, dict):
        nombre_usuario = usuario.get("nombre") or usuario.get("username") or "Usuario Clínico"
        rol_usuario = usuario.get("rol", "medico")
    else:
        nombre_usuario = getattr(usuario, "nombre", None) or getattr(usuario, "username", None) or "Usuario Clínico"
        rol_usuario = getattr(usuario, "rol", "medico")

    snapshot = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "servidor": identidad,
        "salud_actual": inventario,
        "sistema_operativo": platform.platform(),
        "diagnostico_navegador": payload.diagnostico_cliente or {},
    }

    try:
        enviar_paquete_firmado(
            "/api/v1/nodes/register",
            construir_payload_registro(identidad, inventario),
            url_base=url_central,
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
            url_base=url_central,
        )
        return {
            "status": "ok",
            "codigo_ticket": respuesta.get("codigo_ticket"),
            "mensaje": "Llamada enviada a la Central de Monitoreo MI_PACS.",
        }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo contactar la Central NOC en {url_central}: {str(e)}",
        )