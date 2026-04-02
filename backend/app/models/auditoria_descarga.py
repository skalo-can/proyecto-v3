from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditoriaDescarga(Base):
    __tablename__ = "auditoria_descargas"

    id = Column(Integer, primary_key=True, index=True)
    estudio_id = Column(Integer, ForeignKey("estudios.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    email = Column(String, nullable=True)
    ip = Column(String, nullable=True)
    tipo = Column(String, nullable=False)  # zip, cd, jpg, link, etc.
    resultado = Column(String, nullable=False, default="ok")  # ok, expirado, denegado
    creado_en = Column(DateTime, default=datetime.utcnow)

    estudio = relationship("Estudio", backref="descargas")
    usuario = relationship("Usuario", backref="descargas")