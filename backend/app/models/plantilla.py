from sqlalchemy import Column, Integer, String, Text
from app.core.database import Base

class PlantillaRadiologo(Base):
    __tablename__ = "plantillas_radiologo"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), index=True)     # Ej: "Tórax Normal Estándar"
    modalidad = Column(String(50), index=True)   # Ej: "CR", "CT", "MR"
    medico_id = Column(Integer, nullable=True)   # Null = Plantilla Genérica para todos
    contenido = Column(Text, nullable=False)     # El texto base del reporte