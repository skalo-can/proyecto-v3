"""
usuario_api.py
--------------
Endpoints clínicos para la gestión de usuarios dentro del sistema MI_PACS.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
    UsuarioListItem
)
from app.models.usuario import Usuario

from app.services.usuario_service import (
    crear_usuario,
    listar_usuarios,
    obtener_usuario,
    actualizar_usuario,
    cambiar_estado_usuario,
)


router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


# ---------------------------------------------------------
# CREAR USUARIO CLÍNICO (solo admin)
# ---------------------------------------------------------
@router.post("/", response_model=UsuarioResponse)
def crear_usuario_endpoint(
    data: UsuarioCreate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    existente = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario con este email."
        )

    return crear_usuario(db, data)


# ---------------------------------------------------------
# LISTAR USUARIOS (solo admin)
# ---------------------------------------------------------
@router.get("/", response_model=list[UsuarioListItem])
def listar_usuarios_endpoint(
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    requiere_rol(usuario, ["admin"])
    return listar_usuarios(db, skip, limit)


# ---------------------------------------------------------
# OBTENER USUARIO POR ID (admin o el propio usuario)
# ---------------------------------------------------------
@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obtener_usuario_endpoint(
    usuario_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    user = obtener_usuario(db, usuario_id)

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # Pacientes no deberían estar aquí, pero por seguridad:
    if usuario.rol != "admin" and usuario.id != usuario_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    return user


# ---------------------------------------------------------
# ACTUALIZAR USUARIO (solo admin)
# ---------------------------------------------------------
@router.put("/{usuario_id}", response_model=UsuarioResponse)
def actualizar_usuario_endpoint(
    usuario_id: int,
    data: UsuarioUpdate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    user = actualizar_usuario(db, usuario_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    return user


# ---------------------------------------------------------
# ACTIVAR / DESACTIVAR USUARIO (solo admin)
# ---------------------------------------------------------
@router.patch("/{usuario_id}/estado", response_model=UsuarioResponse)
def cambiar_estado_usuario_endpoint(
    usuario_id: int,
    activo: bool,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    user = cambiar_estado_usuario(db, usuario_id, activo)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    return user