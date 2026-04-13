from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.whatsapp_log import WhatsAppLog

# ----------------------------------------------------------
# CREAR LOG
# ----------------------------------------------------------
def crear_log(
    db: Session,
    telefono: str,
    formato: str | None = None,
    estado: str = "enviado",
    estudio_id: int | None = None,
    mensaje: str | None = None,
    detalle_error: str | None = None,
) -> WhatsAppLog:
    log = WhatsAppLog(
        estudio_id=estudio_id,
        telefono=telefono,
        mensaje=mensaje,
        formato=formato,
        estado=estado,
        detalle_error=detalle_error,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

# ----------------------------------------------------------
# LISTAR LOGS (Única versión necesaria)
# ----------------------------------------------------------
def listar_logs(
    db: Session,
    telefono: Optional[str] = None,
    fecha_desde: Optional[datetime] = None,
    fecha_hasta: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
) -> List[WhatsAppLog]:
    """
    Lista logs de WhatsApp con filtros opcionales y paginación.
    """
    query = db.query(WhatsAppLog)

    # Filtro por teléfono
    if telefono:
        query = query.filter(WhatsAppLog.telefono.contains(telefono))

    # Filtros por fecha
    if fecha_desde:
        query = query.filter(WhatsAppLog.creado_en >= fecha_desde)
    if fecha_hasta:
        query = query.filter(WhatsAppLog.creado_en <= fecha_hasta)

    # Ordenar siempre por los más recientes
    query = query.order_by(WhatsAppLog.creado_en.desc())

    # Aplicar paginación
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()