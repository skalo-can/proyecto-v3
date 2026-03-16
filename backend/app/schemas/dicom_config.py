"""
dicom_config.py — Schemas clínicos para configuración DICOM
------------------------------------------------------------

Define los modelos Pydantic usados para:
- Obtener configuración DICOM
- Actualizar configuración DICOM
- Probar conectividad C‑ECHO
"""

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------
# BASE
# ---------------------------------------------------------
class DicomConfigBase(BaseModel):
    ae_title: str
    ip: str
    port: int
    client_ae: str


# ---------------------------------------------------------
# PARA CREAR / ACTUALIZAR
# ---------------------------------------------------------
class DicomConfigUpdate(DicomConfigBase):
    """Schema clínico para actualizar configuración DICOM."""
    pass


# ---------------------------------------------------------
# RESPUESTA COMPLETA
# ---------------------------------------------------------
class DicomConfigResponse(DicomConfigBase):
    id: int

    model_config = ConfigDict(from_attributes=True)