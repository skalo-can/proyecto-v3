import re
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.crud.filtros.estudios_filtros_crud import filtrar_estudios

router = APIRouter(prefix="/filtros", tags=["Filtros – Estudios"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 🟢 PURIFICADOR DE FECHAS: Convierte cualquier formato a YYYY-MM-DD
def limpiar_fecha(fecha_str):
    if not fecha_str: 
        return None
    f = str(fecha_str).strip()
    if "T" in f: 
        f = f.split("T")[0]
    
    # Detectar formato MM/DD/YYYY o DD/MM/YYYY que envía el frontend
    match = re.match(r"^(\d{2})[/.-](\d{2})[/.-](\d{4})$", f)
    if match:
        return f"{match.group(3)}-{match.group(1)}-{match.group(2)}"
    return f[:10]

@router.get("/estudios")
def obtener_estudios_filtrados(
    request: Request, # 🟢 Atrapa TODA la URL para inspeccionarla
    db: Session = Depends(get_db),
    id: str | None = Query(None),
    nombre: str | None = Query(None),
    apellido: str | None = Query(None),
    modalidad: str | None = Query(None),
    estado: str | None = Query(None),
    fecha: str | None = Query(None),
    sort: str = Query("fecha"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
):
    params = request.query_params

    # 🟢 LA RED DE ATRAPE: No importa cómo llame React a la fecha, la capturamos.
    raw_desde = params.get("desde") or params.get("startDate") or params.get("start") or params.get("fecha_inicio") or params.get("inicio")
    raw_hasta = params.get("hasta") or params.get("endDate") or params.get("end") or params.get("fecha_fin") or params.get("fin")

    fecha_inicio_real = limpiar_fecha(raw_desde)
    fecha_fin_real = limpiar_fecha(raw_hasta)

    # 🟢 DICTADURA DEL LÍMITE: Ignoramos el 25 del frontend y forzamos 1000
    limit = 1000 
    offset = (page - 1) * limit

    # Atrapamos modalidades y estados disfrazados
    mod_final = params.get("modalidad") or modalidad
    est_final = params.get("estado") or estado

    return filtrar_estudios(
        db=db,
        id=id,
        nombre=nombre,
        apellido=apellido,
        modalidad=mod_final,
        estado=est_final,
        fecha=fecha,
        desde=fecha_inicio_real,
        hasta=fecha_fin_real,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )