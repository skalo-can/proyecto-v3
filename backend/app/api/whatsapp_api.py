from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.core.database import SessionLocal
from app.crud import whatsapp_log_crud
from app.api.secure_links_api import generar_link_para_estudio
from app.services.whatsapp_service import enviar_mensaje_whatsapp

# 🔒 Importamos seguridad para proteger el nuevo endpoint
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

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
#   MODELOS DE REQUEST
# ==========================================================
class EnviarWhatsAppRequest(BaseModel):
    telefono: str
    formato: str = "link"  # link, jpg, zip
    mensaje: Optional[str] = None

# 🔥 NUEVO MODELO PARA EL BOTÓN DE RECEPCIÓN
class EnvioManualWARequest(BaseModel):
    paciente_id: str  # En React (p.id) suele ser el ID del estudio/orden
    destino: str


# ==========================================================
# 🚀 TAREA EN SEGUNDO PLANO (BACKGROUND TASK)
# ==========================================================
def tarea_enviar_whatsapp_bg(estudio_id: str, telefono: str, db: Session):
    """
    Se ejecuta sin congelar la pantalla de React.
    Genera el link seguro, envía el mensaje y guarda la auditoría en BD.
    """
    try:
        # 1. Generar link seguro
        link = generar_link_para_estudio(int(estudio_id), db=db)
        mensaje = (
            f"🏥 *Centro Radiológico MI_PACS*\n\n"
            f"Estimado paciente, el resultado de su estudio ya se encuentra validado y listo.\n"
            f"Puede acceder a él de forma segura en el siguiente enlace:\n{link}\n\n"
            f"Por favor, no responda a este mensaje automático."
        )

        # 2. Enviar mensaje real
        ok = enviar_mensaje_whatsapp(telefono, mensaje)

        # 3. Registrar log de auditoría
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


# ==========================================================
# 🚀 NUEVO ENDPOINT PARA LA TABLA DE PACIENTES (RECEPCIÓN)
# ==========================================================
@router.post("/enviar_resultado", status_code=status.HTTP_202_ACCEPTED)
def enviar_resultado_wa_endpoint(
    req: EnvioManualWARequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual)
):
    # 🔒 Seguridad: Solo estos roles pueden disparar el WhatsApp
    requiere_rol(usuario, ["admin", "medico", "recepcion"])

    if not req.destino or len(req.destino) < 7:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido.")

    # 🔥 Encolar la tarea en segundo plano
    background_tasks.add_task(tarea_enviar_whatsapp_bg, req.paciente_id, req.destino, db)

    return {"success": True, "message": "La notificación de WhatsApp se ha encolado para envío."}


# ==========================================================
#   ENVIAR ESTUDIO POR WHATSAPP (TU ENDPOINT ORIGINAL)
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
#   LISTAR LOGS DE WHATSAPP (TU ENDPOINT ORIGINAL)
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
#   ENDPOINT SIMPLE /send  (para pruebas) (TU ENDPOINT ORIGINAL)
# ==========================================================
@router.post("/send")
def enviar_whatsapp_simple(data: dict):
    numero = data.get("numero")
    mensaje = data.get("mensaje")

    resultado = enviar_mensaje_whatsapp(numero, mensaje)

    return {"status": "ok", "detalle": resultado}