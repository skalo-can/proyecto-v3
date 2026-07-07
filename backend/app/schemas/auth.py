"""
schemas/auth.py
---------------
Esquemas Pydantic para autenticación en MI_PACS.

Incluye:
- LoginPaciente
- LoginUsuario
- TokenResponse
- UsuarioLoginResponse
- PacienteLoginResponse
- UsuarioCreate
- UsuarioResponse
"""

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import date
from typing import Optional, Dict


# ---------------------------------------------------------
# LOGIN PACIENTE
# ---------------------------------------------------------
class LoginPaciente(BaseModel):
    """Datos necesarios para autenticar a un paciente en el portal MI_PACS."""

    identificacion: str = Field(
        ...,
        example="123456789",
        description="Documento único del paciente"
    )

    fecha_nacimiento: date = Field(
        ...,
        example="1990-05-12",
        description="Fecha de nacimiento del paciente"
    )


# ---------------------------------------------------------
# LOGIN USUARIO CLÍNICO
# ---------------------------------------------------------
class LoginUsuario(BaseModel):
    """Datos necesarios para autenticar a un usuario clínico."""

    email: EmailStr = Field(
        ...,
        example="usuario@mipacs.com",
        description="Correo del usuario clínico"
    )

    password: str = Field(
        ...,
        example="clave_segura_123",
        description="Contraseña en texto plano"
    )


# ---------------------------------------------------------
# TOKEN RESPONSE
# ---------------------------------------------------------
class TokenResponse(BaseModel):
    """Respuesta estándar de autenticación."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(
        ...,
        description="Tiempo de expiración del token en segundos"
    )


# ---------------------------------------------------------
# RESPUESTA LOGIN PACIENTE
# ---------------------------------------------------------
class PacienteLoginResponse(BaseModel):
    """Respuesta enviada al frontend cuando un paciente inicia sesión."""

    token: Optional[TokenResponse] = None
    paciente_id: int
    nombre_completo: str
    activo: bool

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# RESPUESTA LOGIN USUARIO CLÍNICO
# ---------------------------------------------------------
class UsuarioLoginResponse(BaseModel):
    """Respuesta enviada al frontend cuando un usuario clínico inicia sesión."""

    token: Optional[TokenResponse] = None
    usuario_id: int
    nombre: str
    rol: str
    activo: bool
    permisos: Optional[Dict[str, bool]] = {} # Corregido: Ahora viajan al frontend

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# CREAR USUARIO CLÍNICO
# ---------------------------------------------------------
class UsuarioCreate(BaseModel):
    """Datos necesarios para registrar un usuario clínico en MI_PACS."""

    nombre: str = Field(..., example="Administrador del Sistema")
    email: EmailStr = Field(..., example="admin@mipacs.com")
    password: str = Field(..., example="Admin1234!")
    rol: str = Field(..., example="admin")


# ---------------------------------------------------------
# RESPUESTA AL CREAR USUARIO
# ---------------------------------------------------------
class UsuarioResponse(BaseModel):
    """Respuesta enviada al frontend tras registrar un usuario clínico."""

    id: int
    nombre: str
    email: EmailStr
    rol: str
    activo: bool

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )