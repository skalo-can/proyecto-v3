"""
schemas/usuario.py
------------------
Esquemas Pydantic para usuarios clínicos del sistema MI_PACS.
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from typing import Optional
from enum import Enum


# ---------------------------------------------------------
# ENUM CLÍNICO PARA ROLES
# ---------------------------------------------------------
class RolUsuario(str, Enum):
    medico = "medico"
    admin = "admin"
    tecnico = "tecnico"


# ---------------------------------------------------------
# BASE
# ---------------------------------------------------------
class UsuarioBase(BaseModel):
    """
    Campos clínicos comunes para representar a un usuario del sistema MI_PACS.
    """

    nombre: str = Field(..., example="Dr. Juan Pérez")
    email: EmailStr = Field(..., example="usuario@mipacs.com")
    rol: RolUsuario = Field(
        ...,
        description="Rol del usuario: medico | admin | tecnico"
    )


# ---------------------------------------------------------
# CREATE
# ---------------------------------------------------------
class UsuarioCreate(UsuarioBase):
    """
    Datos necesarios para registrar un usuario clínico.
    La contraseña se recibe en texto plano y se hashea en el servicio.
    """

    password: str = Field(
        ...,
        example="clave_segura_123",
        description="Contraseña en texto plano (se hashea en el servicio)"
    )


# ---------------------------------------------------------
# UPDATE
# ---------------------------------------------------------
class UsuarioUpdate(BaseModel):
    """
    Datos opcionales para actualizar un usuario clínico.
    """

    nombre: Optional[str]
    email: Optional[EmailStr]
    rol: Optional[RolUsuario]


# ---------------------------------------------------------
# RESPONSE
# ---------------------------------------------------------
class UsuarioResponse(UsuarioBase):
    """
    Representación clínica del usuario enviada al frontend.
    No incluye contraseña por razones de seguridad.
    """

    id: int
    activo: bool
    creado_en: datetime
    actualizado_en: datetime

    medico_id: Optional[int] = Field(
        default=None,
        description="ID del médico asociado (si aplica)"
    )

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# LIST ITEM (para tablas)
# ---------------------------------------------------------
class UsuarioListItem(BaseModel):
    """
    Representación resumida del usuario para listados.
    """

    id: int
    nombre: str
    email: EmailStr
    rol: RolUsuario
    activo: bool

    model_config = ConfigDict(from_attributes=True)