from app.models.estudio import Estudio
from app.models.paciente import Paciente
from sqlalchemy import asc, desc
from datetime import datetime, timedelta

def filtrar_estudios(
    db, id, nombre, apellido, modalidad, estado, fecha,
    desde, hasta, sort, order, limit, offset
):
    # Aseguramos que no se pierdan pacientes con errores
    query = db.query(Estudio).outerjoin(Paciente)

    if id: query = query.filter(Paciente.id.contains(id))
    if nombre: query = query.filter(Paciente.nombre.ilike(f"%{nombre}%"))
    if apellido: query = query.filter(Paciente.apellido.ilike(f"%{apellido}%"))

    if modalidad and modalidad not in ["Todas", "- Todas -", "Todos"]:
        mod_limpia = modalidad.split('-')[0].strip()
        query = query.filter(Estudio.modality.ilike(f"%{mod_limpia}%"))

    if estado and estado not in ["- Todos -", "Todos", "Todas"]:
        if hasattr(Estudio, 'estado_pacs'):
            query = query.filter(Estudio.estado_pacs.ilike(f"%{estado.strip()}%"))
        elif hasattr(Estudio, 'estado'):
            query = query.filter(Estudio.estado.ilike(f"%{estado.strip()}%"))

    hoy = datetime.today().strftime("%Y-%m-%d")

    if fecha == "hoy":
        query = query.filter(Estudio.fecha.startswith(hoy))
    elif fecha == "ayer":
        ayer = (datetime.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        query = query.filter(Estudio.fecha.startswith(ayer))
    elif fecha == "7":
        hace_7 = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
        query = query.filter(Estudio.fecha >= hace_7)
    elif fecha == "30":
        hace_30 = (datetime.today() - timedelta(days=30)).strftime("%Y-%m-%d")
        query = query.filter(Estudio.fecha >= hace_30)

    # ==========================================
    # 🟢 CANDADO MATEMÁTICO DE FECHAS (Texto puro para SQLite)
    # ==========================================
    if desde:
        query = query.filter(Estudio.fecha >= desde)
    if hasta:
        # Se agrega 23:59:59 para incluir cualquier estudio hecho en la noche de ese último día
        query = query.filter(Estudio.fecha <= f"{hasta} 23:59:59")

    # 🟢 DESEMPATE DE PAGINACIÓN (Fijado por ID)
    campo = getattr(Estudio, sort, Estudio.fecha)
    orden = asc(campo) if order == "asc" else desc(campo)
    
    query = query.order_by(orden, desc(Estudio.id))

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }