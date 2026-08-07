from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class SecureLink(Base):
    __tablename__ = "secure_links"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    estudio_id = Column(Integer, ForeignKey("estudios.id"), nullable=False)
    ruta_archivo = Column(String, nullable=False)
    
    # ⏳ 1. LÍMITE DE TIEMPO (Configurable al generar el enlace)
    creado_en = Column(DateTime, default=datetime.utcnow)
    expira_en = Column(DateTime, nullable=False)
    
    # 🛡️ 2. LÍMITES DE SEGURIDAD CONTRA FUERZA BRUTA Y ABUSO
    intentos_fallidos = Column(Integer, default=0)  # Bloquea al llegar a 4 intentos de fecha errónea
    vistas_actuales = Column(Integer, default=0)    # Cuenta cuántas veces ha entrado al visor el paciente
    max_vistas = Column(Integer, default=4)         # Límite máximo (configurable por la clínica)
    
    # Campos originales (útiles si manejas descargas directas de archivos ZIP extra)
    descargas = Column(Integer, default=0)
    max_descargas = Column(Integer, default=5)
    
    activo = Column(Boolean, default=True)

    estudio = relationship("Estudio", backref="secure_links")