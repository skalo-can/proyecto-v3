"""
dicom_audio_api.py — MI_PACS
---------------------------------------------------------
Gestión clínica de audio dictado asociado a un estudio.
(Optimizado con ILM y partición temporal YYYY/MM/DD para backups)
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
from app.models.paciente import Paciente  # 🔥 IMPORTAMOS EL MODELO (Igual que en firma)

# 🔥 IMPORTAMOS EL ANCLA
from app.core.config import AUDIOS_DIR

router = APIRouter(prefix="/estudios", tags=["Audio dictado"])

# ---------------------------------------------------------
# RUTA BASE PARA AUDIO CLÍNICO (Alineada con tu carpeta estática)
# ---------------------------------------------------------
# Apuntamos a la carpeta estática para que el frontend pueda reproducirlos por red
from app.core.config import AUDIOS_DIR
AUDIO_BASE_PATH = AUDIOS_DIR


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
    Implementa almacenamiento jerárquico (ILM) para optimización de backups.
    """

    requiere_rol(usuario, ["medico", "tecnico"])

    # 1. Validar estudio
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(
            status_code=404,
            detail=f"Estudio {estudio_id} no encontrado."
        )

    # 2. Validar extensión del archivo
    if not archivo.filename.lower().endswith((".wav", ".mp3")):
        raise HTTPException(
            status_code=400,
            detail="Formato no permitido. Use .wav o .mp3."
        )

    # 🔥 COPIAMOS LA LÓGICA DE FIRMA: Consulta directa a la tabla Pacientes
    paciente = db.query(Paciente).filter(Paciente.id == estudio.paciente_id).first()
    identificacion_paciente = paciente.identificacion if paciente else "SIN_ID"

    # -----------------------------------------------------
    # 🔥 LA MAGIA DEL ILM: Partición por Año / Mes / Día
    # -----------------------------------------------------
    ahora = datetime.now()
    año = str(ahora.year)
    mes = f"{ahora.month:02d}"
    dia = f"{ahora.day:02d}"

    # Crear la ruta física en el disco: static/audios_dictado/YYYY/MM/DD
    ruta_jerarquica = AUDIO_BASE_PATH / año / mes / dia
    ruta_jerarquica.mkdir(parents=True, exist_ok=True)

    # Generar nombre limpio con timestamp y la identificación real
    timestamp = ahora.strftime("%H%M%S")
    extension = archivo.filename.split(".")[-1].lower()
    
    nombre_limpio = f"dictado_{identificacion_paciente}_{timestamp}.{extension}"
    
    file_path = ruta_jerarquica / nombre_limpio

    # 5. Guardar archivo físicamente en su carpeta diaria
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    # -----------------------------------------------------
    # 6. Actualizar estudio clínico con la RUTA RELATIVA
    # -----------------------------------------------------
    # Guardamos la ruta que usará el Frontend para el tag <audio src="...">
    ruta_relativa = f"/static/audios_dictado/{año}/{mes}/{dia}/{nombre_limpio}"
    
    estudio.reporte_audio_path = ruta_relativa
    estudio.reporte_estado = "borrador"
    db.commit()
    db.refresh(estudio)

    # 7. Respuesta clínica
    return JSONResponse({
        "message": "Audio estructurado por fecha guardado correctamente.",
        "path": ruta_relativa,
        "estudio_id": estudio_id,
        "estado_reporte": estudio.reporte_estado
    })