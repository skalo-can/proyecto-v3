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

# Dominio base del portal para la construcción de URLs completas
BASE_PORTAL_URL = "https://portal.mipacs.net/portal/"

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

# 🛠️ TAREA EN SEGUNDO PLANO
def tarea_enviar_whatsapp_bg(estudio_id: str, telefono: str):
    db = SessionLocal()
    try:
        token_link = generar_link_para_estudio(int(estudio_id), db=db)
        
        # 🔗 Garantizar que la URL comience con https://
        link_str = str(token_link)
        link_completo = link_str if link_str.startswith("http") else f"{BASE_PORTAL_URL}{link_str}"

        # 📄 Plantilla con instrucciones clínicas e indicación de PIN
        mensaje = (
            f"🏥 *Centro Radiológico MI_PACS*\n\n"
            f"Estimado paciente, el resultado de su estudio ya se encuentra validado y listo.\n"
            f"Puede acceder a él de forma segura en el siguiente enlace:\n{link_completo}\n\n"
            f"🔑 *Su PIN de acceso es:* Su fecha de nacimiento en formato *DDMMAAAA* (ejemplo: 18101974 para el 18 de octubre de 1974).\n\n"
            f"📌 *Información importante sobre su enlace:*\n"
            f"• Estará disponible por *30 días* a partir de hoy.\n"
            f"• Se desactivará al completar *4 aperturas* exitosas.\n"
            f"• Se bloqueará tras *3 intentos fallidos* de verificación.\n\n"
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
    finally:
        db.close()

@router.post("/enviar_resultado", status_code=status.HTTP_202_ACCEPTED)
def enviar_resultado_wa_endpoint(
    req: EnvioManualWARequest,
    background_tasks: BackgroundTasks,
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["superadmin", "admin", "medico", "recepcion"])

    if not req.destino or len(req.destino) < 7:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido.")

    background_tasks.add_task(tarea_enviar_whatsapp_bg, req.paciente_id, req.destino)
    return {"success": True, "message": "La notificación de WhatsApp se ha encolado para envío."}

@router.post("/enviar-estudio/{estudio_id}")
def enviar_estudio_whatsapp(
    estudio_id: int,
    data: EnviarWhatsAppRequest,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["superadmin", "admin", "medico", "recepcion"])

    if data.formato != "link":
        raise HTTPException(status_code=400, detail="Por ahora solo se soporta formato 'link'")

    token_link = generar_link_para_estudio(estudio_id, db=db)
    
    # 🔗 Si viene un mensaje personalizado lo respeta, sino construye la plantilla oficial
    if data.mensaje and "http" in data.mensaje:
        mensaje = data.mensaje
    else:
        link_str = str(token_link)
        link_completo = link_str if link_str.startswith("http") else f"{BASE_PORTAL_URL}{link_str}"
        mensaje = (
            f"🏥 *Centro Radiológico MI_PACS*\n\n"
            f"Estimado paciente, el resultado de su estudio ya se encuentra validado y listo.\n"
            f"Puede acceder a él de forma segura en el siguiente enlace:\n{link_completo}\n\n"
            f"🔑 *Su PIN de acceso es:* Su fecha de nacimiento en formato *DDMMAAAA* (ejemplo: 18101974 para el 18 de octubre de 1974).\n\n"
            f"📌 *Información importante sobre su enlace:*\n"
            f"• Estará disponible por *30 días* a partir de hoy.\n"
            f"• Se desactivará al completar *4 aperturas* exitosas.\n"
            f"• Se bloqueará tras *3 intentos fallidos* de verificación.\n\n"
            f"Por favor, no responda a este mensaje automático."
        )

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

    return {"status": "ok", "telefono": data.telefono, "link": link_completo}

@router.get("/logs")
def listar_logs(
    db: Session = Depends(get_db),
    telefono: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["superadmin", "admin", "medico", "recepcion"])

    def limpiar_fecha(f_str):
        if not f_str or f_str in ["null", "undefined", ""]: 
            return None
        try:
            f_str_limpia = f_str.replace("Z", "+00:00")
            return datetime.fromisoformat(f_str_limpia)
        except ValueError:
            return None

    fd = limpiar_fecha(fecha_desde)
    fh = limpiar_fecha(fecha_hasta)

    logs = whatsapp_log_crud.listar_logs(
        db,
        telefono=telefono,
        fecha_desde=fd,
        fecha_hasta=fh,
        page=page,
        page_size=page_size,
    )
    
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
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["superadmin", "admin", "medico", "recepcion"])
    
    numero = data.get("numero")
    mensaje = data.get("mensaje")
    resultado = enviar_mensaje_whatsapp(numero, mensaje)
    return {"status": "ok", "detalle": resultado}