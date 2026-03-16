"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes.
Compatible con:
- Pacientes creados manualmente
- Pacientes creados automáticamente desde DICOM
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.paciente import (
    PacienteCreate,
    PacienteUpdate,
    PacienteResponse,
    PacienteListItem
)
from app.services.paciente_service import (
    crear_paciente,
    crear_paciente_desde_dicom,
    obtener_paciente,
    obtener_paciente_por_identificacion,
    listar_pacientes,
    actualizar_paciente,
    eliminar_paciente
)

# 🔥 CORREGIDO: ya no duplicamos /api
router = APIRouter(prefix="/pacientes", tags=["Pacientes"])


# ---------------------------------------------------------
# LISTAR PACIENTES (TABLA PRINCIPAL)
# ---------------------------------------------------------
@router.get("", response_model=list[PacienteListItem])
@router.get("/", response_model=list[PacienteListItem])
def listar(limit: int = 50, db: Session = Depends(get_db)):
    pacientes = listar_pacientes(db, limit)
    return pacientes


# ---------------------------------------------------------
# OBTENER PACIENTE POR ID
# ---------------------------------------------------------
@router.get("/{paciente_id}", response_model=PacienteResponse)
def obtener(paciente_id: int, db: Session = Depends(get_db)):
    paciente = obtener_paciente(db, paciente_id)
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return paciente


# ---------------------------------------------------------
# CREAR PACIENTE MANUAL (FRONTEND)
# ---------------------------------------------------------
@router.post("/", response_model=PacienteResponse)
def crear(data: PacienteCreate, db: Session = Depends(get_db)):
    nuevo = crear_paciente(db, data)
    return nuevo


# ---------------------------------------------------------
# CREAR PACIENTE DESDE DICOM (AUTOMÁTICO)
# ---------------------------------------------------------
@router.post("/dicom", response_model=PacienteResponse)
def crear_dicom(identificacion: str, nombre_completo: str, db: Session = Depends(get_db)):
    existente = obtener_paciente_por_identificacion(db, identificacion)
    if existente:
        return existente

    nuevo = crear_paciente_desde_dicom(db, identificacion, nombre_completo)
    return nuevo


# ---------------------------------------------------------
# ACTUALIZAR PACIENTE
# ---------------------------------------------------------
@router.put("/{paciente_id}", response_model=PacienteResponse)
def actualizar(paciente_id: int, data: PacienteUpdate, db: Session = Depends(get_db)):
    paciente = actualizar_paciente(db, paciente_id, data)
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return paciente


# ---------------------------------------------------------
# ELIMINAR PACIENTE (LÓGICO)
# ---------------------------------------------------------
@router.delete("/{paciente_id}")
def eliminar(paciente_id: int, db: Session = Depends(get_db)):
    ok = eliminar_paciente(db, paciente_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return {"mensaje": "Paciente eliminado correctamente"}