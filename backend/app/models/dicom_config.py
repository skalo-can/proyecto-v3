"""
dicom_config.py
---------------
Modelo clínico para la configuración DICOM del sistema MI_PACS.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, func
from app.core.database import Base

class DicomConfig(Base):
    """
    Configuración DICOM global del sistema MI_PACS.
    Almacena los datos del Servidor local y el Cliente remoto por defecto.
    """
    __tablename__ = "dicom_config"

    # ID fijo para asegurar un único registro de configuración global
    id = Column(Integer, primary_key=True, index=True, default=1)
    
    # --- Datos del Servidor (MI_PACS / RIS) ---
    ae_title = Column(String(100), nullable=False, index=True)
    ip = Column(String(100), nullable=False, index=True)
    port = Column(Integer, nullable=False)

    # --- Datos del Cliente por defecto (AGFA NX, WEASIS, etc.) ---
    client_ae = Column(String(100), nullable=False)
    client_ip = Column(String(100), nullable=False, default="127.0.0.1")
    client_port = Column(Integer, nullable=False, default=11112)

    # Timestamps para auditoría
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DicomMapeoCampos(Base):
    """
    Tabla de 'Mapeo Inteligente'. Define qué campos extra se solicitan 
    en Recepción y a qué Tag DICOM se inyectan en la Worklist.
    """
    __tablename__ = "dicom_mapeo_campos"

    id = Column(Integer, primary_key=True, index=True)
    nombre_mostrar = Column(String, nullable=False) # Ej: "Médico Referente"
    tag_dicom = Column(String, nullable=False)      # Ej: "ReferringPhysicianName"
    tipo_dato = Column(String, default="text")      # Ej: "text", "number", "date"
    activo = Column(Boolean, default=True)