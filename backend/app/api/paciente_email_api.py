"""
paciente_email_api.py — MI_PACS
---------------------------------------------------------
Envío de correos clínicos con enlaces seguros para pacientes.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.acceso_paciente import AccesoPaciente

from app.services.email_service import enviar_correo


router = APIRouter(prefix="/portal", tags=["Correo Paciente"])


# ---------------------------------------------------------
# ENVIAR CORREO CON LINK SEGURO
# ---------------------------------------------------------
@router.post("/enviar_link")
def enviar_link_por_correo_endpoint(
    paciente_id: int,
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Envía un correo clínico al paciente con un enlace seguro
    para acceder a su estudio radiológico.

    Seguridad:
    - Solo admin y médicos pueden enviar enlaces clínicos.
    """

    requiere_rol(usuario, ["admin", "medico"])

    # -----------------------------------------------------
    # 1) Validar paciente
    # -----------------------------------------------------
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")

    if not paciente.email:
        raise HTTPException(
            status_code=400,
            detail="El paciente no tiene un email registrado."
        )

    # -----------------------------------------------------
    # 2) Validar estudio y pertenencia
    # -----------------------------------------------------
    estudio = (
        db.query(Estudio)
        .filter(Estudio.id == estudio_id, Estudio.paciente_id == paciente_id)
        .first()
    )

    if not estudio:
        raise HTTPException(
            status_code=404,
            detail="El estudio no pertenece al paciente."
        )

    # -----------------------------------------------------
    # 3) Obtener token de acceso seguro
    # -----------------------------------------------------
    acceso = (
        db.query(AccesoPaciente)
        .filter(
            AccesoPaciente.paciente_id == paciente_id,
            AccesoPaciente.estudio_id == estudio_id
        )
        .order_by(AccesoPaciente.id.desc())
        .first()
    )

    if not acceso:
        raise HTTPException(
            status_code=404,
            detail="No existe un enlace seguro generado para este estudio."
        )

    link = f"https://mi-pacs.com/portal/acceso/{acceso.token}"

    # -----------------------------------------------------
    # 4) Construcción del correo HTML
    # -----------------------------------------------------
    mensaje_html = f"""
    <h2>Hola {paciente.primer_nombre},</h2>
    <p>Tu estudio radiológico ya está disponible.</p>
    <p>Puedes acceder a tu reporte y tus imágenes usando el siguiente enlace seguro:</p>
    <p><a href="{link}" style="font-size:18px; font-weight:bold;">Acceder a mi estudio</a></p>
    <p>Este enlace expirará el: <b>{acceso.expira_en}</b></p>
    <br>
    <p>Atentamente,<br>Equipo MI_PACS</p>
    """

    # -----------------------------------------------------
    # 5) Envío del correo
    # -----------------------------------------------------
    try:
        enviar_correo(
            destinatario=paciente.email,
            asunto="Acceso a tu estudio radiológico",
            mensaje_html=mensaje_html
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al enviar el correo: {str(e)}"
        )

    return {
        "message": "Correo enviado correctamente.",
        "email": paciente.email,
        "link": link
    }