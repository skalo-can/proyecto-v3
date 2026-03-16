"""
usuario_service.py
------------------
Lógica de negocio para usuarios clínicos del sistema MI_PACS.

Incluye:
- Crear usuario clínico (médico, admin, técnico)
- Listar usuarios
- Obtener usuario por ID

Este servicio actúa como capa intermedia entre:
- Endpoints FastAPI
- Modelos SQLAlchemy (Usuario)
- Base de datos
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate

import bcrypt


# ---------------------------------------------------------
# CREAR USUARIO CLÍNICO
# ---------------------------------------------------------
def crear_usuario(db: Session, data: UsuarioCreate) -> Usuario:
    """
    Crea un nuevo usuario clínico dentro de MI_PACS.

    Flujo clínico MI_PACS:
    - Genera un hash seguro de la contraseña (bcrypt)
    - Inserta el registro en la base de datos
    - Devuelve el usuario recién creado
    """

    try:
        # Hash seguro de la contraseña
        password_hash = bcrypt.hashpw(
            data.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        usuario = Usuario(
            nombre=data.nombre,
            email=data.email,
            rol=data.rol,
            password_hash=password_hash
        )

        db.add(usuario)
        db.commit()
        db.refresh(usuario)

        return usuario

    except SQLAlchemyError as e:
        db.rollback()
        raise RuntimeError(f"Error al crear el usuario clínico: {str(e)}")


# ---------------------------------------------------------
# LISTAR USUARIOS
# ---------------------------------------------------------
def listar_usuarios(db: Session):
    """
    Devuelve todos los usuarios clínicos registrados.
    """
    return db.query(Usuario).order_by(Usuario.nombre.asc()).all()


# ---------------------------------------------------------
# OBTENER USUARIO POR ID
# ---------------------------------------------------------
def obtener_usuario(db: Session, usuario_id: int):
    """
    Devuelve un usuario clínico por su ID.
    """
    return (
        db.query(Usuario)
        .filter(Usuario.id == usuario_id)
        .first()
    )