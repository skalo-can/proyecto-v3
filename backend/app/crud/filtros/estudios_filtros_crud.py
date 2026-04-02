from app.models.estudio import Estudio
from app.models.paciente import Paciente
from sqlalchemy import asc, desc
from datetime import datetime, timedelta


def filtrar_estudios(
    db,
    id,
    nombre,
    apellido,
    modalidad,
    fecha,
    sort,
    order,
    limit,
    offset
):
    query = db.query(Estudio).join(Paciente)

    if id:
        query = query.filter(Paciente.id.contains(id))

    if nombre:
        query = query.filter(Paciente.nombre.ilike(f"%{nombre}%"))

    if apellido:
        query = query.filter(Paciente.apellido.ilike(f"%{apellido}%"))

    if modalidad:
        query = query.filter(Estudio.modality == modalidad)

    hoy = datetime.today().date()

    if fecha == "hoy":
        query = query.filter(Estudio.fecha == hoy)

    if fecha == "ayer":
        query = query.filter(Estudio.fecha == hoy - timedelta(days=1))

    if fecha == "7":
        query = query.filter(Estudio.fecha >= hoy - timedelta(days=7))

    if fecha == "30":
        query = query.filter(Estudio.fecha >= hoy - timedelta(days=30))

    # ORDENAMIENTO
    campo = getattr(Estudio, sort, Estudio.fecha)
    orden = asc(campo) if order == "asc" else desc(campo)
    query = query.order_by(orden)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }