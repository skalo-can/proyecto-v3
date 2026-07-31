from sqlalchemy import Column, Integer, String
from app.core.database import Base

class FirmaRadiologo(Base):
    __tablename__ = "firmas_radiologos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, unique=True, index=True, nullable=False)
    nombre_archivo = Column(String(255), nullable=False)