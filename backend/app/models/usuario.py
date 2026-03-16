"""
usuario.py
----------
Modelo SQLAlchemy para usuarios del sistema MI_PACS.

Responsabilidades:
- Registrar credenciales seguras de acceso al sistema
- Definir el rol clínico o administrativo del usuario
- Mantener información personal básica
- Controlar el estado activo/inactivo del usuario
- Relacionar usuarios con médicos cuando aplica

Este modelo actúa como capa intermedia entre:
- Servicios de autenticación y autorización
- Módulo de médicos (relación uno a uno)
- Administración del sistema MI_PACS
- Base de datos SQLAlchemy (tabla usuarios)

Notas clínicas:
- Un usuario puede ser médico, administrador o técnico
- Los médicos tienen un registro adicional en la tabla medicos
- El hash de contraseña debe ser seguro y nunca reversible
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
        doc="Rol del usuario: medico | admin | tecnico"
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