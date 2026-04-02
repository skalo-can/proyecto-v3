from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.auditoria_descarga import AuditoriaDescarga


def crear_registro(
    db: Session,
    estudio_id: int,
    tipo: str,
    resultado: str = "ok",
    usuario_id: Optional[int] = None,
    email: Optional[str] = None,
    ip: Optional[str] = None,
) -> AuditoriaDescarga:
    registro = AuditoriaDescarga(
        estudio_id=estudio_id,
        usuario_id=usuario_id,
        email=email,
        ip=ip,
        tipo=tipo,
        resultado=resultado,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro


def listar(db: Session, limit: int = 100) -> List[AuditoriaDescarga]:
    return (
        db.query(AuditoriaDescarga)
        .order_by(AuditoriaDescarga.creado_en.desc())
        .limit(limit)
        .all()
    )


def listar_por_estudio(db: Session, estudio_id: int) -> List[AuditoriaDescarga]:
    return (
        db.query(AuditoriaDescarga)
        .filter(AuditoriaDescarga.estudio_id == estudio_id)
        .order_by(AuditoriaDescarga.creado_en.desc())
        .all()
    )


def listar_por_usuario(db: Session, usuario_id: int) -> List[AuditoriaDescarga]:
    return (
        db.query(AuditoriaDescarga)
        .filter(AuditoriaDescarga.usuario_id == usuario_id)
        .order_by(AuditoriaDescarga.creado_en.desc())
        .all()
    )