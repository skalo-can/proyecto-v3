from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.crud.dicom_config_crud import get_config, update_config 
from app.models.dicom_config import DicomMapeoCampos

router = APIRouter(tags=["Configuración DICOM"])

# --- SCHEMAS ---
class ConfigUpdate(BaseModel):
    ae_title: str
    ip_address: Optional[str] = None
    ip: Optional[str] = None
    port: int
    client_ae: Optional[str] = "WEASIS" 
    weasis_ae_title: Optional[str] = "WEASIS"

# Schema para recibir los datos del formulario de mapeo
class MapeoCreate(BaseModel):
    nombre_mostrar: str
    tag_dicom: str

# --- ENDPOINTS DE ESTADO Y CONFIGURACIÓN (Se mantienen igual) ---

@router.get("/status")
def get_pacs_status():
    return {
        "running": True,
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
        if data.ip and not data.ip_address:
            data.ip_address = data.ip
        if not data.client_ae:
            data.client_ae = data.weasis_ae_title

        update_config(db, data)
        from app.services.dicom_service import reiniciar_servidor_dicom
        reiniciar_servidor_dicom(data.ae_title, data.port)
        return {"success": True, "message": "Guardado correctamente"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# --- ENDPOINTS DE MAPEO (SOLUCIÓN AL ERROR 405) ---

@router.get("/mapeo")
def listar_mapeos(db: Session = Depends(get_db)):
    return db.query(DicomMapeoCampos).all()

# ✅ ESTE ES EL QUE FALTABA: Para recibir el POST del formulario
@router.post("/mapeo")
def crear_mapeo(data: MapeoCreate, db: Session = Depends(get_db)):
    try:
        # Creamos la nueva instancia del modelo
        nuevo_mapeo = DicomMapeoCampos(
            nombre_mostrar=data.nombre_mostrar,
            tag_dicom=data.tag_dicom,
            activo=True
        )
        db.add(nuevo_mapeo)
        db.commit()
        db.refresh(nuevo_mapeo)
        return nuevo_mapeo
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear mapeo: {str(e)}")

# ✅ ESTE TAMBIÉN FALTABA: Para que el botón de ELIMINAR funcione
@router.delete("/mapeo/{id}")
def eliminar_mapeo(id: int, db: Session = Depends(get_db)):
    mapeo = db.query(DicomMapeoCampos).filter(DicomMapeoCampos.id == id).first()
    if not mapeo:
        raise HTTPException(status_code=404, detail="Mapeo no encontrado")
    
    try:
        db.delete(mapeo)
        db.commit()
        return {"message": "Mapeo eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campos-activos")
def get_campos_para_recepcion(db: Session = Depends(get_db)):
    return db.query(DicomMapeoCampos).filter(DicomMapeoCampos.activo == True).all()