from datetime import datetime
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
    creado_en = Column(DateTime, default=datetime.utcnow)

    estudio = relationship("Estudio", backref="whatsapp_logs")