"""
models/reporte.py — MI_PACS
Modelo SQLAlchemy para el almacenamiento de los reportes PDF oficiales generados.
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, DateTime, ForeignKey
from datetime import datetime

from app.core.database import Base


class Reporte(Base):
    __tablename__ = "reportes_pdf"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        doc="Identificador interno del reporte"
    )

    # Relación inversa obligatoria con el estudio
    estudio_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("estudios.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # Garantiza relación 1-a-1
        index=True,
        doc="ID del estudio clínico asociado"
    )

    # Ruta del archivo físico en el servidor (ej: 'backend/reportes/Reporte_93377886.pdf')
    pdf_path: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Ruta local en el servidor del archivo PDF generado"
    )

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        doc="Fecha y hora exacta de la generación del PDF"
    )

    # Relaciones de navegación de SQLAlchemy
    estudio = relationship(
        "Estudio",
        back_populates="reporte",
        doc="Estudio al que pertenece este reporte PDF"
    )