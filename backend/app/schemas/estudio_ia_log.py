"""
schemas/estudio_ia_log.py
-------------------------
Esquemas Pydantic para los registros de auditoría IA dentro de MI_PACS.

Incluye:
- EstudioIALogCreate: datos necesarios para registrar una solicitud IA
- EstudioIALogResponse: datos devueltos al frontend
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------
# SCHEMA: CREAR LOG IA
# ---------------------------------------------------------
class EstudioIALogCreate(BaseModel):
    """
    Datos necesarios para registrar una solicitud IA.
    """

    estudio_id: int = Field(
        ...,
        description="ID del estudio clínico analizado"
    )

    medico_id: int = Field(
        ...,
        description="ID del médico que solicitó el análisis IA"
    )

    resultado_ia: Optional[dict] = Field(
        default=None,
        description="Resultado IA serializado como JSON"
    )


# ---------------------------------------------------------
# SCHEMA: RESPUESTA AL FRONTEND
# ---------------------------------------------------------
class EstudioIALogResponse(BaseModel):
    """
    Representación clínica del registro IA enviada al frontend.
    """

    id: int
    estudio_id: int
    medico_id: Optional[int]

    fecha_solicitud: datetime
    resultado_ia: Optional[dict]

    # Nuevos campos del modelo SQLAlchemy
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )