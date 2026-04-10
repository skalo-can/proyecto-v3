from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RISOrdenCreate(BaseModel):
    id_institucional: str
    nombre: str
    apellido: str
    sexo: Optional[str] = None
    modalidad: str
    medico_referente: Optional[str] = None
    prioridad: str = "Rutina"

class RISOrdenResponse(RISOrdenCreate):
    id_orden: int
    accession_number: str
    estado_ris: str
    estado_pacs: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True