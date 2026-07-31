from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Asegúrate de que esta ruta coincida con donde tienes tu get_db
# Generalmente está en app.core.database o app.api.dependencies
from app.core.database import get_db 
from app.models.plantilla import PlantillaRadiologo

router = APIRouter(prefix="/plantillas", tags=["Plantillas"])

# ==========================================
# ESQUEMA PARA CREAR PLANTILLAS (Pydantic)
# ==========================================
class PlantillaCreate(BaseModel):
    nombre: str
    modalidad: str
    contenido: str
    medico_id: int | None = None

# ==========================================
# 1. LEER PLANTILLAS (Para el Frontend)
# ==========================================
@router.get("")
def listar_plantillas(db: Session = Depends(get_db)):
    # Consultamos todas las plantillas de la base de datos
    plantillas_db = db.query(PlantillaRadiologo).all()
    
    # Las mapeamos exactamente al formato que espera tu select en React
    lista_plantillas = []
    for p in plantillas_db:
        lista_plantillas.append({
            "id": p.id,
            "modalidad": p.modalidad or "GEN", 
            "nombre": p.nombre,
            "contenido": p.contenido,
            "medico_id": p.medico_id
        })
        
    return lista_plantillas

# ==========================================
# 2. CREAR PLANTILLA (Para Administración)
# ==========================================
@router.post("")
def crear_plantilla(plantilla: PlantillaCreate, db: Session = Depends(get_db)):
    try:
        nueva_plantilla = PlantillaRadiologo(
            nombre=plantilla.nombre,
            modalidad=plantilla.modalidad,
            contenido=plantilla.contenido,
            medico_id=plantilla.medico_id
        )
        db.add(nueva_plantilla)
        db.commit()
        db.refresh(nueva_plantilla)
        
        return {
            "status": "success", 
            "mensaje": "Plantilla creada con éxito", 
            "id": nueva_plantilla.id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar la plantilla: {str(e)}")

# ==========================================
# 4. EDITAR PLANTILLA
# ==========================================
@router.put("/{plantilla_id}")
def editar_plantilla(plantilla_id: int, plantilla_data: PlantillaCreate, db: Session = Depends(get_db)):
    # Buscamos la plantilla existente
    plantilla = db.query(PlantillaRadiologo).filter(PlantillaRadiologo.id == plantilla_id).first()
    
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        
    try:
        # Actualizamos los campos
        plantilla.nombre = plantilla_data.nombre
        plantilla.modalidad = plantilla_data.modalidad
        plantilla.contenido = plantilla_data.contenido
        plantilla.medico_id = plantilla_data.medico_id
        
        db.commit()
        return {"status": "success", "mensaje": "Plantilla actualizada correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar: {str(e)}")