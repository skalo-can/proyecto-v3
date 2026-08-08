"""
schemas/estudio.py — Esquemas modernos MI_PACS (BLINDADOS)
----------------------------------------------
Esquemas Pydantic para estudios clínicos, alineados con el modelo moderno.
Incluye protección contra inyección de código (XSS/LFI) para PDFs.
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import date, datetime
from enum import Enum
import re


# ---------------------------------------------------------
# ENUM CLÍNICO DEL ESTADO DEL ESTUDIO
# ---------------------------------------------------------
class EstadoEstudio(str, Enum):
    pendiente = "pendiente"
    en_proceso = "en_proceso"
    finalizado = "finalizado"
    firmado = "firmado"


# ---------------------------------------------------------
# FUNCIÓN AUXILIAR DE SEGURIDAD (ANTI-XSS)
# ---------------------------------------------------------
def detectar_html_peligroso(texto: str | None) -> str | None:
    """Verifica que el texto no contenga etiquetas HTML que puedan comprometer la generación del PDF"""
    if texto:
        # Busca etiquetas peligrosas que los atacantes usan para inyectar código
        patron_peligroso = r'<(script|iframe|object|embed|form|html|body|link|meta)[^>]*>'
        if re.search(patron_peligroso, texto, re.IGNORECASE):
            raise ValueError("Seguridad clínica: No se permiten scripts ni etiquetas HTML en este campo.")
    return texto


# ---------------------------------------------------------
# SCHEMA PARA CREAR ESTUDIOS
# ---------------------------------------------------------
class EstudioCreate(BaseModel):
    paciente_id: int = Field(..., description="ID del paciente")
    tipo_estudio: str = Field(..., description="Tipo de estudio (RX, TAC, RM, ECO, etc.)")
    fecha_estudio: date = Field(..., description="Fecha del estudio")
    descripcion: str | None = Field(None, description="Descripción clínica opcional")
    uid: str = Field(..., description="UID único del estudio")

    # 🛡️ Aplicamos el filtro de seguridad a los campos de texto
    @field_validator('descripcion', 'tipo_estudio')
    @classmethod
    def validar_seguridad_textos(cls, value):
        return detectar_html_peligroso(value)


# ---------------------------------------------------------
# SCHEMA PARA ACTUALIZAR ESTUDIOS (opcional)
# ---------------------------------------------------------
class EstudioUpdate(BaseModel):
    tipo_estudio: str | None = None
    fecha_estudio: date | None = None
    descripcion: str | None = None
    estado: EstadoEstudio | None = None

    # 🛡️ Aplicamos el filtro de seguridad a los campos de texto
    @field_validator('descripcion', 'tipo_estudio')
    @classmethod
    def validar_seguridad_textos_update(cls, value):
        return detectar_html_peligroso(value)


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