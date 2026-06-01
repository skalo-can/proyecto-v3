"""
dicom_stream_api.py — MI_PACS
---------------------------------------------------------
Entrega archivos DICOM al visor web MI_PACS (Cornerstone3D).
Soporta archivos nativos de eFilm sin extensión de sufijo rígida.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.estudio_imagen import EstudioImagen
from app.models.estudio import Estudio


router = APIRouter(prefix="/dicom", tags=["DICOM Stream"])


# ---------------------------------------------------------
# STREAM DICOM PARA EL VISOR WEB MI_PACS
# ---------------------------------------------------------
@router.get("/stream/{image_id}")
def stream_dicom(
    image_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Devuelve un archivo DICOM en formato binario para el visor MI_PACS.

    Seguridad clínica:
    - Pacientes solo pueden ver sus propios estudios.
    - Médicos, técnicos y admin pueden ver todos.
    """

    # -----------------------------------------------------
    # 1. Buscar la imagen en la base de datos
    # -----------------------------------------------------
    imagen = db.query(EstudioImagen).filter(EstudioImagen.id == image_id).first()

    if not imagen:
        raise HTTPException(
            status_code=404,
            detail=f"Imagen {image_id} no encontrada."
        )

    # -----------------------------------------------------
    # 2. Validar permisos clínicos
    # -----------------------------------------------------
    estudio = db.query(Estudio).filter(Estudio.id == imagen.estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    # Paciente solo puede ver sus propios estudios
    if usuario.rol == "paciente" and usuario.id != estudio.paciente_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    # Médicos, técnicos y admin tienen acceso total
    requiere_rol(usuario, ["admin", "medico", "tecnico", "paciente"])

    # -----------------------------------------------------
    # 3. Validar existencia física del archivo en storage
    # -----------------------------------------------------
    file_path = Path(imagen.ruta_archivo).resolve()

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Archivo físico DICOM no encontrado en el servidor:\n{file_path}"
        )

    # 🚀 CORREGIDO: Se elimina la restricción estricta de la extensión ".dcm".
    # Los visores eFilm Lite y PACS antiguos graban imágenes binarias válidas sin sufijo.
    # Cornerstone3D parseará el binario directamente gracias al Media Type correcto.

    # -----------------------------------------------------
    # 4. Leer archivo y enviarlo como flujo de bytes
    # -----------------------------------------------------
    try:
        dicom_bytes = file_path.read_bytes()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo leer el archivo binario DICOM:\n{str(e)}"
        )

    # -----------------------------------------------------
    # 5. Respuesta clínica compatible con Cornerstone3D / CornerstoneJS
    # -----------------------------------------------------
    return Response(
        content=dicom_bytes,
        media_type="application/dicom",
        headers={
            "Content-Length": str(len(dicom_bytes)),
            "Accept-Ranges": "bytes",
            # Habilitar CORS explícito para transferencia de imágenes pesadas en red local
            "Access-Control-Allow-Origin": "*",
        },
    )