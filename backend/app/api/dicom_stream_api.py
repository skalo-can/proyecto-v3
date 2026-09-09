from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pathlib import Path
import jwt
import os

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol
from app.models.estudio_imagen import EstudioImagen
from app.models.estudio import Estudio

router = APIRouter(prefix="/dicom", tags=["DICOM Stream"])
SECRET_COMPARTIR = "Asotrauma_Clinica_Segura_2026_Compartir"

# =========================================================
# TRADUCTOR DE RUTAS WINDOWS -> LINUX (DOCKER)
# =========================================================
def normalizar_ruta_docker(ruta_windows: str) -> str:
    if not ruta_windows: return ""
    # 1. Unificar barras
    ruta = ruta_windows.replace("\\", "/")
    
    # 2. Traducir volumen principal del proyecto
    if "D:/proyecto v3" in ruta or "d:/proyecto v3" in ruta:
        ruta = ruta.replace("D:/proyecto v3", "/app").replace("d:/proyecto v3", "/app")
        
    # 3. Traducir volumen del NAS Externo
    elif "D:/MI_PACS_NAS_EXTERNAL" in ruta or "d:/MI_PACS_NAS_EXTERNAL" in ruta:
        ruta = ruta.replace("D:/MI_PACS_NAS_EXTERNAL", "/mnt/nas_externo").replace("d:/MI_PACS_NAS_EXTERNAL", "/mnt/nas_externo")
        
    return ruta

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

    requiere_rol(usuario, ["admin", "superadmin", "medico", "radiologo", "recepcion", "tecnologo", "paciente", "transcriptor", "invitado", "auxiliar", "it_biomedica"])

    # 🔥 APLICAR TRADUCTOR ANTES DE LEER
    ruta_real = normalizar_ruta_docker(imagen.ruta_archivo)
    file_path = Path(ruta_real).resolve()
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo físico no encontrado en: {ruta_real}")

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
    token: str, 
    db: Session = Depends(get_db)
):
    imagen = db.query(EstudioImagen).filter(EstudioImagen.id == image_id).first()
    if not imagen: raise HTTPException(status_code=404)
        
    estudio = db.query(Estudio).filter(Estudio.id == imagen.estudio_id).first()

    try:
        payload = jwt.decode(token, SECRET_COMPARTIR, algorithms=["HS256"])
        if payload.get("rol") != "invitado_paciente" or payload.get("estudio_id") != estudio.id:
            raise Exception()
    except Exception:
        raise HTTPException(status_code=403, detail="Enlace caducado o inválido.")

    # 🔥 APLICAR TRADUCTOR ANTES DE LEER
    ruta_real = normalizar_ruta_docker(imagen.ruta_archivo)
    file_path = Path(ruta_real).resolve()
    
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