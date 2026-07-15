"""
schemas/usuario.py
------------------
Esquemas Pydantic para usuarios clínicos del sistema MI_PACS.
Sincronizado con el modelo SQLAlchemy para evitar errores de validación.
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from typing import Optional, Dict


# ---------------------------------------------------------
# BASE
# ---------------------------------------------------------
class UsuarioBase(BaseModel):
    """
    Campos clínicos comunes para representar a un usuario del sistema MI_PACS.
    """
    nombre: str = Field(..., example="Dr. Juan Pérez")
    # Email como Opcional y str para evitar fallos si el reset crea correos simples
    email: Optional[str] = Field(None, example="usuario@mipacs.com")
    username: str = Field(..., example="skalo_maestro")
    rol: str = Field(..., description="Rol: superadmin | admin | tecnologo | radiologo | medico | recepcion")
    
    # 🔥 NUEVOS CAMPOS APROBADOS POR EL "CADENERO"
    registro_medico: Optional[str] = Field(None, example="RM-12345")
    es_urgenciologo: bool = Field(default=False, description="Flag para habilitar el flujo Fast-Track de Urgencias")


# ---------------------------------------------------------
# CREATE
# ---------------------------------------------------------
class UsuarioCreate(UsuarioBase):
    """
    Datos necesarios para registrar un usuario clínico.
    """
    password: str = Field(..., example="clave_segura_123")
    permisos: Optional[Dict[str, bool]] = {}


# ---------------------------------------------------------
# UPDATE
# ---------------------------------------------------------
class UsuarioUpdate(BaseModel):
    """
    Datos opcionales para actualizar un usuario clínico.
    """
    nombre: Optional[str] = None
    email: Optional[str] = None
    rol: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    permisos: Optional[Dict[str, bool]] = None
    registro_medico: Optional[str] = None
    es_urgenciologo: Optional[bool] = None


# ---------------------------------------------------------
# RESPONSE (Para el perfil individual)
# ---------------------------------------------------------
class UsuarioResponse(UsuarioBase):
    """
    Representación clínica completa enviada al frontend.
    """
    id: int
    is_active: bool  # Sincronizado con el modelo SQLAlchemy
    permisos: Optional[Dict[str, bool]] = {}
    creado_en: Optional[datetime] = None
    actualizado_en: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )


# ---------------------------------------------------------
# LIST ITEM (Para la tabla de Gestión de Usuarios)
# ---------------------------------------------------------
class UsuarioListItem(BaseModel):
    """
    Representación resumida del usuario para listados administrativos.
    Soluciona el error de validación al usar 'is_active'.
    """
    id: int
    nombre: str
    username: str
    email: Optional[str] = None
    rol: str
    is_active: bool  # <--- CRÍTICO: Debe ser is_active para que la tabla cargue
    permisos: Optional[Dict[str, bool]] = {}
    
    # 🔥 AQUI ESTABA EL BLOQUEO: Agregamos los campos para que lleguen a la tabla de React
    registro_medico: Optional[str] = None
    es_urgenciologo: bool = False

    model_config = ConfigDict(from_attributes=True)