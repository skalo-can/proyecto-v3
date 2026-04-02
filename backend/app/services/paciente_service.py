"""
paciente_service.py — MI_PACS
Servicio clínico para la gestión de pacientes.
Incluye:
- Creación normal (frontend)
- Creación automática desde DICOM
- Búsqueda por identificación
- Actualización
- Eliminación lógica
"""

from sqlalchemy.orm import Session
from datetime import date
import bcrypt

from app.models.paciente import Paciente
from app.schemas.paciente import (
    PacienteCreate,
    PacienteUpdate
)


# ---------------------------------------------------------
# CREAR PACIENTE NORMAL (USADO POR EL FRONTEND)
# ---------------------------------------------------------
def crear_paciente(db: Session, data: PacienteCreate) -> Paciente:
    """
    Crea un paciente desde el frontend.
    Se hashea la contraseña correctamente.
    """

    password_hash = bcrypt.hashpw(
        data.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    paciente = Paciente(
        identificacion=data.identificacion,
        primer_nombre=data.primer_nombre,
        segundo_nombre=data.segundo_nombre,
        primer_apellido=data.primer_apellido,
        segundo_apellido=data.segundo_apellido,
        fecha_nacimiento=data.fecha_nacimiento,
        email=data.email,
        password_hash=password_hash,
        activo=True
    )

    db.add(paciente)
    db.commit()
    db.refresh(paciente)
    return paciente


# ---------------------------------------------------------
# CREAR PACIENTE DESDE DICOM (PROFESIONAL)
# ---------------------------------------------------------
def crear_paciente_desde_dicom(db: Session, identificacion: str, nombre_completo: str) -> Paciente:
    """
    Crea un paciente usando solo la metadata DICOM.
    Maneja correctamente el formato APELLIDO^NOMBRE.
    """

    nombre = str(nombre_completo).replace("^", " ").strip()
    partes = nombre.split(" ")

    # DICOM suele ser: APELLIDO NOMBRE
    primer_apellido = partes[0] if len(partes) > 0 else "DICOM"
    primer_nombre = partes[1] if len(partes) > 1 else "Paciente"

    paciente = Paciente(
        identificacion=str(identificacion),
        primer_nombre=primer_nombre,
        segundo_nombre=None,
        primer_apellido=primer_apellido,
        segundo_apellido=None,
        fecha_nacimiento=date(1900, 1, 1),
        email=None,
        password_hash="",  # No aplica
        activo=True
    )

    db.add(paciente)
    db.commit()
    db.refresh(paciente)
    return paciente


# ---------------------------------------------------------
# BUSCAR PACIENTE POR ID INTERNO
# ---------------------------------------------------------
def obtener_paciente(db: Session, paciente_id: int) -> Paciente | None:
    return db.query(Paciente).filter(Paciente.id == paciente_id, Paciente.activo == True).first()


# ---------------------------------------------------------
# BUSCAR PACIENTE POR IDENTIFICACIÓN (DICOM)
# ---------------------------------------------------------
def obtener_paciente_por_identificacion(db: Session, identificacion: str) -> Paciente | None:
    return (
        db.query(Paciente)
        .filter(Paciente.identificacion == identificacion, Paciente.activo == True)
        .first()
    )


# ---------------------------------------------------------
# LISTAR PACIENTES
# ---------------------------------------------------------
def listar_pacientes(db: Session, limit: int = 50):
    return (
        db.query(Paciente)
        .filter(Paciente.activo == True)
        .order_by(Paciente.id.desc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------
# ACTUALIZAR PACIENTE
# ---------------------------------------------------------
def actualizar_paciente(db: Session, paciente_id: int, data: PacienteUpdate) -> Paciente | None:
    paciente = obtener_paciente(db, paciente_id)
    if not paciente:
        return None

    for campo, valor in data.dict(exclude_unset=True).items():
        setattr(paciente, campo, valor)

    db.commit()
    db.refresh(paciente)
    return paciente


# ---------------------------------------------------------
# ELIMINACIÓN LÓGICA
# ---------------------------------------------------------
def eliminar_paciente(db: Session, paciente_id: int) -> bool:
    paciente = obtener_paciente(db, paciente_id)
    if not paciente:
        return False

    paciente.activo = False
    db.commit()
    return True

from app.models.paciente import Paciente
from sqlalchemy.orm import Session

def actualizar_paciente(db: Session, id: int, data: dict):
    paciente = db.query(Paciente).filter(Paciente.id == id).first()
    if not paciente:
        return None

    for key, value in data.items():
        setattr(paciente, key, value)

    db.commit()
    return paciente


def eliminar_paciente(db: Session, id: int):
    paciente = db.query(Paciente).filter(Paciente.id == id).first()
    if not paciente:
        return None

    db.delete(paciente)
    db.commit()
    return True