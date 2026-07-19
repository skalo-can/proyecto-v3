"""
dicom_config_crud.py
--------------------
CRUD clínico para la configuración DICOM del sistema MI_PACS.
"""

from sqlalchemy.orm import Session
from app.models.dicom_config import DicomConfig, NodoDestinoDicom
from app.schemas.dicom_config import DicomConfigUpdate, NodoDicomCreate, NodoDicomUpdate

# ==========================================
# CRUD CONFIGURACIÓN GLOBAL
# ==========================================
def get_config(db: Session):
    return db.query(DicomConfig).filter(DicomConfig.id == 1).first()

def create_default_config(db: Session):
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

# ==========================================
# CRUD NODOS (ESTACIONES DE DIAGNÓSTICO)
# ==========================================
def get_nodos(db: Session):
    return db.query(NodoDestinoDicom).all()

def create_nodo(db: Session, data: NodoDicomCreate):
    nuevo_nodo = NodoDestinoDicom(**data.model_dump())
    db.add(nuevo_nodo)
    db.commit()
    db.refresh(nuevo_nodo)
    return nuevo_nodo

def update_nodo(db: Session, nodo_id: int, data: NodoDicomUpdate):
    nodo = db.query(NodoDestinoDicom).filter(NodoDestinoDicom.id == nodo_id).first()
    if not nodo:
        return None
    for var, value in data.model_dump().items():
        setattr(nodo, var, value)
    db.commit()
    db.refresh(nodo)
    return nodo

def delete_nodo(db: Session, nodo_id: int):
    nodo = db.query(NodoDestinoDicom).filter(NodoDestinoDicom.id == nodo_id).first()
    if nodo:
        db.delete(nodo)
        db.commit()
        return True
    return False