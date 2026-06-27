"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes.
Compatible con:
- Pacientes creados manualmente
- Pacientes creados automáticamente desde DICOM
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
<<<<<<< HEAD
=======
from sqlalchemy import asc, desc  # 👈 Importante para el ordenamiento interactivo
>>>>>>> development
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
<<<<<<< HEAD
=======
    sort_by: str = Query("fecha"),  # 👈 Parámetro dinámico de React (id, paciente, fecha)
    order: str = Query("desc"),     # 👈 Parámetro dinámico de React (asc, desc)
>>>>>>> development
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
<<<<<<< HEAD

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
=======
>>>>>>> development

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

    # 🗺️ 4. MATRIZ DE ORDENAMIENTO DINÁMICO INTERACTIVO
    mapa_columnas = {
        "id": Paciente.identificacion,
        "paciente": Paciente.primer_apellido,
        "fecha": Estudio.fecha_estudio
    }
    
    # Si viene un parámetro inválido, el fallback por defecto es ordenar por fecha del estudio
    columna_objetivo = mapa_columnas.get(sort_by, Estudio.fecha_estudio)
    
    if order == "asc":
        query = query.order_by(asc(columna_objetivo))
    else:
        query = query.order_by(desc(columna_objetivo))

    resultados = query.all()
    
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
        
        # 🕒 Extracción segura de la hora desde la metadata del estudio
        # Si tu base de datos tiene la columna "hora_estudio" la lee, de lo contrario devuelve el tag DICOM o "00:00"
        hora_final = "00:00"
        if hasattr(estudio_principal, "hora_estudio") and estudio_principal.hora_estudio:
            hora_final = estudio_principal.hora_estudio
        elif hasattr(estudio_principal, "dicom_metadata") and estudio_principal.dicom_metadata:
            # Revisa si se guardó en el JSON de metadatos clínicos
            hora_final = estudio_principal.dicom_metadata.get("StudyTime", "00:00")[:4]
            if len(hora_final) == 4:
                hora_final = f"{hora_final[:2]}:{hora_final[2:]}"
        
        lista_mapeada.append({
            "id": p.id,
            "identificacion": p.identificacion,
            "primer_nombre": p.primer_nombre,
            "primer_apellido": p.primer_apellido,
            "activo": p.activo,
            "sexo": getattr(p, "sexo", "M"),  # Fallback seguro si no está en la base de datos
            "departamento": getattr(p, "departamento", "Radiología"),
            "fecha_estudio": estudio_principal.fecha_estudio.isoformat() if estudio_principal.fecha_estudio else "S/F",
            "tipo_estudio": estudio_principal.tipo_estudio if estudio_principal.tipo_estudio else "CR",
            "hora_estudio": hora_final  # 👈 ¡INYECTADO AL FRONTEND CON TOTAL SEGURIDAD!
        })
        
    return lista_mapeada