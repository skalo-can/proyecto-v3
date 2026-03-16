"""
audio_dictado_api.py — MI_PACS
---------------------------------------------------------
Gestión clínica de audio dictado asociado a un estudio.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime
import shutil

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.estudio import Estudio


router = APIRouter(prefix="/estudios", tags=["Audio dictado"])


# ---------------------------------------------------------
# RUTA BASE PARA AUDIO CLÍNICO
# ---------------------------------------------------------
AUDIO_BASE_PATH = Path("evidencia_audio")
AUDIO_BASE_PATH.mkdir(exist_ok=True)


# ---------------------------------------------------------
# SUBIR AUDIO DEL ESTUDIO (solo médico o técnico)
# ---------------------------------------------------------
@router.post("/{estudio_id}/audio")
async def upload_audio_endpoint(
    estudio_id: int,
    archivo: UploadFile = File(...),
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Sube un archivo de audio (.wav o .mp3) asociado a un estudio clínico.

    Seguridad MI_PACS:
    - Solo médicos y técnicos pueden subir audio.
    - El audio forma parte de la evidencia clínica del estudio.
    """

    requiere_rol(usuario, ["medico", "tecnico"])

    # -----------------------------------------------------
    # 1. Validar estudio
    # -----------------------------------------------------
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(
            status_code=404,
            detail=f"Estudio {estudio_id} no encontrado."
        )

    # -----------------------------------------------------
    # 2. Validar extensión del archivo
    # -----------------------------------------------------
    if not archivo.filename.lower().endswith((".wav", ".mp3")):
        raise HTTPException(
            status_code=400,
            detail="Formato no permitido. Use .wav o .mp3."
        )

    # -----------------------------------------------------
    # 3. Crear carpeta del estudio
    # -----------------------------------------------------
    estudio_folder = AUDIO_BASE_PATH / f"estudio_{estudio_id}"
    estudio_folder.mkdir(exist_ok=True)

    # -----------------------------------------------------
    # 4. Generar nombre de archivo con timestamp
    # -----------------------------------------------------
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    extension = archivo.filename.split(".")[-1].lower()
    file_path = estudio_folder / f"audio_{timestamp}.{extension}"

    # -----------------------------------------------------
    # 5. Guardar archivo físicamente
    # -----------------------------------------------------
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    # -----------------------------------------------------
    # 6. Actualizar estudio clínico
    # -----------------------------------------------------
    estudio.reporte_audio_path = str(file_path)
    estudio.reporte_estado = "borrador"
    db.commit()
    db.refresh(estudio)

    # -----------------------------------------------------
    # 7. Respuesta clínica
    # -----------------------------------------------------
    return JSONResponse({
        "message": "Audio guardado correctamente.",
        "path": str(file_path),
        "estudio_id": estudio_id,
        "estado_reporte": estudio.reporte_estado
    })