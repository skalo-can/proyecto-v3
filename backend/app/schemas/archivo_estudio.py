"""
schemas/archivo_estudio.py
--------------------------
Esquemas Pydantic para archivos asociados a un estudio clínico
dentro del sistema MI_PACS.
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------
# SCHEMA BASE
# ---------------------------------------------------------
class ArchivoEstudioBase(BaseModel):
    """
    Campos comunes para representar un archivo asociado a un estudio.
    """

    nombre_archivo: str = Field(
        ...,
        description="Nombre del archivo físico"
    )

    ruta_archivo: str = Field(
        ...,
        description="Ruta relativa dentro de /static"
    )

    tipo: Optional[str] = Field(
        default=None,
        example="pdf",
        description="Extensión del archivo"
    )


# ---------------------------------------------------------
# CREATE
# ---------------------------------------------------------
class ArchivoEstudioCreate(ArchivoEstudioBase):
    """
    Datos necesarios para registrar un archivo asociado a un estudio.
    """

    estudio_id: int = Field(
        ...,
        description="ID del estudio al que pertenece el archivo"
    )


# ---------------------------------------------------------
# RESPONSE
# ---------------------------------------------------------
class ArchivoEstudioResponse(ArchivoEstudioBase):
    """
    Representación clínica completa del archivo enviada al frontend.
    """

    id: int
    estudio_id: int

    # Nuevos campos del modelo SQLAlchemy
    creado_en: datetime
    actualizado_en: datetime

    # Campo derivado para el frontend
    url: Optional[str] = Field(
        default=None,
        example="http://127.0.0.1:8000/static/archivos/estudio_1.pdf",
        description="URL absoluta del archivo"
    )

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# LIST ITEM (para tablas)
# ---------------------------------------------------------
class ArchivoEstudioListItem(BaseModel):
    """
    Representación resumida del archivo para listados.
    """

    id: int
    estudio_id: int
    nombre_archivo: str
    tipo: Optional[str]

    model_config = ConfigDict(from_attributes=True)