"""
crud/usuario.py
----------------
Lógica clínica para la gestión de usuarios en MI_PACS.

Responsabilidades:
- Crear usuarios con contraseña hasheada
- Validar correos duplicados
- Consultar usuarios por email o ID
- Mantener integridad clínica del modelo Usuario
"""

from sqlalchemy.orm import Session
from app.models.usuario import Usuario
from app.schemas.auth import UsuarioCreate
from app.core.security import get_password_hash


# ---------------------------------------------------------
# CREAR USUARIO
# ---------------------------------------------------------
def crear_usuario(db: Session, usuario: UsuarioCreate) -> Usuario:
    """
    Crea un usuario clínico en MI_PACS con contraseña segura.
    """

    # Validar duplicado por email
    existente = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if existente:
        raise ValueError("El correo ya está registrado en el sistema.")

    # Crear instancia del modelo (Corregido password y agregados username/permisos)
    nuevo_usuario = Usuario(
        nombre=usuario.nombre,
        username=usuario.username if hasattr(usuario, 'username') else usuario.email.split('@')[0],
        email=usuario.email,
        rol=usuario.rol,
        permisos=getattr(usuario, 'permisos', {}),
        password=get_password_hash(usuario.password),
        activo=True
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    return nuevo_usuario


# ---------------------------------------------------------
# OBTENER USUARIO POR EMAIL
# ---------------------------------------------------------
def obtener_por_email(db: Session, email: str) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.email == email).first()


# ---------------------------------------------------------
# OBTENER USUARIO POR ID
# ---------------------------------------------------------
def obtener_por_id(db: Session, usuario_id: int) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.id == usuario_id).first()