"""
dicom_config.py
---------------
Modelo clínico para la configuración DICOM del sistema MI_PACS.
"""

from sqlalchemy import Column, Integer, String, DateTime, func
from app.core.database import Base


class DicomConfig(Base):
    """
    Configuración DICOM del sistema MI_PACS.
    """

    __tablename__ = "dicom_config"

    # ---------------------------------------------------------
    # ID fijo (siempre 1)
    # ---------------------------------------------------------
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        default=1,
        doc="ID único de la configuración DICOM (siempre 1)"
    )

    # ---------------------------------------------------------
    # AE Title del servidor PACS
    # ---------------------------------------------------------
    ae_title = Column(
        String(100),
        nullable=False,
        index=True,
        doc="AE Title del servidor PACS"
    )

    # ---------------------------------------------------------
    # Dirección IP del servidor PACS
    # ---------------------------------------------------------
    ip = Column(
        String(100),
        nullable=False,
        index=True,
        doc="Dirección IP del servidor PACS"
    )

    # ---------------------------------------------------------
    # Puerto DICOM (normalmente 104)
    # ---------------------------------------------------------
    port = Column(
        Integer,
        nullable=False,
        doc="Puerto DICOM del servidor PACS"
    )

    # ---------------------------------------------------------
    # AE Title del cliente (ej: WEASIS)
    # ---------------------------------------------------------
    client_ae = Column(
        String(100),
        nullable=False,
        doc="AE Title del cliente DICOM"
    )

    # ---------------------------------------------------------
    # 🔥 NUEVOS CAMPOS PARA QUERY Y ENVÍOS AUTOMÁTICOS
    # ---------------------------------------------------------
    client_ip = Column(
        String(100),
        nullable=False,
        default="127.0.0.1",
        doc="Dirección IP del cliente DICOM"
    )

    client_port = Column(
        Integer,
        nullable=False,
        default=11112,
        doc="Puerto DICOM del cliente"
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