"""
estudio_ia_log.py
-----------------
Modelo clínico de auditoría para solicitudes de análisis IA dentro del sistema MI_PACS.

Responsabilidades:
- Registrar cada solicitud de análisis IA realizada por un médico
- Asociar la solicitud al estudio clínico correspondiente
- Almacenar el resultado IA serializado (JSON)
- Mantener trazabilidad completa para auditoría hospitalaria
- Registrar timestamps clínicos de creación y actualización

Este modelo actúa como capa intermedia entre:
- Servicios de IA (estudio_ai_service.py)
- Módulo de estudios clínicos
- Base de datos SQLAlchemy (tabla estudio_ia_logs)

Notas clínicas:
- Permite reconstruir el historial de análisis IA por estudio
- Facilita auditorías internas y externas
- Garantiza transparencia en el uso de herramientas de apoyo diagnóstico
"""

from sqlalchemy import DateTime, JSON, ForeignKey, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EstudioIALog(Base):
    """
    Modelo de auditoría para solicitudes IA en MI_PACS.
    """

    __tablename__ = "estudio_ia_logs"

    # ---------------------------------------------------------
    # Identificador principal
    # ---------------------------------------------------------
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        doc="ID interno del registro de auditoría IA"
    )

    # ---------------------------------------------------------
    # Estudio analizado
    # ---------------------------------------------------------
    estudio_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("estudios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="ID del estudio clínico analizado"
    )

    estudio = relationship(
        "Estudio",
        back_populates="ia_logs",
        passive_deletes=True,
        doc="Estudio clínico asociado a la solicitud IA"
    )

    # ---------------------------------------------------------
    # Médico solicitante
    # ---------------------------------------------------------
    medico_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("medicos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="ID del médico que solicitó el análisis IA"
    )

    medico = relationship(
        "Medico",
        back_populates="ia_logs",
        passive_deletes=True,
        doc="Médico que realizó la solicitud IA"
    )

    # ---------------------------------------------------------
    # Fecha y hora de la solicitud
    # ---------------------------------------------------------
    fecha_solicitud: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        doc="Fecha y hora en que se solicitó el análisis IA"
    )

    # ---------------------------------------------------------
    # Resultado IA serializado
    # ---------------------------------------------------------
    resultado_ia: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        doc="Resultado IA serializado como JSON"
    )

    # ---------------------------------------------------------
    # Timestamps clínicos
    # ---------------------------------------------------------
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