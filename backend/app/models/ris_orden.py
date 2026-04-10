from sqlalchemy import Column, Integer, String, DateTime, func
from app.core.database import Base # Ruta correcta

class RISOrden(Base):
    __tablename__ = "worklist_orders"

    id_orden = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_institucional = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    apellido = Column(String, nullable=False)
    sexo = Column(String)
    modalidad = Column(String, nullable=False)
    medico_referente = Column(String)
    prioridad = Column(String, default="Rutina")
    accession_number = Column(String, unique=True, index=True, nullable=False)
    estado_ris = Column(String, default="En Espera")
    estado_pacs = Column(String, default="Sin Imágenes")
    fecha_creacion = Column(DateTime, server_default=func.now())