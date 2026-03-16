"""
medico_service.py
-----------------
Servicio clínico para la gestión de médicos dentro del sistema MI_PACS.

Incluye:
- Crear médico asociado a un usuario del sistema
- Listar médicos registrados
- Obtener médico por ID

Este servicio actúa como capa intermedia entre:
- Endpoints FastAPI
- Modelos SQLAlchemy (Medico)
- Base de datos
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.medico import Medico
from app.schemas.medico import MedicoCreate


# ---------------------------------------------------------
# CREAR MÉDICO
# ---------------------------------------------------------
def crear_medico(db: Session, data: MedicoCreate) -> Medico:
    """
    Crea un médico clínico asociado a un usuario del sistema MI_PACS.

    Flujo clínico:
    - Recibe datos validados desde el schema MedicoCreate
    - Inserta el registro en la base de datos
    - Devuelve el médico recién creado
    """
    try:
        medico = Medico(
            usuario_id=data.usuario_id,
            especialidad=data.especialidad,
            numero_licencia=data.numero_licencia
        )

        db.add(medico)
        db.commit()
        db.refresh(medico)

        return medico

    except SQLAlchemyError as e:
        db.rollback()
        raise RuntimeError(f"Error al crear el médico clínico: {str(e)}")


# ---------------------------------------------------------
# LISTAR MÉDICOS
# ---------------------------------------------------------
def listar_medicos(db: Session) -> list[Medico]:
    """
    Devuelve todos los médicos registrados en MI_PACS.
    """
    return db.query(Medico).order_by(Medico.id.asc()).all()


# ---------------------------------------------------------
# OBTENER MÉDICO POR ID
# ---------------------------------------------------------
def obtener_medico(db: Session, medico_id: int) -> Medico | None:
    """
    Devuelve un médico clínico según su ID.
    """
    return (
        db.query(Medico)
        .filter(Medico.id == medico_id)
        .first()
    )