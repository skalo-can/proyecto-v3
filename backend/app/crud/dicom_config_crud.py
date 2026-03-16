"""
dicom_config_crud.py
--------------------

CRUD clínico para la configuración DICOM del sistema MI_PACS.

Responsabilidades:
- Obtener la configuración DICOM (siempre id = 1)
- Crear configuración por defecto si no existe
- Actualizar AE Titles, IP y puerto del servidor PACS
- Integrarse con el servicio que reinicia el servidor DICOM
"""

from sqlalchemy.orm import Session
from app.models.dicom_config import DicomConfig
from app.schemas.dicom_config import DicomConfigUpdate


def get_config(db: Session):
    """
    Obtiene la configuración DICOM (id = 1).
    Si no existe, devuelve None.
    """
    return db.query(DicomConfig).filter(DicomConfig.id == 1).first()


def create_default_config(db: Session):
    """
    Crea configuración inicial si no existe.
    Esta configuración garantiza que MI_PACS arranque con valores válidos.
    """
    config = DicomConfig(
        id=1,
        ae_title="MIPACS",
        ip="127.0.0.1",
        port=11112,
        client_ae="WEASIS"
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_config(db: Session, data: DicomConfigUpdate):
    """
    Actualiza la configuración DICOM.
    Si no existe, crea la configuración por defecto.
    """
    config = get_config(db)
    if not config:
        config = create_default_config(db)

    config.ae_title = data.ae_title
    config.ip = data.ip
    config.port = data.port
    config.client_ae = data.client_ae

    db.commit()
    db.refresh(config)
    return config