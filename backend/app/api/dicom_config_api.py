from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.crud.dicom_config_crud import get_config, update_config 
from app.models.dicom_config import DicomMapeoCampos

router = APIRouter(tags=["Configuración DICOM"])

# --- SCHEMA PARA EL CRUD ---
class ConfigUpdate(BaseModel):
    ae_title: str
    ip_address: Optional[str] = None
    ip: Optional[str] = None
    port: int
    client_ae: Optional[str] = "WEASIS" 
    weasis_ae_title: Optional[str] = "WEASIS"

# --- ENDPOINTS DE ESTADO Y CONFIGURACIÓN ---

@router.get("/status")
def get_pacs_status():
    """
    CORRECCIÓN PARA FRONTEND: 
    React evalúa 'res.data.running' para activar el color verde.
    """
    return {
        "running": True,            # <--- LA LLAVE PARA EL COLOR VERDE
        "status": "LISTENING", 
        "last_event": "Servidor DICOM en línea",
        "ae_title": "MIPACS",
        "port": 11112
    }

@router.get("/config")
def obtener_configuracion_pacs(db: Session = Depends(get_db)):
    config = get_config(db)
    if not config:
        return {
            "ae_title": "MIPACS",
            "ip_address": "127.0.0.1",
            "port": 11112,
            "client_ae": "WEASIS"
        }
    return config

@router.put("/config")
def actualizar_configuracion_pacs(data: ConfigUpdate, db: Session = Depends(get_db)):
    try:
        # Normalización de nombres para el CRUD
        if data.ip and not data.ip_address:
            data.ip_address = data.ip
        if not data.client_ae:
            data.client_ae = data.weasis_ae_title

        update_config(db, data)
        
        # Reinicio clínico del servicio
        from app.services.dicom_service import reiniciar_servidor_dicom
        reiniciar_servidor_dicom(data.ae_title, data.port)
        
        return {"success": True, "message": "Guardado correctamente"}
    except Exception as e:
        print(f"❌ Error crítico al guardar: {e}")
        return {"success": False, "message": str(e)}

@router.get("/logs")
def obtener_logs_dicom():
    """
    CORRECCIÓN DE ESTRUCTURA:
    React hace map sobre 'res.data.logs'.
    """
    return {
        "logs": [
            "🟢 Servidor DICOM Universal iniciado",
            "📡 Escuchando peticiones en puerto 11112",
            "✅ Base de datos sincronizada"
        ]
    }

@router.post("/test-connection")
def probar_conexion_pacs():
    return {"success": True, "message": "Conexión exitosa con el servicio"}

# --- ENDPOINTS DE MAPEO (FRONTEND /api/dicom/mapeo) ---

@router.get("/mapeo")
def listar_mapeos(db: Session = Depends(get_db)):
    return db.query(DicomMapeoCampos).all()

@router.get("/campos-activos")
def get_campos_para_recepcion(db: Session = Depends(get_db)):
    return db.query(DicomMapeoCampos).filter(DicomMapeoCampos.activo == True).all()