"""
schemas/estudio.py — Esquemas modernos MI_PACS
----------------------------------------------
Esquemas Pydantic para estudios clínicos, alineados con el modelo moderno.
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
from enum import Enum


# ---------------------------------------------------------
# ENUM CLÍNICO DEL ESTADO DEL ESTUDIO
# ---------------------------------------------------------
class EstadoEstudio(str, Enum):
    pendiente = "pendiente"
    en_proceso = "en_proceso"
    finalizado = "finalizado"
    firmado = "firmado"


# ---------------------------------------------------------
# SCHEMA PARA CREAR ESTUDIOS
# ---------------------------------------------------------
class EstudioCreate(BaseModel):
    paciente_id: int = Field(..., description="ID del paciente")
    tipo_estudio: str = Field(..., description="Tipo de estudio (RX, TAC, RM, ECO, etc.)")
    fecha_estudio: date = Field(..., description="Fecha del estudio")
    descripcion: str | None = Field(None, description="Descripción clínica opcional")
    uid: str = Field(..., description="UID único del estudio")


# ---------------------------------------------------------
# SCHEMA PARA ACTUALIZAR ESTUDIOS (opcional)
# ---------------------------------------------------------
class EstudioUpdate(BaseModel):
    tipo_estudio: str | None = None
    fecha_estudio: date | None = None
    descripcion: str | None = None
    estado: EstadoEstudio | None = None


# ---------------------------------------------------------
# SCHEMA PARA LISTAR ESTUDIOS (vista resumida)
# ---------------------------------------------------------
class EstudioListItem(BaseModel):
    id: int
    paciente_id: int
    tipo_estudio: str
    fecha_estudio: date
    estado: EstadoEstudio
    descripcion: str | None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# SCHEMA PARA RESPUESTA COMPLETA DE ESTUDIO
# ---------------------------------------------------------
class EstudioResponse(BaseModel):
    id: int
    paciente_id: int
    tipo_estudio: str
    fecha_estudio: date
    uid: str
    estado: EstadoEstudio
    descripcion: str | None
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)