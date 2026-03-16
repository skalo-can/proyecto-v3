"""
schemas/medico.py
-----------------
Esquemas Pydantic para médicos registrados en MI_PACS.
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------
# BASE
# ---------------------------------------------------------
class MedicoBase(BaseModel):
    """
    Campos clínicos comunes para representar a un médico.
    """

    usuario_id: int = Field(..., description="ID del usuario asociado")
    especialidad: Optional[str] = Field(
        default=None,
        example="Radiología",
        description="Especialidad médica del profesional"
    )
    numero_licencia: Optional[str] = Field(
        default=None,
        example="RM-12345",
        description="Número de licencia profesional"
    )


# ---------------------------------------------------------
# CREATE
# ---------------------------------------------------------
class MedicoCreate(MedicoBase):
    """
    Datos necesarios para registrar un médico.
    """
    pass


# ---------------------------------------------------------
# UPDATE
# ---------------------------------------------------------
class MedicoUpdate(BaseModel):
    """
    Datos opcionales para actualizar un médico.
    """

    especialidad: Optional[str]
    numero_licencia: Optional[str]


# ---------------------------------------------------------
# RESPONSE
# ---------------------------------------------------------
class MedicoResponse(MedicoBase):
    """
    Representación clínica del médico enviada al frontend.
    """

    id: int
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# LIST ITEM (para tablas)
# ---------------------------------------------------------
class MedicoListItem(BaseModel):
    """
    Representación resumida del médico para listados.
    """

    id: int
    usuario_id: int
    especialidad: Optional[str]
    numero_licencia: Optional[str]

    model_config = ConfigDict(from_attributes=True)