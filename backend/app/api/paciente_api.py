"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes.
Compatible con:
- Pacientes creados manualmente
- Pacientes creados automáticamente desde DICOM
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from app.core.database import get_db
from app.models.paciente import Paciente
from app.models.estudio import Estudio  # 🛡️ Inyección relacional para la consulta dinámica

from app.schemas.paciente import (
    PacienteCreate,
    PacienteUpdate,
    PacienteResponse
)
from app.services.paciente_service import (
    crear_paciente,
    crear_paciente_desde_dicom,
    obtener_paciente,
    obtener_paciente_por_identificacion,
    actualizar_paciente,
    eliminar_paciente
)

# 🔥 CORREGIDO: ya no duplicamos /api
router = APIRouter(prefix="/pacientes", tags=["Pacientes"])


# ---------------------------------------------------------
# LISTAR PACIENTES (TABLA PRINCIPAL CON JOIN RELACIONAL)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def listar(
    fechaDesde: str = Query("2010-01-01"),
    fechaHasta: str = Query("2030-12-31"),
    modalidad: str = Query(None),
    busqueda: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint Core unificado: Realiza un JOIN relacional dinámico para filtrar
    por parámetros PACS (Fecha y Modalidad) y armar el JSON esperado por React.
    """
    # 🎯 Unimos la tabla Paciente con Estudio en una sola consulta relacional
    query = db.query(Paciente).join(Estudio)
    
    # 1. Filtro estricto por rango de fechas de captura del estudio
    try:
        f_desde = date.fromisoformat(fechaDesde)
        f_hasta = date.fromisoformat(fechaHasta)
        query = query.filter(Estudio.fecha_estudio >= f_desde, Estudio.fecha_estudio <= f_hasta)
    except Exception as e:
        print(f"⚠️ Formato de fecha inválido recibido en el query, se omite: {e}")

    # 2. Filtro dinámico por Modalidad DICOM (CT, CR, MR, etc.)
    if modalidad and modalidad.strip() != "":
        query = query.filter(Estudio.tipo_estudio == modalidad.strip())

    # 3. Filtro de búsqueda rápida por Identificación o Apellidos del Paciente
    if busqueda and busqueda.strip() != "":
        termino = f"%{busqueda.strip()}%"
        query = query.filter(
            (Paciente.primer_apellido.ilike(termino)) | 
            (Paciente.identificacion.like(termino))
        )

    # Ordenamos de forma descendente para ver los últimos estudios subidos al principio
    resultados = query.order_by(Paciente.id.desc()).all()
    
    # 📦 CONSTRUCCIÓN DEL JSON HÍBRIDO (Mapeo directo compatible con pacientes.jsx)
    lista_mapeada = []
    for p in resultados:
        # Extraemos los estudios filtrados de este paciente en memoria
        estudios_validos = p.estudios
        if modalidad and modalidad.strip() != "":
            estudios_validos = [e for e in p.estudios if e.tipo_estudio == modalidad.strip()]
            
        # Si por alguna razón el paciente no tiene estudios en ese filtro, pasamos al siguiente
        if not estudios_validos:
            continue
            
        estudio_principal = estudios_validos[0]
        
        lista_mapeada.append({
            "id": p.id,
            "identificacion": p.identificacion,
            "primer_nombre": p.primer_nombre,
            "primer_apellido": p.primer_apellido,
            "activo": p.activo,
            "sexo": getattr(p, "sexo", "M"),  # Fallback seguro si no está en la base de datos
            "departamento": getattr(p, "departamento", "Radiología"),
            # 🟢 AQUÍ NACEN LOS DATOS QUE ALIMENTAN LA PANTALLA:
            "fecha_estudio": estudio_principal.fecha_estudio.isoformat() if estudio_principal.fecha_estudio else "S/F",
            "tipo_estudio": estudio_principal.tipo_estudio if estudio_principal.tipo_estudio else "CR"
        })
        
    return lista_mapeada


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