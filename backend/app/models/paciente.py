"""
paciente.py — MI_PACS
Modelo SQLAlchemy que representa a un paciente.
Compatible con:
- Pacientes creados manualmente
- Pacientes creados automáticamente desde DICOM
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Date, Boolean, DateTime, func

from app.core.database import Base


class Paciente(Base):
    __tablename__ = "pacientes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        doc="Identificador interno del paciente"
    )

    # Identificación clínica o DICOM
    identificacion: Mapped[str] = mapped_column(
        String(50),
        unique=False,        # DICOM puede repetir PatientID
        index=True,
        nullable=False,
        doc="Documento único o PatientID del paciente"
    )

    # Nombres y apellidos (pueden venir vacíos si es DICOM)
    primer_nombre: Mapped[str | None] = mapped_column(
        String(100),
        index=True,
        nullable=True,
        doc="Primer nombre del paciente (puede venir vacío si es DICOM)"
    )

    segundo_nombre: Mapped[str | None] = mapped_column(
        String(100),
        index=True,
        nullable=True,
        doc="Segundo nombre del paciente (opcional)"
    )

    primer_apellido: Mapped[str | None] = mapped_column(
        String(100),
        index=True,
        nullable=True,
        doc="Primer apellido del paciente (puede venir vacío si es DICOM)"
    )

    segundo_apellido: Mapped[str | None] = mapped_column(
        String(100),
        index=True,
        nullable=True,
        doc="Segundo apellido del paciente (opcional)"
    )

    # Fecha de nacimiento (placeholder si viene de DICOM)
    fecha_nacimiento: Mapped[Date | None] = mapped_column(
        Date,
        nullable=True,
        doc="Fecha de nacimiento del paciente (puede ser None si viene de DICOM)"
    )

    # Email opcional
    email: Mapped[str | None] = mapped_column(
        String(150),
        unique=False,
        nullable=True,
        index=True,
        doc="Correo electrónico del paciente (opcional)"
    )

    # Hash de contraseña (vacío si viene de DICOM)
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Hash seguro de la contraseña del paciente"
    )

    activo: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Indica si el paciente está activo en el sistema"
    )

    creado_en: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        doc="Fecha de creación del registro"
    )

    actualizado_en: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        doc="Fecha de última actualización del registro"
    )

    estudios = relationship(
        "Estudio",
        back_populates="paciente",
        cascade="all, delete-orphan",
        doc="Lista de estudios clínicos asociados al paciente"
    )