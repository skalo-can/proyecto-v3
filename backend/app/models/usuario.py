"""
usuario.py
----------
Modelo SQLAlchemy para usuarios del sistema MI_PACS.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Usuario(Base):
    """
    Modelo de usuario clínico del sistema MI_PACS.
    Representa a médicos, administradores y técnicos que acceden
    al sistema con credenciales seguras y roles definidos.
    """

    __tablename__ = "usuarios"

    # ---------------------------------------------------------
    # Identificador principal
    # ---------------------------------------------------------
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        doc="ID interno del usuario"
    )

    # ---------------------------------------------------------
    # Datos personales
    # ---------------------------------------------------------
    nombre = Column(
        String(150),
        nullable=False,
        doc="Nombre completo del usuario"
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True,
        doc="Correo electrónico único del usuario"
    )

    # ---------------------------------------------------------
    # Rol y autenticación
    # ---------------------------------------------------------
    rol = Column(
        String(50),
        nullable=False,
        doc="Rol del usuario: medico | admin | tecnico | superadmin" # Agregado superadmin
    )

    password_hash = Column(
        String(255),
        nullable=False,
        doc="Contraseña almacenada en formato hash seguro"
    )

    # ---------------------------------------------------------
    # Estado clínico del usuario
    # ---------------------------------------------------------
    activo = Column(
        Boolean,
        default=True,
        nullable=False,
        doc="Indica si el usuario está activo en el sistema"
    )

    # ---------------------------------------------------------
    # Timestamps clínicos
    # ---------------------------------------------------------
    creado_en = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        doc="Fecha de creación del registro"
    )

    actualizado_en = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        doc="Fecha de última actualización del registro"
    )

    # ---------------------------------------------------------
    # Relación con médico (si aplica)
    # ---------------------------------------------------------
    medico = relationship(
        "Medico",
        back_populates="usuario",
        uselist=False,
        doc="Relación uno a uno con el médico asociado"
    )