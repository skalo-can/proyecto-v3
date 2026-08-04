from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.core.database import SessionLocal
from app.crud import whatsapp_log_crud
from app.api.secure_links_api import generar_link_para_estudio
from app.services.whatsapp_service import enviar_mensaje_whatsapp

# 🔒 Seguridad perimetral para proteger TODOS los endpoints
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

router = APIRouter(tags=["WhatsApp"], prefix="/whatsapp")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class EnviarWhatsAppRequest(BaseModel):
    telefono: str
    formato: str = "link"
    mensaje: Optional[str] = None

class EnvioManualWARequest(BaseModel):
    paciente_id: str
    destino: str

def tarea_enviar_whatsapp_bg(estudio_id: str, telefono: str, db: Session):
    try:
        link = generar_link_para_estudio(int(estudio_id), db=db)
        mensaje = (
            f"🏥 *Centro Radiológico MI_PACS*\n\n"
            f"Estimado paciente, el resultado de su estudio ya se encuentra validado y listo.\n"
            f"Puede acceder a él de forma segura en el siguiente enlace:\n{link}\n\n"
            f"Por favor, no responda a este mensaje automático."
        )

        ok = enviar_mensaje_whatsapp(telefono, mensaje)
        estado = "enviado" if ok else "error"
        whatsapp_log_crud.crear_log(
            db=db,
            telefono=telefono,
            formato="link",
            estado=estado,
            estudio_id=int(estudio_id),
            mensaje=mensaje,
            detalle_error=None if ok else "Fallo en pasarela de WhatsApp",
        )
    except Exception as e:
        print(f"❌ Error en BackgroundTask WA: {str(e)}")
        whatsapp_log_crud.crear_log(
            db=db,
            telefono=telefono,
            formato="link",
            estado="error",
            estudio_id=int(estudio_id) if str(estudio_id).isdigit() else 0,
            mensaje="Error interno del servidor",
            detalle_error=str(e),
        )

@router.post("/enviar_resultado", status_code=status.HTTP_202_ACCEPTED)
def enviar_resultado_wa_endpoint(
    req: EnvioManualWARequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])

    if not req.destino or len(req.destino) < 7:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido.")

    background_tasks.add_task(tarea_enviar_whatsapp_bg, req.paciente_id, req.destino, db)
    return {"success": True, "message": "La notificación de WhatsApp se ha encolado para envío."}

@router.post("/enviar-estudio/{estudio_id}")
def enviar_estudio_whatsapp(
    estudio_id: int,
    data: EnviarWhatsAppRequest,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual) # 🔥 Escudo de seguridad activado
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])

    if data.formato != "link":
        raise HTTPException(status_code=400, detail="Por ahora solo se soporta formato 'link'")

    link = generar_link_para_estudio(estudio_id, db=db)
    mensaje = data.mensaje or f"Puede acceder a su estudio aquí: {link}"
    ok = enviar_mensaje_whatsapp(data.telefono, mensaje)

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

@router.get("/logs")
def listar_logs(
    db: Session = Depends(get_db),
    telefono: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    usuario=Depends(obtener_usuario_actual) # 🔥 Escudo de seguridad activado
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])

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
    
    # 🔥 Mapeo explícito para garantizar el renderizado en React
    return [
        {
            "id": l.id,
            "estudio_id": l.estudio_id,
            "telefono": l.telefono,
            "formato": l.formato,
            "mensaje": l.mensaje,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "creado_en": l.creado_en
        }
        for l in logs
    ]

@router.post("/send")
def enviar_whatsapp_simple(
    data: dict,
    usuario=Depends(obtener_usuario_actual) # 🔥 Escudo de seguridad activado
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])
    numero = data.get("numero")
    mensaje = data.get("mensaje")
    resultado = enviar_mensaje_whatsapp(numero, mensaje)
    return {"status": "ok", "detalle": resultado}