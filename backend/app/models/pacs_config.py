from sqlalchemy import Column, Integer, String
from app.core.database import Base  # Verifica si tu Base se importa desde app.core.database

class PACSConfig(Base):
    __tablename__ = "pacs_config"

    id = Column(Integer, primary_key=True, index=True)
    hora_backup = Column(String, default="01:00")   # Guarda la hora en formato "HH:MM"
    umbral_purga = Column(Integer, default=80)      # Guarda el porcentaje límite del disco