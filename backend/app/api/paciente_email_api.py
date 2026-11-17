"""
paciente_email_api.py — MI_PACS
---------------------------------------------------------
Envío de correos clínicos con enlaces seguros para pacientes (Soporte Bilingüe).
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
from datetime import datetime

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.acceso_paciente import AccesoPaciente

from app.services.email_service import enviar_correo, procesar_envio_email

router = APIRouter(prefix="/portal", tags=["Correo Paciente"])

# ---------------------------------------------------------
# ENVIAR CORREO CON LINK SEGURO (BILINGÜE)
# ---------------------------------------------------------
@router.post("/enviar_link")
def enviar_link_por_correo_endpoint(
    paciente_id: int,
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin", "medico"])

    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")
    if not paciente.email:
        raise HTTPException(status_code=400, detail="El paciente no tiene un email registrado.")

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id, Estudio.paciente_id == paciente_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="El estudio no pertenece al paciente.")

    acceso = db.query(AccesoPaciente).filter(
        AccesoPaciente.paciente_id == paciente_id,
        AccesoPaciente.estudio_id == estudio_id
    ).order_by(AccesoPaciente.id.desc()).first()

    if not acceso:
        raise HTTPException(status_code=404, detail="No existe un enlace seguro generado para este estudio.")

    # 🔗 Usamos el dominio real de producción
    link = f"https://portal.mipacs.net/portal/acceso/{acceso.token}"

    # 📄 Plantilla HTML Bilingüe (Inglés primero, luego Español)
    mensaje_html = f"""
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">MI_PACS Radiology Center</h1>
        </div>
        
        <div style="padding: 20px;">
            <!-- INGLÉS -->
            <h2 style="color: #1e293b;">Hello {paciente.primer_nombre},</h2>
            <p>Your radiology study is now available.</p>
            <p>You can access your report and medical images using the following secure link:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Access My Study</a>
            </div>
            <p style="font-size: 14px; color: #64748b;">This secure link will expire on: <b>{acceso.expira_en}</b></p>
            <p style="font-size: 14px; color: #64748b;"><i>Your access PIN is your date of birth in DDMMYYYY format.</i></p>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <!-- ESPAÑOL -->
            <h2 style="color: #1e293b;">Hola {paciente.primer_nombre},</h2>
            <p>Tu estudio radiológico ya está disponible.</p>
            <p>Puedes acceder a tu reporte y tus imágenes usando el siguiente enlace seguro:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Acceder a mi estudio</a>
            </div>
            <p style="font-size: 14px; color: #64748b;">Este enlace seguro expirará el: <b>{acceso.expira_en}</b></p>
            <p style="font-size: 14px; color: #64748b;"><i>Su PIN de acceso es su fecha de nacimiento en formato DDMMAAAA.</i></p>
            
            <br>
            <p style="margin-top: 20px;">Sincerely / Atentamente,<br><strong>MI_PACS Medical Team</strong></p>
        </div>
    </div>
    """

    try:
        # Enviamos con un asunto bilingüe
        enviar_correo(
            destinatario=paciente.email, 
            asunto="Radiology Study Access / Acceso a tu estudio radiológico", 
            mensaje_html=mensaje_html
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar el correo: {str(e)}")

    return {"message": "Correo bilingüe enviado correctamente.", "email": paciente.email, "link": link}


# ---------------------------------------------------------
# 🚀 ENVIAR PDF DE RESULTADO EN SEGUNDO PLANO
# ---------------------------------------------------------
class EnvioManualEmailRequest(BaseModel):
    paciente_id: str
    destino: str 

@router.post("/enviar_resultado_email", status_code=status.HTTP_202_ACCEPTED)
def enviar_resultado_email_endpoint(
    req: EnvioManualEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])

    if not req.destino or "@" not in req.destino:
        raise HTTPException(status_code=400, detail="Dirección de correo inválida.")
    
    # 1. Buscar los datos para reconstruir tu estructura de carpetas
    paciente = db.query(Paciente).filter(Paciente.id == req.paciente_id).first()
    estudio = db.query(Estudio).filter(Estudio.paciente_id == req.paciente_id).order_by(Estudio.id.desc()).first()

    if not paciente or not estudio:
        raise HTTPException(status_code=404, detail="Datos no encontrados para construir la ruta.")

    # 2. Formatear Año, Mes y Día según tu sistema de archivos
    fecha = estudio.fecha_estudio
    if isinstance(fecha, str):
        fecha = datetime.fromisoformat(fecha).date()
        
    year = fecha.strftime("%Y")
    month = fecha.strftime("%m")
    day = fecha.strftime("%d")
    
    # ID real del paciente (ej. 28799769)
    doc_id = paciente.identificacion or paciente.id

    # 3. Construir la ruta exacta respetando tu carpeta static
    ruta_pdf_estructurada = os.path.join(
        "static", "pdf_reports", year, month, day, f"Reporte_{doc_id}.pdf"
    )
    
    # 🔥 Encolar la tarea
    # (Asegúrate de que la función procesar_envio_email en tu archivo email_service.py también use un Asunto bilingüe si es posible)
    background_tasks.add_task(procesar_envio_email, str(doc_id), req.destino, ruta_pdf_estructurada)
    
    return {"success": True, "message": "El correo con el resultado PDF se ha encolado para envío."}