"""
dicom_config_api.py
-------------------
API clínica para la configuración DICOM dentro del sistema MI_PACS.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import subprocess

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.dicom_config import DicomConfig
from app.schemas.dicom_config import (
    DicomConfigUpdate,
    DicomConfigResponse
)

from app.services.dicom_service import reiniciar_servidor_dicom
from app.dicom_utils.dicom_server import server_state


# ---------------------------------------------------------
# 🔥 UN SOLO ROUTER (el correcto)
# ---------------------------------------------------------
router = APIRouter(prefix="/dicom", tags=["DICOM"])


# ---------------------------------------------------------
# RUTA DEL ECHOSCU (DCMTK)
# ---------------------------------------------------------
ECHOSCU_PATH = (
    Path(__file__).resolve()
    .parent.parent.parent  # ← subimos desde backend/app/ hasta backend/
    / "tools"
    / "dcmtk-3.7.0-win64-dynamic"
    / "bin"
    / "echoscu.exe"
)

# ---------------------------------------------------------
# OBTENER CONFIGURACIÓN DICOM
# ---------------------------------------------------------
@router.get("/config", response_model=DicomConfigResponse)
def get_dicom_config(
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    config = db.query(DicomConfig).filter(DicomConfig.id == 1).first()

    if not config:
        config = DicomConfig(
            id=1,
            ae_title="MI_PACS",
            ip="127.0.0.1",
            port=104,
            client_ae="WEASIS"
        )
        db.add(config)
        db.commit()
        db.refresh(config)

        reiniciar_servidor_dicom(config.ae_title, config.port)

    return config


# ---------------------------------------------------------
# ACTUALIZAR CONFIGURACIÓN DICOM
# ---------------------------------------------------------
@router.put("/config", response_model=DicomConfigResponse)
def update_dicom_config(
    data: DicomConfigUpdate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    config = db.query(DicomConfig).filter(DicomConfig.id == 1).first()

    if not config:
        config = DicomConfig(id=1)

    config.ae_title = data.ae_title
    config.ip = data.ip
    config.port = data.port
    config.client_ae = data.client_ae

    db.add(config)
    db.commit()
    db.refresh(config)

    reiniciar_servidor_dicom(config.ae_title, config.port)

    return config


# ---------------------------------------------------------
# PROBAR CONEXIÓN C‑ECHO
# ---------------------------------------------------------
@router.post("/test-connection")
def test_connection_endpoint(
    payload: DicomConfigUpdate,
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["admin"])

    if not ECHOSCU_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"No se encontró echoscu.exe en: {ECHOSCU_PATH}"
        )

    cmd = [
        str(ECHOSCU_PATH),
        "-aet", payload.client_ae,
        "-aec", payload.ae_title,
        payload.ip,
        str(payload.port),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Tiempo de espera agotado al intentar C‑ECHO."
        )

    if result.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"Fallo C‑ECHO:\n{result.stderr or result.stdout}"
        )

    return {"message": result.stdout or "C‑ECHO completado correctamente."}


# ---------------------------------------------------------
# ESTADO REAL DEL SERVIDOR DICOM
# ---------------------------------------------------------
@router.get("/status")
def dicom_status():
    return {
        "running": server_state["running"],
        "ae_title": server_state["ae_title"],
        "port": server_state["port"],
        "last_event": server_state["last_event"]
    }


# ---------------------------------------------------------
# LOGS CLÍNICOS DICOM
# ---------------------------------------------------------
@router.get("/logs")
def dicom_logs():
    return {
        "logs": server_state["logs"][-50:]
    }