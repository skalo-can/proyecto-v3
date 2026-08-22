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
    fecha_estudio: datetime = Field(..., description="Fecha y hora del estudio") # 🔥 MODIFICADO a datetime
    descripcion: str | None = Field(None, description="Descripción clínica opcional")
    institucion: str | None = Field("Desconocida", description="Institución de origen") # 🔥 NUEVO
    uid: str = Field(..., description="UID único del estudio")

    # 🛡️ Aplicamos el filtro de seguridad a los campos de texto
    @field_validator('descripcion', 'tipo_estudio', 'institucion') # 🔥 Agregada la institución al validador
    @classmethod
    def validar_seguridad_textos(cls, value):
        return detectar_html_peligroso(value)


# ---------------------------------------------------------
# SCHEMA PARA ACTUALIZAR ESTUDIOS (opcional)
# ---------------------------------------------------------
class EstudioUpdate(BaseModel):
    tipo_estudio: str | None = None
    fecha_estudio: datetime | None = None # 🔥 MODIFICADO a datetime
    descripcion: str | None = None
    institucion: str | None = None # 🔥 NUEVO
    estado: EstadoEstudio | None = None

    # 🛡️ Aplicamos el filtro de seguridad a los campos de texto
    @field_validator('descripcion', 'tipo_estudio', 'institucion') # 🔥 Agregada la institución al validador
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
    fecha_estudio: datetime # 🔥 MODIFICADO a datetime
    estado: EstadoEstudio
    descripcion: str | None
    institucion: str | None # 🔥 NUEVO
    prioridad_ia: str | None = "NORMAL"

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# SCHEMA PARA RESPUESTA COMPLETA DE ESTUDIO
# ---------------------------------------------------------
class EstudioResponse(BaseModel):
    id: int
    paciente_id: int
    tipo_estudio: str
    fecha_estudio: datetime # 🔥 MODIFICADO a datetime
    uid: str
    estado: EstadoEstudio
    descripcion: str | None
    institucion: str | None # 🔥 NUEVO
    creado_en: datetime
    actualizado_en: datetime
    prioridad_ia: str | None = "NORMAL"

    model_config = ConfigDict(from_attributes=True)