from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.secure_link import SecureLink
from app.models.estudio import Estudio
from pathlib import Path


def crear_link(
    db: Session,
    estudio_id: int,
    ruta_archivo: str,
    dias_validez: int = 30,  # ⏳ Cambiamos horas por días (configurable)
    max_vistas: int = 4,     # 🛡️ Límite de seguridad de visualizaciones
    max_descargas: int = 4,
    token: Optional[str] = None,
) -> SecureLink:
    
    if token is None:
        token = uuid4().hex

    # Calculamos la fecha de expiración en base a los días de validez
    expira_en = datetime.utcnow() + timedelta(days=dias_validez)

    link = SecureLink(
        token=token,
        estudio_id=estudio_id,
        ruta_archivo=ruta_archivo,
        expira_en=expira_en,
        max_descargas=max_descargas,
        max_vistas=max_vistas,  # Conectamos con tu nueva columna de la BD
        activo=True,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def obtener_por_token(db: Session, token: str) -> Optional[SecureLink]:
    return db.query(SecureLink).filter(SecureLink.token == token).first()


def registrar_descarga(db: Session, link: SecureLink):
    link.descargas += 1
    if link.descargas >= link.max_descargas:
        link.activo = False
    db.commit()
    db.refresh(link)


def revocar(db: Session, token: str) -> bool:
    link = obtener_por_token(db, token)
    if not link:
        return False
    link.activo = False
    db.commit()
    return True


# ⭐⭐⭐ FUNCIÓN QUE FALTABA ⭐⭐⭐
def listar_todos(db: Session):
    return db.query(SecureLink).all()