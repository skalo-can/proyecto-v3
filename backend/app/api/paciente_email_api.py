"""
paciente_email_api.py — MI_PACS
---------------------------------------------------------
Envío de correos clínicos con enlaces seguros para pacientes.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.acceso_paciente import AccesoPaciente

# 🔥 Importamos también el nuevo motor procesar_envio_email
from app.services.email_service import enviar_correo, procesar_envio_email

router = APIRouter(prefix="/portal", tags=["Correo Paciente"])


# ---------------------------------------------------------
# ENVIAR CORREO CON LINK SEGURO (TU ENDPOINT ORIGINAL)
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

    link = f"https://mi-pacs.com/portal/acceso/{acceso.token}"

    mensaje_html = f"""
    <h2>Hola {paciente.primer_nombre},</h2>
    <p>Tu estudio radiológico ya está disponible.</p>
    <p>Puedes acceder a tu reporte y tus imágenes usando el siguiente enlace seguro:</p>
    <p><a href="{link}" style="font-size:18px; font-weight:bold;">Acceder a mi estudio</a></p>
    <p>Este enlace expirará el: <b>{acceso.expira_en}</b></p>
    <br>
    <p>Atentamente,<br>Equipo MI_PACS</p>
    """

    try:
        enviar_correo(destinatario=paciente.email, asunto="Acceso a tu estudio radiológico", mensaje_html=mensaje_html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar el correo: {str(e)}")

    return {"message": "Correo enviado correctamente.", "email": paciente.email, "link": link}


# ---------------------------------------------------------
# 🚀 NUEVO ENDPOINT: ENVIAR PDF DE RESULTADO EN SEGUNDO PLANO
# ---------------------------------------------------------
class EnvioManualEmailRequest(BaseModel):
    paciente_id: str
    destino: str 

import os
from datetime import datetime

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
    # Buscamos el paciente para obtener su ID real (Documento)
    paciente = db.query(Paciente).filter(Paciente.id == req.paciente_id).first()
    estudio = db.query(Estudio).filter(Estudio.paciente_id == req.paciente_id).order_by(Estudio.id.desc()).first()

    if not paciente or not estudio:
        raise HTTPException(status_code=404, detail="Datos no encontrados para construir la ruta.")

    # 2. Formatear Año, Mes y Día según tu imagen
    fecha = estudio.fecha_estudio # Asumiendo que es un objeto date/datetime
    if isinstance(fecha, str):
        fecha = datetime.fromisoformat(fecha).date()
        
    year = fecha.strftime("%Y")
    month = fecha.strftime("%m")
    day = fecha.strftime("%d")
    
    # ID real del paciente (ej. 28799769)
    doc_id = paciente.identificacion or paciente.id

    # 3. Construir la ruta exacta respetando tu carpeta static
    # Esto generará algo como: static/pdf_reports/2020/01/01/Reporte_28799769.pdf
    ruta_pdf_estructurada = os.path.join(
        "static", "pdf_reports", year, month, day, f"Reporte_{doc_id}.pdf"
    )
    
    # 🔥 Encolar la tarea enviando la ruta exacta
    background_tasks.add_task(procesar_envio_email, str(doc_id), req.destino, ruta_pdf_estructurada)
    
    return {"success": True, "message": "El correo con el resultado PDF se ha encolado para envío."}