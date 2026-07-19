"""
dicom_config.py — Schemas clínicos para configuración DICOM
------------------------------------------------------------
"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional

# ==========================================
# CONFIGURACIÓN GLOBAL (PACS)
# ==========================================
class DicomConfigBase(BaseModel):
    ae_title: str
    ip: str
    port: int
    client_ae: str

class DicomConfigUpdate(DicomConfigBase):
    pass

class DicomConfigResponse(DicomConfigBase):
    id: int
    model_config = ConfigDict(from_attributes=True) 

# ==========================================
# ESTACIONES DE DIAGNÓSTICO (NODOS DICOM)
# ==========================================
class NodoDicomBase(BaseModel):
    nombre: str
    ae_title: str
    ip: str
    puerto: str
    auto_envio: bool = False
    activo: bool = True
    modalidades: List[str] = []

class NodoDicomCreate(NodoDicomBase):
    pass

class NodoDicomUpdate(NodoDicomBase):
    pass

class NodoDicomResponse(NodoDicomBase):
    id: int
    model_config = ConfigDict(from_attributes=True)