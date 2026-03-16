"""
estudio_service.py — MI_PACS
Servicio clínico para la gestión de estudios DICOM.
Compatible con:
- Procesador DICOM automático
- Frontend moderno
- API moderna
"""

from sqlalchemy.orm import Session
from datetime import datetime

from app.models.estudio import Estudio
from app.schemas.estudio import (
    EstudioCreate,
    EstudioUpdate,
    EstadoEstudio
)


# ---------------------------------------------------------
# CREAR ESTUDIO (manual o desde DICOM)
# ---------------------------------------------------------
def crear_estudio(db: Session, data: EstudioCreate) -> Estudio:
    """
    Crea un estudio clínico moderno.
    El estado SIEMPRE inicia como 'pendiente'.
    """
    estudio = Estudio(
        paciente_id=data.paciente_id,
        tipo_estudio=data.tipo_estudio,
        fecha_estudio=data.fecha_estudio,
        descripcion=data.descripcion,
        uid=data.uid,
        estado=EstadoEstudio.pendiente,   # ← CORREGIDO
    )

    db.add(estudio)
    db.commit()
    db.refresh(estudio)
    return estudio


# ---------------------------------------------------------
# LISTAR ESTUDIOS POR PACIENTE
# ---------------------------------------------------------
def listar_estudios_por_paciente(db: Session, paciente_id: int):
    return (
        db.query(Estudio)
        .filter(Estudio.paciente_id == paciente_id)
        .order_by(Estudio.fecha_estudio.desc())
        .all()
    )


# ---------------------------------------------------------
# OBTENER ESTUDIO POR ID
# ---------------------------------------------------------
def obtener_estudio(db: Session, estudio_id: int) -> Estudio | None:
    return (
        db.query(Estudio)
        .filter(Estudio.id == estudio_id)
        .first()
    )


# ---------------------------------------------------------
# OBTENER ESTUDIO POR UID (NECESARIO PARA DICOM)
# ---------------------------------------------------------
def obtener_estudio_por_uid(db: Session, uid: str) -> Estudio | None:
    """
    Obtiene un estudio por su StudyInstanceUID (campo uid).
    """
    return (
        db.query(Estudio)
        .filter(Estudio.uid == uid)
        .first()
    )


# ---------------------------------------------------------
# OBTENER ESTUDIO PREVIO (para IA o comparación)
# ---------------------------------------------------------
def obtener_estudio_previo(db: Session, estudio: Estudio) -> Estudio | None:
    return (
        db.query(Estudio)
        .filter(
            Estudio.paciente_id == estudio.paciente_id,
            Estudio.fecha_estudio < estudio.fecha_estudio
        )
        .order_by(Estudio.fecha_estudio.desc())
        .first()
    )


# ---------------------------------------------------------
# ACTUALIZAR ESTUDIO
# ---------------------------------------------------------
def actualizar_estudio(db: Session, estudio_id: int, data: EstudioUpdate) -> Estudio | None:
    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        return None

    for campo, valor in data.dict(exclude_unset=True).items():
        setattr(estudio, campo, valor)

    db.commit()
    db.refresh(estudio)
    return estudio


# ---------------------------------------------------------
# ELIMINAR ESTUDIO (solo BD, no archivos)
# ---------------------------------------------------------
def eliminar_estudio(db: Session, estudio_id: int) -> bool:
    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        return False

    db.delete(estudio)
    db.commit()
    return True