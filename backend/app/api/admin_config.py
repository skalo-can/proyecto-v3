from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.pacs_config import PACSConfig
from app.services.scheduler_service import reprogramar_cron_backup

router = APIRouter(prefix="/api/admin/config", tags=["Configuración Sistema"])

# Esquema de validación estricta de datos entrantes
class ConfigSchema(BaseModel):
    hora_backup: str
    umbral_purga: int

@router.get("")
def obtener_configuracion(db: Session = Depends(get_db)):
    """
    Entrega las configuraciones actuales de infraestructura guardadas en la DB.
    Si no existen, inicializa y retorna los valores por defecto.
    """
    config = db.query(PACSConfig).first()
    if not config:
        config = PACSConfig(hora_backup="01:00", umbral_purga=80)
        db.add(config)
        db.commit()
        db.refresh(config)
    return {
        "hora_backup": config.hora_backup, 
        "umbral_purga": config.umbral_purga
    }

@router.post("")
def guardar_configuracion(payload: ConfigSchema, db: Session = Depends(get_db)):
    """
    Actualiza los valores en la base de datos y reprograma
    el reloj del planificador de fondo en caliente.
    """
    config = db.query(PACSConfig).first()
    if not config:
        config = PACSConfig()
        db.add(config)
        
    config.hora_backup = payload.hora_backup
    config.umbral_purga = payload.umbral_purga
    db.commit()
    
    # ⚡ REPROGRAMACIÓN EN CALIENTE:
    # Cambia la hora en la memoria del hilo de ejecución de inmediato
    exito = reprogramar_cron_backup(payload.hora_backup)
    
    if not exito:
        raise HTTPException(status_code=500, detail="No se pudo reprogramar el reloj del sistema.")
        
    return {"status": "ok", "message": "Configuración del sistema actualizada globalmente"}