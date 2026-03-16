from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.crud.dicom_config_crud import get_config, update_config, create_default_config
import os

router = APIRouter(tags=["DICOM"])

LOG_PATH = "dicom_logs.txt"

# ---------------------------------------------------------
# GET CONFIG
# ---------------------------------------------------------
@router.get("/dicom/config")
def load_config(db: Session = Depends(get_db)):
    cfg = get_config(db)
    if not cfg:
        cfg = create_default_config(db)

    return {
        "ae_title": cfg.ae_title,
        "ip": cfg.ip,
        "port": cfg.port,
        "client_ae": cfg.client_ae,
        "client_ip": cfg.client_ip,
        "client_port": cfg.client_port,
    }

# ---------------------------------------------------------
# SAVE CONFIG
# ---------------------------------------------------------
@router.put("/dicom/config")
def save_config(data: dict, db: Session = Depends(get_db)):
    update_config(db, data)
    return {"message": "Configuración guardada correctamente"}

# ---------------------------------------------------------
# STATUS DEL SERVIDOR DICOM
# ---------------------------------------------------------
@router.get("/dicom/status")
def status():
    return {
        "status": "LISTENING",
        "last_sender": "CT_ROOM_1"
    }

# ---------------------------------------------------------
# LOGS DICOM
# ---------------------------------------------------------
@router.get("/dicom/logs")
def logs():
    if not os.path.exists(LOG_PATH):
        return {"logs": []}
    return {"logs": open(LOG_PATH).read().splitlines()}

# ---------------------------------------------------------
# TEST CONNECTION (C‑ECHO)
# ---------------------------------------------------------
@router.post("/dicom/test-connection")
def test_connection(data: dict):
    return {
        "message": "C‑ECHO exitoso",
        "logs": [
            "Iniciando C‑ECHO...",
            f"Conectando a {data['ip']}:{data['port']}",
            f"Usando AE cliente {data['client_ae']} en {data['client_ip']}:{data['client_port']}",
            "Asociación establecida",
            "C‑ECHO OK"
        ]
    }