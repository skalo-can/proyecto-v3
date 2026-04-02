from app.models.paciente import Paciente
from sqlalchemy import asc, desc
from datetime import datetime, timedelta

def filtrar_pacientes(db, id, nombre, apellido, fecha, sort, order, limit, offset):
    query = db.query(Paciente)

    if id:
        query = query.filter(Paciente.id.contains(id))

    if nombre:
        query = query.filter(Paciente.nombre.ilike(f"%{nombre}%"))

    if apellido:
        query = query.filter(Paciente.apellido.ilike(f"%{apellido}%"))

    hoy = datetime.today().date()

    if fecha == "hoy":
        query = query.filter(Paciente.fecha_registro == hoy)

    if fecha == "ayer":
        query = query.filter(Paciente.fecha_registro == hoy - timedelta(days=1))

    if fecha == "7":
        query = query.filter(Paciente.fecha_registro >= hoy - timedelta(days=7))

    if fecha == "30":
        query = query.filter(Paciente.fecha_registro >= hoy - timedelta(days=30))

    # ORDENAMIENTO
    campo = getattr(Paciente, sort, Paciente.id)
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