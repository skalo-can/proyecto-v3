"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes con ordenamiento interactivo multivariable (Python).
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

# 🚀 DEFINICIÓN DEL ROUTER (Declarado arriba de todo para evitar NameError)
router = APIRouter(prefix="/pacientes", tags=["Pacientes"])


# ---------------------------------------------------------
# LISTAR PACIENTES (TABLA PRINCIPAL CON ORDENAMIENTO MULTIVARIABLE)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def listar(
    fechaDesde: str = Query("2010-01-01"),
    fechaHasta: str = Query("2030-12-31"),
    modalidad: str = Query(None),
    busqueda: str = Query(None),
    sort_by: str = Query("fecha"),  # 👈 Parámetros: id, paciente, fecha
    order: str = Query("desc"),     # 👈 Parámetros: asc, desc
    db: Session = Depends(get_db)
):
    """
    Endpoint Core unificado: Trae los pacientes, aplica filtros relacionales PACS
    y procesa un ordenamiento avanzado multivariable en memoria (ID Numérico, Alfabético, Fecha+Hora).
    """
    # 🎯 Hacemos la consulta base uniendo Paciente y Estudio relacionalmente
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

    # 🚀 Recuperamos los registros coincidentes de la Base de Datos de forma segura
    resultados = query.all()
    
    # 📦 CONSTRUCCIÓN DEL JSON HÍBRIDO (Mapeo directo compatible con pacientes.jsx)
    lista_mapeada = []
    for p in resultados:
        # Extraemos los estudios filtrados de este paciente en memoria
        estudios_validos = p.estudios
        if modalidad and modalidad.strip() != "":
            estudios_validos = [e for e in p.estudios if e.tipo_estudio == modalidad.strip()]
            
        if not estudios_validos:
            continue
            
        estudio_principal = estudios_validos[0]
        
        # 🕒 Extracción segura de la hora desde la metadata del estudio
        hora_final = "00:00"
        if hasattr(estudio_principal, "hora_estudio") and estudio_principal.hora_estudio:
            hora_final = estudio_principal.hora_estudio
        elif hasattr(estudio_principal, "dicom_metadata") and estudio_principal.dicom_metadata:
            hora_final = estudio_principal.dicom_metadata.get("StudyTime", "00:00")[:4]
            if len(hora_final) == 4:
                hora_final = f"{hora_final[:2]}:{hora_final[2:]}"
        
        lista_mapeada.append({
            "id": p.id,
            "identificacion": p.identificacion,
            "primer_nombre": p.primer_nombre,
            "primer_apellido": p.primer_apellido,
            "activo": p.activo,
            "sexo": getattr(p, "sexo", "M"),
            "departamento": getattr(p, "departamento", "Radiología"),
            "fecha_estudio": estudio_principal.fecha_estudio.isoformat() if estudio_principal.fecha_estudio else "S/F",
            "tipo_estudio": estudio_principal.tipo_estudio if estudio_principal.tipo_estudio else "CR",
            "hora_estudio": hora_final
        })

    # 🗺️ 4. MATRIZ DE ORDENAMIENTO INTERACTIVO CRONOLÓGICO Y NUMÉRICO REAL
    def obtener_llave_orden(item):
        if sort_by == "id":
            # 🎯 SOLUCIÓN AL ORDEN DE TEXTO: Forzamos la conversión a entero para orden matemático real (1116204315 > 9728484)
            try:
                return int(str(item["identificacion"]).strip())
            except ValueError:
                return str(item["identificacion"]).strip().lower()
        elif sort_by == "nombre":
            return str(item["primer_apellido"]).lower()
        else:
            # 🎯 CRONOLÓGICO: Fusiona Fecha ("2026-06-27") + Hora ("19:50") para crear una estampa temporal unificada
            return f"{item['fecha_estudio']} {item['hora_estudio']}"

    # Aplicamos el algoritmo de ordenamiento nativo de Python (sort)
    es_descendente = (order == "desc")
    lista_mapeada.sort(key=obtener_llave_orden, reverse=es_descendente)
        
    return lista_mapeada


# ---------------------------------------------------------
# ENDPOINTS REST COMPLETOS (CRUD COMPLEMENTARIO COMPLETO)
# ---------------------------------------------------------
@router.post("", response_model=PacienteResponse)
def crear(paciente: PacienteCreate, db: Session = Depends(get_db)):
    return crear_paciente(db=db, paciente=paciente)

@router.get("/{paciente_id}", response_model=PacienteResponse)
def leer(paciente_id: int, db: Session = Depends(get_db)):
    db_paciente = obtener_paciente(db, paciente_id=paciente_id)
    if db_paciente is None:
        raise HTTPException(status_code=404, detail="Paciente no localizado")
    return db_paciente

@router.put("/{paciente_id}", response_model=PacienteResponse)
def actualizar(paciente_id: int, paciente: PacienteUpdate, db: Session = Depends(get_db)):
    return actualizar_paciente(db=db, paciente_id=paciente_id, paciente=paciente)

@router.delete("/{paciente_id}")
def eliminar(paciente_id: int, db: Session = Depends(get_db)):
    return eliminar_paciente(db=db, paciente_id=paciente_id)