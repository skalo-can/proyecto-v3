"""
models/estudio_imagen.py — MI_PACS
Modelo SQLAlchemy para imágenes asociadas a un estudio clínico.
Compatible con:
- Procesador DICOM automático
- Subida manual desde el frontend
- Visor DICOM moderno
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime

from app.core.database import Base


class EstudioImagen(Base):
    __tablename__ = "estudio_imagenes"

    # ID interno de la imagen
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        doc="Identificador interno de la imagen"
    )

    # Relación con estudio
    estudio_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("estudios.id"),
        nullable=False,
        index=True,
        doc="ID del estudio al que pertenece la imagen"
    )

    estudio = relationship(
        "Estudio",
        back_populates="imagenes",
        doc="Estudio clínico asociado a esta imagen"
    )

    # Ruta pública del archivo
    ruta_archivo: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
        doc="Ruta pública del archivo DICOM o imagen"
    )

    # Miniatura (si aplica)
    thumbnail: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
        doc="Ruta pública de la miniatura generada"
    )

    # Metadata DICOM en formato JSON
    dicom_metadata: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        doc="Metadata DICOM extraída del archivo"
    )

    # Fecha de subida
    fecha_subida: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False,
        doc="Fecha en que la imagen fue registrada"
    )

    # Timestamps automáticos
    creado_en: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False,
        doc="Fecha de creación del registro"
    )

    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        nullable=False,
        doc="Fecha de última actualización del registro"
    )