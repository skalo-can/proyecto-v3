from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.core.database import SessionLocal
from app.crud import whatsapp_log_crud
from app.api.secure_links_api import generar_link_para_estudio
from app.services.whatsapp_service import enviar_mensaje_whatsapp


router = APIRouter(tags=["WhatsApp"], prefix="/whatsapp")


# ==========================================================
#   DEPENDENCIA DB
# ==========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
#   MODELO DE REQUEST
# ==========================================================
class EnviarWhatsAppRequest(BaseModel):
    telefono: str
    formato: str = "link"  # link, jpg, zip
    mensaje: Optional[str] = None


# ==========================================================
#   ENVIAR ESTUDIO POR WHATSAPP
# ==========================================================
@router.post("/enviar-estudio/{estudio_id}")
def enviar_estudio_whatsapp(
    estudio_id: int,
    data: EnviarWhatsAppRequest,
    db: Session = Depends(get_db)
):
    if data.formato != "link":
        raise HTTPException(status_code=400, detail="Por ahora solo se soporta formato 'link'")

    # Generar link seguro
    link = generar_link_para_estudio(estudio_id, db=db)
    mensaje = data.mensaje or f"Puede acceder a su estudio aquí: {link}"

    # Enviar mensaje real
    ok = enviar_mensaje_whatsapp(data.telefono, mensaje)

    # Registrar log
    estado = "enviado" if ok else "error"
    whatsapp_log_crud.crear_log(
        db=db,
        telefono=data.telefono,
        formato=data.formato,
        estado=estado,
        estudio_id=estudio_id,
        mensaje=mensaje,
        detalle_error=None if ok else "Error al enviar",
    )

    if not ok:
        raise HTTPException(status_code=500, detail="No se pudo enviar el mensaje de WhatsApp")

    return {"status": "ok", "telefono": data.telefono, "link": link}


# ==========================================================
#   LISTAR LOGS DE WHATSAPP
# ==========================================================
@router.get("/logs")
def listar_logs(
    db: Session = Depends(get_db),
    telefono: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    fd = datetime.fromisoformat(fecha_desde) if fecha_desde else None
    fh = datetime.fromisoformat(fecha_hasta) if fecha_hasta else None

    logs = whatsapp_log_crud.listar_logs(
        db,
        telefono=telefono,
        fecha_desde=fd,
        fecha_hasta=fh,
        page=page,
        page_size=page_size,
    )
    return logs


# ==========================================================
#   ENDPOINT SIMPLE /send  (para pruebas)
# ==========================================================
@router.post("/send")
def enviar_whatsapp_simple(data: dict):
    numero = data.get("numero")
    mensaje = data.get("mensaje")

    resultado = enviar_mensaje_whatsapp(numero, mensaje)

    return {"status": "ok", "detalle": resultado}