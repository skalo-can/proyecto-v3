from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    estudio_id = Column(Integer, ForeignKey("estudios.id"), nullable=True)
    destino = Column(String, nullable=False)
    formato = Column(String, nullable=False)  # zip, cd, jpg, link
    asunto = Column(String, nullable=True)
    estado = Column(String, nullable=False, default="enviado")  # enviado, error
    detalle_error = Column(String, nullable=True)
    tamano_bytes = Column(Integer, nullable=True)
    token_link = Column(String, nullable=True)
    creado_en = Column(DateTime, default=datetime.utcnow)

    estudio = relationship("Estudio", backref="email_logs")