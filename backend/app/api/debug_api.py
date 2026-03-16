from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.usuario import Usuario

router = APIRouter(prefix="/debug", tags=["Debug"])

@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).all()
    return [
        {
            "id": u.id,
            "nombre": u.nombre,
            "email": u.email,
            "rol": u.rol,
            "password_hash": u.password_hash,
            "activo": u.activo,
        }
        for u in usuarios
    ]