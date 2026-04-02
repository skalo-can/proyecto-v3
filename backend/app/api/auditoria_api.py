from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import SessionLocal
from app.crud import auditoria_descarga_crud
from app.models.auditoria_descarga import AuditoriaDescarga


router = APIRouter(tags=["Auditoría descargas"], prefix="/auditoria")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/registrar-descarga")
def registrar_descarga(
    estudio_id: int,
    tipo: str,
    resultado: str = "ok",
    usuario_id: Optional[int] = None,
    email: Optional[str] = None,
    ip: Optional[str] = None,
    db: Session = Depends(get_db),
):
    registro = auditoria_descarga_crud.crear_registro(
        db=db,
        estudio_id=estudio_id,
        tipo=tipo,
        resultado=resultado,
        usuario_id=usuario_id,
        email=email,
        ip=ip,
    )
    return {"status": "ok", "id": registro.id}


@router.get("/listar", response_model=list[dict])
def listar(limit: int = 100, db: Session = Depends(get_db)):
    registros = auditoria_descarga_crud.listar(db, limit=limit)
    return [
        {
            "id": r.id,
            "estudio_id": r.estudio_id,
            "usuario_id": r.usuario_id,
            "email": r.email,
            "ip": r.ip,
            "tipo": r.tipo,
            "resultado": r.resultado,
            "creado_en": r.creado_en,
        }
        for r in registros
    ]


@router.get("/estudio/{estudio_id}", response_model=list[dict])
def listar_por_estudio(estudio_id: int, db: Session = Depends(get_db)):
    registros = auditoria_descarga_crud.listar_por_estudio(db, estudio_id)
    return [
        {
            "id": r.id,
            "estudio_id": r.estudio_id,
            "usuario_id": r.usuario_id,
            "email": r.email,
            "ip": r.ip,
            "tipo": r.tipo,
            "resultado": r.resultado,
            "creado_en": r.creado_en,
        }
        for r in registros
    ]


@router.get("/usuario/{usuario_id}", response_model=list[dict])
def listar_por_usuario(usuario_id: int, db: Session = Depends(get_db)):
    registros = auditoria_descarga_crud.listar_por_usuario(db, usuario_id)
    return [
        {
            "id": r.id,
            "estudio_id": r.estudio_id,
            "usuario_id": r.usuario_id,
            "email": r.email,
            "ip": r.ip,
            "tipo": r.tipo,
            "resultado": r.resultado,
            "creado_en": r.creado_en,
        }
        for r in registros
    ]