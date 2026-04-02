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
    creado_en = Column(DateTime, default=datetime.utcnow)
    expira_en = Column(DateTime, nullable=False)
    descargas = Column(Integer, default=0)
    max_descargas = Column(Integer, default=5)
    activo = Column(Boolean, default=True)

    estudio = relationship("Estudio", backref="secure_links")