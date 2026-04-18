from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.estudio import Estudio
from pydantic import BaseModel

router = APIRouter()

class AtencionSchema(BaseModel):
    usuario_id: int

@router.patch("/atender/{estudio_id}")
async def atender_paciente(estudio_id: int, data: AtencionSchema, db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    try:
        estudio.estado = "terminado"
        estudio.usuario_id = data.usuario_id 
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usuarios/tecnologos")
async def obtener_tecnologos(db: Session = Depends(get_db)):
    from app.models.usuario import Usuario
    return db.query(Usuario).filter(Usuario.rol == "tecnologo").all()