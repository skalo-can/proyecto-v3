"""
models/estudio.py — MI_PACS
Modelo SQLAlchemy para estudios clínicos DICOM.
Compatible con:
- Procesador DICOM automático
- Frontend moderno
- API moderna
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Date, Enum, ForeignKey
from datetime import date

from app.core.database import Base
from app.schemas.estudio import EstadoEstudio


class Estudio(Base):
    __tablename__ = "estudios"

    # ID interno del estudio
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        doc="Identificador interno del estudio"
    )

    # Relación con paciente
    paciente_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pacientes.id"),
        nullable=False,
        index=True,
        doc="ID del paciente asociado"
    )

    paciente = relationship(
        "Paciente",
        back_populates="estudios",
        doc="Paciente al que pertenece el estudio"
    )

    # Metadata clínica del estudio
    tipo_estudio: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Tipo de estudio (Modality DICOM)"
    )

    fecha_estudio: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        doc="Fecha del estudio (StudyDate)"
    )

    descripcion: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Descripción clínica del estudio (StudyDescription)"
    )

    # UID del estudio (StudyInstanceUID)
    uid: Mapped[str] = mapped_column(
        String(120),
        unique=True,
        index=True,
        nullable=False,
        doc="UID único del estudio (StudyInstanceUID)"
    )

    # Estado clínico del estudio
    estado: Mapped[EstadoEstudio] = mapped_column(
        Enum(EstadoEstudio),
        nullable=False,
        doc="Estado clínico del estudio (pendiente, procesado, etc.)"
    )

    # Relación con imágenes
    imagenes = relationship(
        "EstudioImagen",
        back_populates="estudio",
        cascade="all, delete-orphan",
        doc="Lista de imágenes asociadas al estudio"
    )

    # ---------------------------------------------------------
    # RELACIÓN CON LOGS DE IA (CORREGIDA)
    # ---------------------------------------------------------
    ia_logs = relationship(
        "EstudioIALog",   # ← ESTE ERA EL NOMBRE CORRECTO
        back_populates="estudio",
        cascade="all, delete-orphan",
        doc="Logs generados por los módulos de IA asociados al estudio"
    )
    