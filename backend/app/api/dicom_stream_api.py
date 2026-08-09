"""
dicom_stream_api.py — MI_PACS
---------------------------------------------------------
Entrega archivos DICOM al visor web MI_PACS (Cornerstone3D).
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pathlib import Path
import jwt

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol
from app.models.estudio_imagen import EstudioImagen
from app.models.estudio import Estudio

router = APIRouter(prefix="/dicom", tags=["DICOM Stream"])
SECRET_COMPARTIR = "Asotrauma_Clinica_Segura_2026_Compartir"

# =========================================================
# PUERTA 1: RUTA CLÍNICA (MÉDICOS Y ADMINS) - RESTAURADA
# =========================================================
@router.get("/stream/{image_id}")
def stream_dicom_clinico(
    image_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    imagen = db.query(EstudioImagen).filter(EstudioImagen.id == image_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")

    # Restauramos tu seguridad original perfecta
    requiere_rol(usuario, ["admin", "superadmin", "medico", "radiologo", "tecnico", "tecnologo", "paciente"])

    file_path = Path(imagen.ruta_archivo).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo físico no encontrado.")

    try:
        dicom_bytes = file_path.read_bytes()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error leyendo archivo binario.")

    return Response(
        content=dicom_bytes,
        media_type="application/dicom",
        headers={
            "Content-Length": str(len(dicom_bytes)),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
        },
    )


# =========================================================
# PUERTA 2: RUTA INVITADOS (WHATSAPP PACIENTES) - NUEVA
# =========================================================
@router.get("/stream/guest/{image_id}")
def stream_dicom_invitado(
    image_id: int,
    token: str, # El token llega por la URL de WhatsApp, sin afectar cabeceras
    db: Session = Depends(get_db)
):
    imagen = db.query(EstudioImagen).filter(EstudioImagen.id == image_id).first()
    if not imagen: raise HTTPException(status_code=404)
        
    estudio = db.query(Estudio).filter(Estudio.id == imagen.estudio_id).first()

    # Validación estricta del JWT del paciente
    try:
        payload = jwt.decode(token, SECRET_COMPARTIR, algorithms=["HS256"])
        if payload.get("rol") != "invitado_paciente" or payload.get("estudio_id") != estudio.id:
            raise Exception()
    except Exception:
        raise HTTPException(status_code=403, detail="Enlace caducado o inválido.")

    file_path = Path(imagen.ruta_archivo).resolve()
    if not file_path.exists(): raise HTTPException(status_code=404)
        
    dicom_bytes = file_path.read_bytes()
    
    return Response(
        content=dicom_bytes,
        media_type="application/dicom",
        headers={
            "Content-Length": str(len(dicom_bytes)),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
        },
    ) 