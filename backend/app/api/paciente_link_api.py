"""
paciente_link_api.py — MI_PACS
---------------------------------------------------------
Gestión de enlaces seguros para acceso temporal a estudios clínicos.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
from pathlib import Path

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.acceso_paciente import AccesoPaciente


router = APIRouter(prefix="/portal", tags=["Link Seguro Paciente"])


# ---------------------------------------------------------
# 1) GENERAR LINK SEGURO (solo admin y médico)
# ---------------------------------------------------------
@router.post("/generar_link")
def generar_link_endpoint(
    paciente_id: int,
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Genera un token seguro y lo almacena en accesos_paciente.
    El token permite acceso temporal al estudio clínico.
    """

    requiere_rol(usuario, ["admin", "medico"])

    # Validar paciente
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")

    # Validar estudio y pertenencia
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

    # Generar token seguro
    token = secrets.token_hex(16)
    expira = datetime.utcnow() + timedelta(hours=24)

    acceso = AccesoPaciente(
        token=token,
        paciente_id=paciente_id,
        estudio_id=estudio_id,
        expira_en=expira
    )

    db.add(acceso)
    db.commit()
    db.refresh(acceso)

    link = f"https://mi-pacs.com/portal/acceso/{token}"

    return {
        "link": link,
        "expira_en": acceso.expira_en
    }


# ---------------------------------------------------------
# 2) VALIDAR TOKEN
# ---------------------------------------------------------
@router.get("/acceso/{token}")
def validar_token_endpoint(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Valida que el token exista y no haya expirado.
    """

    acceso = db.query(AccesoPaciente).filter(AccesoPaciente.token == token).first()

    if not acceso:
        raise HTTPException(status_code=404, detail="Token inválido.")

    if datetime.utcnow() > acceso.expira_en:
        raise HTTPException(status_code=401, detail="El enlace ha expirado.")

    return {
        "paciente_id": acceso.paciente_id,
        "estudio_id": acceso.estudio_id,
        "expira_en": acceso.expira_en
    }


# ---------------------------------------------------------
# 3) VER ESTUDIO DESDE TOKEN
# ---------------------------------------------------------
@router.get("/acceso/{token}/estudio")
def obtener_estudio_desde_token_endpoint(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Devuelve los datos del estudio asociado al token.
    """

    acceso = db.query(AccesoPaciente).filter(AccesoPaciente.token == token).first()

    if not acceso:
        raise HTTPException(status_code=404, detail="Token inválido.")

    if datetime.utcnow() > acceso.expira_en:
        raise HTTPException(status_code=401, detail="El enlace ha expirado.")

    estudio = db.query(Estudio).filter(Estudio.id == acceso.estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    return estudio


# ---------------------------------------------------------
# 4) DESCARGAR PDF DESDE TOKEN
# ---------------------------------------------------------
@router.get("/acceso/{token}/pdf")
def descargar_pdf_desde_token_endpoint(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Devuelve el PDF clínico asociado al token.
    """

    acceso = db.query(AccesoPaciente).filter(AccesoPaciente.token == token).first()

    if not acceso:
        raise HTTPException(status_code=404, detail="Token inválido.")

    if datetime.utcnow() > acceso.expira_en:
        raise HTTPException(status_code=401, detail="El enlace ha expirado.")

    estudio = db.query(Estudio).filter(Estudio.id == acceso.estudio_id).first()

    if not estudio or not estudio.reporte_pdf_path:
        raise HTTPException(status_code=404, detail="PDF no disponible.")

    pdf_path = Path(estudio.reporte_pdf_path)

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="El archivo PDF no existe.")

    return FileResponse(str(pdf_path), media_type="application/pdf")


# ---------------------------------------------------------
# 5) VER IMÁGENES DESDE TOKEN
# ---------------------------------------------------------
@router.get("/acceso/{token}/imagenes")
def obtener_imagenes_desde_token_endpoint(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Devuelve la lista de imágenes asociadas al estudio accesible mediante token.
    """

    acceso = db.query(AccesoPaciente).filter(AccesoPaciente.token == token).first()

    if not acceso:
        raise HTTPException(status_code=404, detail="Token inválido.")

    if datetime.utcnow() > acceso.expira_en:
        raise HTTPException(status_code=401, detail="El enlace ha expirado.")

    imagenes = (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == acceso.estudio_id)
        .order_by(EstudioImagen.id.asc())
        .all()
    )

    return imagenes