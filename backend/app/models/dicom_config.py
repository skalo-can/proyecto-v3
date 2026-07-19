"""
dicom_config.py
---------------
Modelo clínico para la configuración DICOM del sistema MI_PACS.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, func
from app.core.database import Base

class DicomConfig(Base):
    """
    Configuración DICOM global del sistema MI_PACS.
    Almacena los datos del Servidor local y el Cliente remoto por defecto.
    """
    __tablename__ = "dicom_config"

    id = Column(Integer, primary_key=True, index=True, default=1)
    
    # --- Datos del Servidor (MI_PACS / RIS) ---
    ae_title = Column(String(100), nullable=False, index=True)
    ip = Column(String(100), nullable=False, index=True)
    port = Column(Integer, nullable=False)

    # --- Datos del Cliente por defecto (AGFA NX, WEASIS, etc.) ---
    client_ae = Column(String(100), nullable=False)
    client_ip = Column(String(100), nullable=False, default="127.0.0.1")
    client_port = Column(Integer, nullable=False, default=11112)

    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NodoDestinoDicom(Base):
    """
    Tabla para las Estaciones de Diagnóstico (Nodos DICOM a los que podemos enviar).
    """
    __tablename__ = "nodo_destino_dicom"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    ae_title = Column(String(100), nullable=False)
    ip = Column(String(100), nullable=False)
    puerto = Column(String(10), nullable=False)
    auto_envio = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    modalidades = Column(JSON, default=[])  # Guarda la lista ["CT", "MR", "CR"]
    
    creado_en = Column(DateTime(timezone=True), server_default=func.now())


class DicomMapeoCampos(Base):
    """
    Tabla de 'Mapeo Inteligente'. Define qué campos extra se solicitan 
    en Recepción y a qué Tag DICOM se inyectan en la Worklist.
    """
    __tablename__ = "dicom_mapeo_campos"

    id = Column(Integer, primary_key=True, index=True)
    nombre_mostrar = Column(String, nullable=False) 
    tag_dicom = Column(String, nullable=False)      
    tipo_dato = Column(String, default="text")      
    activo = Column(Boolean, default=True)