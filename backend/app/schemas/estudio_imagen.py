"""
schemas/estudio_imagen.py
-------------------------
Esquemas Pydantic para las imágenes asociadas a un estudio clínico
dentro del sistema MI_PACS.
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------
# BASE: Campos comunes almacenados en la base de datos
# ---------------------------------------------------------
class EstudioImagenBase(BaseModel):
    """
    Campos clínicos comunes para representar una imagen asociada
    a un estudio dentro de MI_PACS.
    """

    ruta_archivo: str = Field(
        ...,
        description="Ruta física del archivo almacenado (static/dicoms/...)"
    )

    dicom_metadata: Optional[dict] = Field(
        default=None,
        description="Metadata DICOM serializada como JSON"
    )

    thumbnail: Optional[str] = Field(
        default=None,
        description="Ruta a la miniatura generada (si aplica)"
    )


# ---------------------------------------------------------
# CREATE: Datos necesarios para registrar una imagen
# ---------------------------------------------------------
class EstudioImagenCreate(EstudioImagenBase):
    """
    Datos necesarios para registrar una imagen asociada a un estudio.
    """

    estudio_id: int = Field(
        ...,
        description="ID del estudio al que pertenece la imagen"
    )


# ---------------------------------------------------------
# RESPONSE: Datos enviados al frontend MI_PACS
# ---------------------------------------------------------
class EstudioImagenResponse(BaseModel):
    """
    Representación clínica completa de una imagen asociada a un estudio.
    """

    id: int
    estudio_id: int

    ruta_archivo: str
    dicom_metadata: Optional[dict]
    thumbnail: Optional[str]
    fecha_subida: Optional[datetime]

    # Nuevos campos del modelo SQLAlchemy
    creado_en: datetime
    actualizado_en: datetime

    # -----------------------------------------------------
    # Campos derivados clínicos (NO existen en la base)
    # -----------------------------------------------------
    tipo: Optional[str] = Field(
        default=None,
        example="dcm",
        description="Extensión del archivo (dcm, jpg, png)"
    )

    nombre_archivo: Optional[str] = Field(
        default=None,
        example="rx_torax_1.dcm",
        description="Nombre del archivo físico"
    )

    url: Optional[str] = Field(
        default=None,
        example="http://192.168.5.21:8000/static/dicoms/rx_torax_1.dcm",
        description="URL absoluta para el frontend"
    )

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# LIST ITEM (para tablas)
# ---------------------------------------------------------
class EstudioImagenListItem(BaseModel):
    """
    Representación resumida de una imagen para listados.
    """

    id: int
    estudio_id: int
    ruta_archivo: str
    thumbnail: Optional[str]

    model_config = ConfigDict(from_attributes=True)