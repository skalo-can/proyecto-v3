from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.plantilla import PlantillaRadiologo

router = APIRouter(prefix="/plantillas", tags=["Plantillas"])

@router.get("")
def listar_plantillas(modalidad: str = None, db: Session = Depends(get_db)):
    query = db.query(PlantillaRadiologo)
    
    # Filtro inteligente: Si el transcriptor está viendo una Radiografía (CR), 
    # solo le mostramos las plantillas de CR para no saturar la lista.
    if modalidad:
        query = query.filter(PlantillaRadiologo.modalidad.ilike(f"%{modalidad}%"))
        
    resultados = query.all()
    return resultados

@router.post("")
def crear_plantilla(nombre: str, modalidad: str, contenido: str, medico_id: int = None, db: Session = Depends(get_db)):
    nueva = PlantillaRadiologo(
        nombre=nombre,
        modalidad=modalidad.upper(),
        contenido=contenido,
        medico_id=medico_id
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return {"status": "success", "message": "Plantilla almacenada", "id": nueva.id}