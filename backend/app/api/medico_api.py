"""
medico_api.py
-------------
Endpoints clínicos para la gestión de médicos dentro del sistema MI_PACS.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.schemas.medico import (
    MedicoCreate,
    MedicoResponse,
    MedicoUpdate,
    MedicoListItem
)

from app.models.usuario import Usuario
from app.services.medico_service import (
    crear_medico,
    listar_medicos,
    obtener_medico,
    actualizar_medico,
)


router = APIRouter(prefix="/medicos", tags=["Médicos"])


# ---------------------------------------------------------
# CREAR MÉDICO (solo admin)
# ---------------------------------------------------------
@router.post("/", response_model=MedicoResponse)
def crear_medico_endpoint(
    data: MedicoCreate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    # Validar que el usuario exista
    user = db.query(Usuario).filter(Usuario.id == data.usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # Validar que el usuario tenga rol médico
    if user.rol != "medico":
        raise HTTPException(
            status_code=400,
            detail="El usuario no tiene rol médico."
        )

    # Validar que no tenga ya un médico asociado
    if user.medico:
        raise HTTPException(
            status_code=400,
            detail="Este usuario ya tiene un perfil de médico asociado."
        )

    return crear_medico(db, data)


# ---------------------------------------------------------
# LISTAR MÉDICOS (admin y médicos)
# ---------------------------------------------------------
@router.get("/", response_model=list[MedicoListItem])
def listar_medicos_endpoint(
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    requiere_rol(usuario, ["admin", "medico"])
    return listar_medicos(db, skip, limit)


# ---------------------------------------------------------
# OBTENER MÉDICO POR ID
# ---------------------------------------------------------
@router.get("/{medico_id}", response_model=MedicoResponse)
def obtener_medico_endpoint(
    medico_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    medico = obtener_medico(db, medico_id)

    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado.")

    # Técnicos pueden ver médicos
    # Médicos pueden ver médicos
    # Admin puede ver médicos
    requiere_rol(usuario, ["admin", "medico", "tecnico"])

    return medico


# ---------------------------------------------------------
# ACTUALIZAR MÉDICO (solo admin)
# ---------------------------------------------------------
@router.put("/{medico_id}", response_model=MedicoResponse)
def actualizar_medico_endpoint(
    medico_id: int,
    data: MedicoUpdate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin"])

    medico = actualizar_medico(db, medico_id, data)
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado.")

    return medico