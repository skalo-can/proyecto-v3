"""
transcripcion_api.py — MI_PACS
---------------------------------------------------------
Gestión clínica de transcripciones asociadas a un estudio.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.estudio import Estudio


router = APIRouter(prefix="/estudios", tags=["Transcripción"])

# 🔥 INYECTAMOS EL ANCLA
from app.core.config import AUDIOS_DIR

# ---------------------------------------------------------
# RUTA BASE PARA AUDIO CLÍNICO (👻 FANTASMA ELIMINADO)
# ---------------------------------------------------------
AUDIO_BASE_PATH = AUDIOS_DIR


# ---------------------------------------------------------
# 1) OBTENER AUDIO DEL ESTUDIO
# ---------------------------------------------------------
@router.get("/{estudio_id}/audio")
def obtener_audio_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Devuelve el archivo de audio asociado al estudio.

    Permisos:
    - médico
    - transcriptora
    """

    requiere_rol(usuario, ["medico", "transcriptora"])

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if not estudio.reporte_audio_path:
        raise HTTPException(
            status_code=404,
            detail="No hay audio registrado para este estudio."
        )

    audio_path = Path(estudio.reporte_audio_path)

    if not audio_path.exists():
        raise HTTPException(
            status_code=404,
            detail="El archivo de audio no existe en el servidor."
        )

    return FileResponse(str(audio_path), media_type="audio/wav")


# ---------------------------------------------------------
# 2) TRANSCRIPCIÓN AUTOMÁTICA (IA)
# ---------------------------------------------------------
@router.post("/{estudio_id}/transcribir_ia")
def transcribir_ia_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Genera una transcripción automática simulada.
    Solo médicos pueden ejecutar esta acción.
    """

    requiere_rol(usuario, ["medico"])

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if not estudio.reporte_audio_path:
        raise HTTPException(status_code=404, detail="No hay audio para transcribir.")

    texto_generado = (
        "Transcripción automática simulada. "
        "Aquí aparecerá el texto generado por IA a partir del audio del radiólogo."
    )

    estudio.reporte_texto = texto_generado
    estudio.reporte_estado = "borrador"

    db.commit()
    db.refresh(estudio)

    return JSONResponse({
        "message": "Transcripción automática generada.",
        "texto": texto_generado
    })


# ---------------------------------------------------------
# 3) TRANSCRIPCIÓN HUMANA (TRANSCRIPTORA)
# ---------------------------------------------------------
@router.post("/{estudio_id}/transcribir_humano")
def transcribir_humano_endpoint(
    estudio_id: int,
    texto: str,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    La transcriptora escucha el audio y escribe el reporte manualmente.
    Solo transcriptoras pueden ejecutar esta acción.
    """

    requiere_rol(usuario, ["transcriptora"])

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    estudio.reporte_texto = texto
    estudio.reporte_estado = "borrador"

    db.commit()
    db.refresh(estudio)

    return {
        "message": "Transcripción humana guardada.",
        "texto": texto
    }


# ---------------------------------------------------------
# 4) ACTUALIZAR REPORTE (CORRECCIÓN FINAL)
# ---------------------------------------------------------
@router.put("/{estudio_id}/reporte")
def actualizar_reporte_endpoint(
    estudio_id: int,
    texto: str,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Permite corregir o actualizar el reporte antes de la firma.
    Solo médicos pueden realizar esta acción.
    """

    requiere_rol(usuario, ["medico"])

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    estudio.reporte_texto = texto
    estudio.reporte_estado = "borrador"

    db.commit()
    db.refresh(estudio)

    return {
        "message": "Reporte actualizado.",
        "texto": texto
    } 