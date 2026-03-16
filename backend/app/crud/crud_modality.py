"""
crud_modality.py
----------------
Operaciones clínicas para gestionar el historial de modalidades DICOM
que se conectan a MI_PACS.
"""

from sqlalchemy.orm import Session
from datetime import datetime
from app.models.modality import Modality


def register_modality(db: Session, ae_title: str, ip: str, port: int):
    """
    Registra o actualiza una modalidad DICOM que se conecta a MI_PACS.
    - Si ya existe por AE Title, actualiza última conexión y suma estudios.
    - Si no existe, la crea.
    """
    modality = db.query(Modality).filter_by(ae_title=ae_title).first()

    if modality:
        modality.last_connection = datetime.utcnow()
        modality.studies_sent += 1
    else:
        modality = Modality(
            ae_title=ae_title,
            ip=ip,
            port=port,
            last_connection=datetime.utcnow(),
            studies_sent=1
        )
        db.add(modality)

    db.commit()
    db.refresh(modality)
    return modality


def get_modalities(db: Session):
    """
    Devuelve las modalidades ordenadas por última conexión (más recientes primero).
    """
    return db.query(Modality).order_by(Modality.last_connection.desc()).all()