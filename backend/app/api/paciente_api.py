"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes con ordenamiento interactivo multivariable (Python).
Optimizado con controladores de excepción CORS para el Modo Maestro y control de flujo de re-dictado.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date

from app.core.database import get_db
from app.models.paciente import Paciente
from app.models.estudio import Estudio  # 🛡️ Inyección relacional para la consulta dinámica

from app.schemas.paciente import (
    PacienteCreate,
    PacienteUpdate,
    PacienteResponse,
    PacienteFlujoAdminUpdate  # 🚀 Nuevo esquema inyectado para control operativo
)
from app.services.paciente_service import (
    crear_paciente,
    crear_paciente_desde_dicom,
    obtener_paciente,
    obtener_paciente_por_identificacion,
    actualizar_paciente,
    eliminar_paciente
)

# 🚀 DEFINICIÓN DEL ROUTER
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
    sort_by: str = Query("fecha"),  
    order: str = Query("desc"),     
    db: Session = Depends(get_db)
):
    """
    Endpoint Core unificado con inyección de estados de adjuntos y flujo clínico del Radiólogo.
    """
    query = db.query(Paciente).join(Estudio)
    
    try:
        f_desde = date.fromisoformat(fechaDesde)
        f_hasta = date.fromisoformat(fechaHasta)
        query = query.filter(Estudio.fecha_estudio >= f_desde, Estudio.fecha_estudio <= f_hasta)
    except Exception as e:
        print(f"⚠️ Formato de fecha inválido: {e}")

    if modalidad and modalidad.strip() != "":
        query = query.filter(Estudio.tipo_estudio == modalidad.strip())

    if busqueda and busqueda.strip() != "":
        termino = f"%{busqueda.strip()}%"
        query = query.filter(
            (Paciente.primer_apellido.ilike(termino)) | 
            (Paciente.identificacion.like(termino))
        )

    resultados = query.all()
    lista_mapeada = []

    for p in resultados:
        estudios_validos = p.estudios
        if modalidad and modalidad.strip() != "":
            estudios_validos = [e for e in p.estudios if e.tipo_estudio == modalidad.strip()]
            
        if not estudios_validos:
            continue
            
        estudio_principal = estudios_validos[0]
        
        hora_final = "00:00"
        if hasattr(estudio_principal, "hora_estudio") and estudio_principal.hora_estudio:
            hora_final = estudio_principal.hora_estudio
        elif hasattr(estudio_principal, "dicom_metadata") and estudio_principal.dicom_metadata:
            hora_final = estudio_principal.dicom_metadata.get("StudyTime", "00:00")[:4]
            if len(hora_final) == 4:
                hora_final = f"{hora_final[:2]}:{hora_final[2:]}"
        
        # 🛡️ DETERMINACIÓN DE ESTADOS FLEXIBLE (Verifica propiedades físicas en SQLite)
        tiene_audio = getattr(estudio_principal, "tiene_dictado", False) or (hasattr(estudio_principal, "audio_path") and bool(estudio_principal.audio_path))
        tiene_informe = getattr(estudio_principal, "tiene_transcripcion", False) or (hasattr(estudio_principal, "informe_texto") and bool(estudio_principal.informe_texto))
        esta_firmado = getattr(estudio_principal, "esta_firmado", False)
        tiene_anexos = getattr(estudio_principal, "tiene_anexos", False) or (hasattr(estudio_principal, "anexos_count") and getattr(estudio_principal, "anexos_count", 0) > 0)

        lista_mapeada.append({
            "id": p.id,
            "identificacion": p.identificacion,
            "primer_nombre": p.primer_nombre,
            "segundo_nombre": getattr(p, "segundo_nombre", "") or "-",
            "primer_apellido": p.primer_apellido,
            "segundo_apellido": getattr(p, "segundo_apellido", "") or "-",
            "telefono": getattr(p, "telefono", "") or "-",
            "email": getattr(p, "email", "") or "-",
            "activo": p.activo,
            "sexo": getattr(p, "sexo", "M"),
            "departamento": getattr(p, "departamento", "Radiología"),
            "fecha_estudio": estudio_principal.fecha_estudio.isoformat() if estudio_principal.fecha_estudio else "S/F",
            "tipo_estudio": estudio_principal.tipo_estudio if estudio_principal.tipo_estudio else "CR",
            "hora_estudio": hora_final,
            
            "flujo_clinico": {
                "tiene_audio": tiene_audio,
                "tiene_informe": tiene_informe,
                "esta_firmado": esta_firmado,
                "tiene_anexos": tiene_anexos
            }
        })

    def obtener_llave_orden(item):
        if sort_by == "id":
            try:
                return int(str(item["identificacion"]).strip())
            except ValueError:
                return str(item["identificacion"]).strip().lower()
        elif sort_by == "nombre":
            return str(item["primer_apellido"]).lower()
        else:
            return f"{item['fecha_estudio']} {item['hora_estudio']}"

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

# 📝 ENDPOINT DE ACTUALIZACIÓN BLINDADO PARA EVITAR CAÍDAS DE CORS
@router.put("/{paciente_id}", response_model=PacienteResponse)
def actualizar(paciente_id: int, paciente: PacienteUpdate, db: Session = Depends(get_db)):
    try:
        db_paciente = actualizar_paciente(db=db, paciente_id=paciente_id, data=paciente)
        if db_paciente is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"No se localizó al paciente con ID interno {paciente_id}"
            )
        return db_paciente
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fallo en persistencia backend: {str(e)}"
        )

# 🛡️ INTERRUPTOR MAESTRO: PERMITIR RE-DICTADO CLÍNICO ADMINISTRATIVO
@router.post("/{paciente_id}/reabrir-flujo")
def reabrir_flujo_estudio(paciente_id: int, control: PacienteFlujoAdminUpdate, db: Session = Depends(get_db)):
    """
    Busca los estudios del paciente y resetea las banderas de informe y firma en disco.
    Fuerza a que el sistema lo marque como pendiente para reactivar el micrófono del radiólogo.
    """
    db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not db_paciente:
        raise HTTPException(status_code=404, detail="Paciente clínico no encontrado")
        
    if not db_paciente.estudios:
        raise HTTPException(status_code=400, detail="El paciente no posee estudios DICOM asociados para reabrir")
        
    with db.begin_nested():
        for estudio in db_paciente.estudios:
            # Seteamos todos los indicadores a False para reiniciar el flujo clínico en caliente
            if hasattr(estudio, "tiene_dictado"): estudio.tiene_dictado = False
            if hasattr(estudio, "tiene_transcripcion"): estudio.tiene_transcripcion = False
            if hasattr(estudio, "esta_firmado"): estudio.esta_firmado = False
            
            # Limpieza física de rutas de archivos si existieran
            if hasattr(estudio, "audio_path"): estudio.audio_path = None
            if hasattr(estudio, "informe_texto"): estudio.informe_texto = None

    db.commit()
    return {"status": "success", "message": "Flujo clínico reabierto con éxito. Listo para re-dictar Segunda Opinión."}

@router.delete("/{paciente_id}")
def eliminar(paciente_id: int, db: Session = Depends(get_db)):
    return eliminar_paciente(db=db, paciente_id=paciente_id)