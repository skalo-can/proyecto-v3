from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud import email_log_crud


router = APIRouter(tags=["Email logs"], prefix="/email-logs")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/listar", response_model=list[dict])
def listar(limit: int = 100, db: Session = Depends(get_db)):
    logs = email_log_crud.listar(db, limit=limit)
    return [
        {
            "id": l.id,
            "estudio_id": l.estudio_id,
            "destino": l.destino,
            "formato": l.formato,
            "asunto": l.asunto,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "tamano_bytes": l.tamano_bytes,
            "token_link": l.token_link,
            "creado_en": l.creado_en,
        }
        for l in logs
    ]


@router.get("/estudio/{estudio_id}", response_model=list[dict])
def listar_por_estudio(estudio_id: int, db: Session = Depends(get_db)):
    logs = email_log_crud.listar_por_estudio(db, estudio_id)
    return [
        {
            "id": l.id,
            "estudio_id": l.estudio_id,
            "destino": l.destino,
            "formato": l.formato,
            "asunto": l.asunto,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "tamano_bytes": l.tamano_bytes,
            "token_link": l.token_link,
            "creado_en": l.creado_en,
        }
        for l in logs
    ]


@router.get("/email/{email}", response_model=list[dict])
def listar_por_email(email: str, db: Session = Depends(get_db)):
    logs = email_log_crud.listar_por_email(db, email)
    return [
        {
            "id": l.id,
            "estudio_id": l.estudio_id,
            "destino": l.destino,
            "formato": l.formato,
            "asunto": l.asunto,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "tamano_bytes": l.tamano_bytes,
            "token_link": l.token_link,
            "creado_en": l.creado_en,
        }
        for l in logs
    ]