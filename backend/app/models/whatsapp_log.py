from datetime import datetime
from zoneinfo import ZoneInfo # <-- Importar zoneinfo
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class WhatsAppLog(Base):
    __tablename__ = "whatsapp_logs"

    id = Column(Integer, primary_key=True, index=True)
    estudio_id = Column(Integer, ForeignKey("estudios.id"), nullable=True)
    telefono = Column(String, nullable=False)
    mensaje = Column(String, nullable=True)
    formato = Column(String, nullable=True)  # link, jpg, zip, etc.
    estado = Column(String, nullable=False, default="enviado")  # enviado, error
    detalle_error = Column(String, nullable=True)
    
    # Usar datetime.now con tu zona horaria local en lugar de utcnow
    creado_en = Column(DateTime, default=lambda: datetime.now(ZoneInfo("America/Toronto")))

    estudio = relationship("Estudio", backref="whatsapp_logs")