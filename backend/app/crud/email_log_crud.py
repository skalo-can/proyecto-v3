from typing import List, Tuple
from sqlalchemy.orm import Session

from app.models.email_log import EmailLog
from app.models.estudio import Estudio
from app.models.paciente import Paciente


def crear_log(
    db: Session,
    destino: str,
    formato: str,
    estado: str = "enviado",
    estudio_id: int | None = None,
    asunto: str | None = None,
    detalle_error: str | None = None,
    tamano_bytes: int | None = None,
    token_link: str | None = None,
) -> EmailLog:
    log = EmailLog(
        estudio_id=estudio_id,
        destino=destino,
        formato=formato,
        asunto=asunto,
        estado=estado,
        detalle_error=detalle_error,
        tamano_bytes=tamano_bytes,
        token_link=token_link,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def listar(db: Session, limit: int = 100):
    return (
        db.query(EmailLog, Paciente)
        .outerjoin(Estudio, EmailLog.estudio_id == Estudio.id)
        .outerjoin(Paciente, Estudio.paciente_id == Paciente.id)
        .order_by(EmailLog.creado_en.desc())
        .limit(limit)
        .all()
    )


def listar_por_estudio(db: Session, estudio_id: int):
    return (
        db.query(EmailLog, Paciente)
        .outerjoin(Estudio, EmailLog.estudio_id == Estudio.id)
        .outerjoin(Paciente, Estudio.paciente_id == Paciente.id)
        .filter(EmailLog.estudio_id == estudio_id)
        .order_by(EmailLog.creado_en.desc())
        .all()
    )


def listar_por_email(db: Session, email: str):
    return (
        db.query(EmailLog, Paciente)
        .outerjoin(Estudio, EmailLog.estudio_id == Estudio.id)
        .outerjoin(Paciente, Estudio.paciente_id == Paciente.id)
        .filter(EmailLog.destino == email)
        .order_by(EmailLog.creado_en.desc())
        .all()
    )