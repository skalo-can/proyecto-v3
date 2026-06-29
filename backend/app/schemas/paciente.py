"""
schemas/paciente.py
-------------------
Esquemas Pydantic para la gestión de pacientes dentro del sistema MI_PACS.
Incluye:
- Paciente clínico completo (frontend)
- Paciente creado desde DICOM (flujo automático)
- Esquema de control de flujo administrativo para re-dictado Maestro.
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import date, datetime
from typing import Optional


# ---------------------------------------------------------
# SCHEMA BASE (PACIENTE CLÍNICO COMPLETO)
# ---------------------------------------------------------
class PacienteBase(BaseModel):
    """
    Campos clínicos comunes para la representación de un paciente.
    Usado por el frontend para registro manual.
    """

    identificacion: str = Field(..., example="123456789")
    primer_nombre: str = Field(..., example="Juan")
    segundo_nombre: Optional[str] = Field(default=None, example="Carlos")
    primer_apellido: str = Field(..., example="Pérez")
    segundo_apellido: Optional[str] = Field(default=None, example="Gómez")

    fecha_nacimiento: date = Field(..., example="1990-05-12")

    email: Optional[EmailStr] = Field(
        default=None,
        example="paciente@correo.com",
        description="Correo electrónico del paciente"
    )

    # 📱 Campo inyectado para integraciones de SMS / WhatsApp
    telefono: Optional[str] = Field(
        default=None,
        example="+573001234567",
        description="Número de teléfono celular para alertas automatizadas"
    )


# ---------------------------------------------------------
# SCHEMA: CREAR PACIENTE (FRONTEND)
# ---------------------------------------------------------
class PacienteCreate(PacienteBase):
    """
    Datos necesarios para registrar un nuevo paciente manualmente.
    """

    password: str = Field(
        ...,
        example="mi_clave_segura",
        description="Contraseña en texto plano (solo para creación)"
    )


# ---------------------------------------------------------
# SCHEMA: CREAR PACIENTE DESDE DICOM (AUTOMÁTICO)
# ---------------------------------------------------------
class PacienteFromDICOM(BaseModel):
    """
    Paciente creado automáticamente desde metadata DICOM.
    No requiere nombres separados, email, password ni fecha real.
    """

    identificacion: str = Field(..., example="DICOM12345")
    nombre_completo: str = Field(..., example="JUAN PEREZ")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# SCHEMA: ACTUALIZAR PACIENTE
# ---------------------------------------------------------
class PacienteUpdate(BaseModel):
    """
    Datos opcionales para actualizar un paciente existente.
    """

    primer_nombre: Optional[str] = None
    segundo_nombre: Optional[str] = None
    primer_apellido: Optional[str] = None
    segundo_apellido: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None  # 👈 Inyectado para permitir actualizaciones en el modal
    fecha_nacimiento: Optional[date] = None


# ---------------------------------------------------------
# SCHEMA: RESPUESTA AL FRONTEND
# ---------------------------------------------------------
class PacienteResponse(BaseModel):
    """
    Representación clínica del paciente enviada al frontend MI_PACS.
    No incluye contraseña por razones de seguridad.
    """

    id: int
    identificacion: str

    primer_nombre: Optional[str]
    segundo_nombre: Optional[str]
    primer_apellido: Optional[str]
    segundo_apellido: Optional[str]

    fecha_nacimiento: Optional[date]
    email: Optional[EmailStr]
    telefono: Optional[str]  # 👈 Inyectado para que el GET exponga el teléfono al frontend

    activo: bool
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# SCHEMA: LISTA DE PACIENTES (TABLAS)
# ---------------------------------------------------------
class PacienteListItem(BaseModel):
    """
    Representación resumida del paciente para listados.
    Compatible con pacientes creados desde DICOM.
    """

    id: int
    identificacion: str
    primer_nombre: Optional[str]
    primer_apellido: Optional[str]
    activo: bool

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# 🛡️ NUEVO SCHEMA: CONTROL DE FLUJO PARA ESTUDIOS DEL PACIENTE
# ---------------------------------------------------------
class PacienteFlujoAdminUpdate(BaseModel):
    """
    DTO Maestro para que el Administrador o SuperUsuario pueda cambiar el estado 
    operativo de los estudios históricos y permitir el re-dictado médico.
    """
    forzar_estado_proceso: bool = Field(
        default=True, 
        description="Si es True, altera el flujo clínico para marcar el informe como pendiente y reactivar el micrófono."
    )