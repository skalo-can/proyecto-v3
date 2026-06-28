"""
paciente_service.py — MI_PACS
Servicio clínico central para la gestión integral de pacientes.
Optimizado para el Modo Maestro con unificación de esquemas de actualización.
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
    Crea un registro de paciente desde el formulario de admisión del frontend.
    Garantiza el hash de seguridad de la contraseña clínica de acceso.
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
# CREAR PACIENTE DESDE DICOM (PARSEO DE METADATA CLÍNICA)
# ---------------------------------------------------------
def crear_paciente_desde_dicom(db: Session, identificacion: str, nombre_completo: str) -> Paciente:
    """
    Crea automáticamente un paciente abstrayendo la metadata de un estudio DICOM.
    Normaliza de forma segura el delimitador caret tradicional (APELLIDO^NOMBRE).
    """
    nombre = str(nombre_completo).replace("^", " ").strip()
    partes = nombre.split(" ")

    # Estructura clásica de cabecera DICOM para PACS comerciales
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
        password_hash="",  # No aplica para inyección directa por hardware
        activo=True
    )

    db.add(paciente)
    db.commit()
    db.refresh(paciente)
    return paciente


# ---------------------------------------------------------
# BUSCAR PACIENTE POR ID INTERNO (PRIMARY KEY)
# ---------------------------------------------------------
def obtener_paciente(db: Session, paciente_id: int) -> Paciente | None:
    """Retorna el registro del paciente por su ID secuencial interno."""
    return db.query(Paciente).filter(Paciente.id == paciente_id, Paciente.activo == True).first()


# ---------------------------------------------------------
# BUSCAR PACIENTE POR IDENTIFICACIÓN (CÉDULA / CÓDIGO PACS)
# ---------------------------------------------------------
def obtener_paciente_por_identificacion(db: Session, identificacion: str) -> Paciente | None:
    """Busca coincidencia estricta usando el ID clínico DICOM o documento de identidad."""
    return (
        db.query(Paciente)
        .filter(Paciente.identificacion == identificacion, Paciente.activo == True)
        .first()
    )


# ---------------------------------------------------------
# LISTAR PACIENTES (PAGINACIÓN CONTROLADA)
# ---------------------------------------------------------
def listar_pacientes(db: Session, limit: int = 50):
    """Retorna la lista de pacientes activos ordenados cronológicamente por inserción."""
    return (
        db.query(Paciente)
        .filter(Paciente.activo == True)
        .order_by(Paciente.id.desc())
        .limit(limit)
        .all()
    )


from datetime import datetime, date  # Asegúrate de tener este import arriba

# ---------------------------------------------------------
# ACTUALIZAR PACIENTE (SOPORTE DE CONVERSIÓN DE TIPOS)
# ---------------------------------------------------------
def actualizar_paciente(db: Session, paciente_id: int, data: PacienteUpdate) -> Paciente | None:
    """
    Actualiza los campos de un paciente y convierte strings de fecha
    en objetos date nativos para cumplir con el modelo SQLAlchemy.
    """
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        return None

    # Extraer los datos limpios en un diccionario
    update_data = data.dict(exclude_unset=True) if hasattr(data, "dict") else dict(data)

    # 📆 PARSEO CRÍTICO: Si la fecha de nacimiento viene como string, la transformamos
    if "fecha_nacimiento" in update_data and isinstance(update_data["fecha_nacimiento"], str):
        try:
            # Convierte "AAAA-MM-DD" en un objeto date real
            update_data["fecha_nacimiento"] = datetime.strptime(update_data["fecha_nacimiento"], "%Y-%m-%d").date()
        except ValueError:
            print(f"⚠️ Formato de fecha inválido recibido: {update_data['fecha_nacimiento']}")
            # Puedes optar por omitirla o manejarla si viene vacía
            if not update_data["fecha_nacimiento"]:
                update_data["fecha_nacimiento"] = None

    # Mapeo dinámico y seguro sobre las columnas del modelo
    for campo, valor in update_data.items():
        if hasattr(paciente, campo):
            setattr(paciente, campo, valor)

    try:
        db.commit()
        db.refresh(paciente)
        return paciente
    except Exception as e:
        db.rollback()
        print(f"❌ Error crítico en persistencia SQL: {str(e)}")
        return None

# ---------------------------------------------------------
# ELIMINACIÓN LÓGICA (PRESERVACIÓN DE HISTORIAL DE ESTUDIOS)
# ---------------------------------------------------------
def eliminar_paciente(db: Session, paciente_id: int) -> bool:
    """
    Aplica una inactivación lógica en lugar de un borrado físico destructivo.
    Protege la integridad de la base de datos impidiendo estudios huérfanos.
    """
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        return False

    paciente.activo = False
    db.commit()
    return True