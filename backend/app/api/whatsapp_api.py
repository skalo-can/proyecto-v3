from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import re

from app.core.database import SessionLocal
from app.crud import whatsapp_log_crud
from app.api.secure_links_api import generar_link_para_estudio
from app.services.whatsapp_service import enviar_mensaje_whatsapp

# 🔒 Seguridad perimetral para proteger TODOS los endpoints
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

router = APIRouter(tags=["WhatsApp"], prefix="/whatsapp")

BASE_PORTAL_URL = "https://portal.mipacs.net/portal/"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 🔥 NUEVO: Purificador de números para evitar "Falsos Positivos" en la API
def limpiar_telefono(numero: str) -> str:
    if not numero:
        return ""
    # Elimina espacios, guiones, paréntesis y deja solo dígitos y el signo +
    return re.sub(r'[^\d+]', '', str(numero))

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
        telefono_limpio = limpiar_telefono(telefono)
        token_link = generar_link_para_estudio(int(estudio_id), db=db)
        
        # 🔗 Garantizar que la URL comience con https://
        link_str = str(token_link)
        link_completo = link_str if link_str.startswith("http") else f"{BASE_PORTAL_URL}{link_str}"

        # 📄 Plantilla Bilingüe
        mensaje = (
            f"🏥 *MI_PACS Radiology Center*\n\n"
            f"Dear patient, your study result has been validated and is ready.\n"
            f"You can safely access it at the following link:\n{link_completo}\n\n"
            f"🔑 *Your access PIN is:* Your date of birth in *DDMMYYYY* format (e.g., 18101974 for October 18, 1974).\n\n"
            f"📌 *Important information about your link:*\n"
            f"• It will be available for *30 days*.\n"
            f"• It will be deactivated after *4 successful openings*.\n"
            f"• It will be blocked after *3 failed verification attempts*.\n\n"
            f"Please do not reply to this automated message.\n\n"
            f"----------------------------------------\n\n"
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

        ok = enviar_mensaje_whatsapp(telefono_limpio, mensaje)
        estado = "enviado" if ok else "error"
        whatsapp_log_crud.crear_log(
            db=db,
            telefono=telefono_limpio,
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

    telefono_limpio = limpiar_telefono(req.destino)
    if not telefono_limpio or len(telefono_limpio) < 7:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido.")

    background_tasks.add_task(tarea_enviar_whatsapp_bg, req.paciente_id, telefono_limpio)
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

    telefono_limpio = limpiar_telefono(data.telefono)
    token_link = generar_link_para_estudio(estudio_id, db=db)
    
    if data.mensaje and "http" in data.mensaje:
        mensaje = data.mensaje
    else:
        link_str = str(token_link)
        link_completo = link_str if link_str.startswith("http") else f"{BASE_PORTAL_URL}{link_str}"
        mensaje = (
            f"🏥 *MI_PACS Radiology Center*\n\n"
            f"Dear patient, your study result has been validated and is ready.\n"
            f"You can safely access it at the following link:\n{link_completo}\n\n"
            f"🔑 *Your access PIN is:* Your date of birth in *DDMMYYYY* format (e.g., 18101974 for October 18, 1974).\n\n"
            f"📌 *Important information about your link:*\n"
            f"• It will be available for *30 days*.\n"
            f"• It will be deactivated after *4 successful openings*.\n"
            f"• It will be blocked after *3 failed verification attempts*.\n\n"
            f"Please do not reply to this automated message.\n\n"
            f"----------------------------------------\n\n"
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

    ok = enviar_mensaje_whatsapp(telefono_limpio, mensaje)

    estado = "enviado" if ok else "error"
    whatsapp_log_crud.crear_log(
        db=db,
        telefono=telefono_limpio,
        formato=data.formato,
        estado=estado,
        estudio_id=estudio_id,
        mensaje=mensaje,
        detalle_error=None if ok else "Error al enviar",
    )

    if not ok:
        raise HTTPException(status_code=500, detail="No se pudo enviar el mensaje de WhatsApp")

    return {"status": "ok", "telefono": telefono_limpio, "link": link_completo}

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
    
    numero = limpiar_telefono(data.get("numero"))
    mensaje = data.get("mensaje")
    resultado = enviar_mensaje_whatsapp(numero, mensaje)
    return {"status": "ok", "detalle": resultado}