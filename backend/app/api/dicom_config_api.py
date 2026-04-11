from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol
from app.models.dicom_config import DicomMapeoCampos # Asegúrate que este modelo exista
from pydantic import BaseModel

# 🔥 CORRECCIÓN: Sin prefijo interno para que no se duplique con el main.py
router = APIRouter(tags=["Configuración DICOM"])

# Schema para validar lo que llega del Frontend
class MapeoCreate(BaseModel):
    nombre_mostrar: str
    tag_dicom: str

@router.get("/mapeo")
def listar_mapeos(db: Session = Depends(get_db)):
    # Quitamos temporalmente el chequeo de usuario para probar conexión
    return db.query(DicomMapeoCampos).all()

@router.post("/mapeo")
def crear_mapeo_manual(data: MapeoCreate, db: Session = Depends(get_db)):
    try:
        nuevo_campo = DicomMapeoCampos(
            nombre_mostrar=data.nombre_mostrar,
            tag_dicom=data.tag_dicom,
            tipo_dato="text", # Valor por defecto
            activo=True
        )
        db.add(nuevo_campo)
        db.commit()
        db.refresh(nuevo_campo)
        return nuevo_campo
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/mapeo/{mapeo_id}")
def eliminar_mapeo(mapeo_id: int, db: Session = Depends(get_db)):
    mapeo = db.query(DicomMapeoCampos).filter(DicomMapeoCampos.id == mapeo_id).first()
    if not mapeo:
        raise HTTPException(status_code=404, detail="Mapeo no encontrado")
    db.delete(mapeo)
    db.commit()
    return {"message": "Eliminado"}

@router.get("/campos-activos") # <--- ASEGÚRATE QUE DIGA EXACTAMENTE ASÍ
def get_campos_para_recepcion(db: Session = Depends(get_db)):
    """Este endpoint lo usa RecepcionForm para dibujar los inputs automáticamente."""
    return db.query(DicomMapeoCampos).filter(DicomMapeoCampos.activo == True).all()