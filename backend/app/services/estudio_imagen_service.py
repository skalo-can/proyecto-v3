"""
estudio_imagen_service.py — MI_PACS
Servicio clínico encargado de gestionar imágenes asociadas a un estudio.
Compatible con:
- Procesador DICOM automático
- Subida manual desde el frontend
- Visor DICOM moderno
"""

import os
import uuid
from pathlib import Path
from datetime import datetime
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from PIL import Image
import pydicom

from app.models.estudio_imagen import EstudioImagen


# ---------------------------------------------------------
# RUTAS CLÍNICAS ABSOLUTAS
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = BASE_DIR / "static"

DICOMS_BASE = STATIC_DIR / "dicoms"
THUMB_DIR = STATIC_DIR / "thumbnails"

os.makedirs(DICOMS_BASE, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)


# ---------------------------------------------------------
# MINIATURAS PARA IMÁGENES NO DICOM
# ---------------------------------------------------------
def generar_thumbnail(image_path: Path, filename: str) -> str:
    """
    Genera una miniatura PNG de 200x200 px para imágenes no DICOM.
    Retorna la URL pública.
    """
    thumb_filename = f"{filename}.png"
    thumb_path = THUMB_DIR / thumb_filename

    with Image.open(image_path) as img:
        img.thumbnail((200, 200))
        img.save(thumb_path, "PNG")

    return f"/static/thumbnails/{thumb_filename}"


# ---------------------------------------------------------
# MINIATURA PARA DICOM
# ---------------------------------------------------------
def generar_thumbnail_dicom(dicom_path: Path, filename: str) -> str | None:
    try:
        ds = pydicom.dcmread(str(dicom_path), force=True)

        if "PixelData" not in ds:
            return None

        arr = ds.pixel_array
        img = Image.fromarray(arr)
        img.thumbnail((200, 200))

        thumb_filename = f"{filename}.png"
        thumb_path = THUMB_DIR / thumb_filename
        img.save(thumb_path, "PNG")

        return f"/static/thumbnails/{thumb_filename}"

    except Exception as e:
        print("❌ Error generando thumbnail DICOM:", e)
        return None


# ---------------------------------------------------------
# EXTRAER METADATA DICOM
# ---------------------------------------------------------
def extraer_metadata_dicom(path: Path) -> dict:
    try:
        ds = pydicom.dcmread(str(path), force=True)
        return {
            "PatientID": str(getattr(ds, "PatientID", "")),
            "PatientName": str(getattr(ds, "PatientName", "")),
            "StudyInstanceUID": str(getattr(ds, "StudyInstanceUID", "")),
            "SeriesInstanceUID": str(getattr(ds, "SeriesInstanceUID", "")),
            "SOPInstanceUID": str(getattr(ds, "SOPInstanceUID", "")),
            "Modality": str(getattr(ds, "Modality", "")),
        }
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------
# GUARDAR IMAGEN + REGISTRAR EN BD
# ---------------------------------------------------------
async def save_image_and_register(db: Session, estudio_id: int, file: UploadFile | object) -> EstudioImagen:
    """
    file puede ser:
    - UploadFile (frontend)
    - FakeUpload (procesador DICOM)
    """

    # Crear carpeta del estudio
    estudio_dir = DICOMS_BASE / f"estudio_{estudio_id}"
    estudio_dir.mkdir(parents=True, exist_ok=True)

    # Nombre único
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["png", "jpg", "jpeg", "dcm"]:
        raise HTTPException(status_code=400, detail="Formato no permitido")

    new_filename = f"{uuid.uuid4()}.{ext}"
    file_path = estudio_dir / new_filename

    # Guardar archivo físico
    contenido = await file.read()
    with open(file_path, "wb") as f:
        f.write(contenido)

    # Metadata y thumbnail
    dicom_metadata = None
    thumbnail_url = None

    if ext == "dcm":
        dicom_metadata = extraer_metadata_dicom(file_path)
        thumbnail_url = generar_thumbnail_dicom(file_path, new_filename)
    else:
        thumbnail_url = generar_thumbnail(file_path, new_filename)

    # Registrar en BD
    try:
        ruta_publica = f"/static/dicoms/estudio_{estudio_id}/{new_filename}"

        imagen = EstudioImagen(
            estudio_id=estudio_id,
            ruta_archivo=ruta_publica,
            dicom_metadata=dicom_metadata,
            thumbnail=thumbnail_url,
            fecha_subida=datetime.now(),
        )

        db.add(imagen)
        db.commit()
        db.refresh(imagen)

        # URL pública para el frontend
        imagen.url = ruta_publica

        return imagen

    except SQLAlchemyError as e:
        db.rollback()
        raise RuntimeError(f"Error al registrar la imagen del estudio: {str(e)}")


# ---------------------------------------------------------
# LISTAR IMÁGENES DE UN ESTUDIO
# ---------------------------------------------------------
def obtener_imagenes_por_estudio(db: Session, estudio_id: int):
    return (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == estudio_id)
        .order_by(EstudioImagen.id.asc())
        .all()
    )


# ---------------------------------------------------------
# ELIMINAR CARPETA FÍSICA DEL ESTUDIO
# ---------------------------------------------------------
import shutil

def eliminar_carpeta_estudio(estudio_id: int):
    estudio_dir = DICOMS_BASE / f"estudio_{estudio_id}"

    if estudio_dir.exists():
        shutil.rmtree(estudio_dir, ignore_errors=True)

    # Eliminar thumbnails asociados
    for filename in os.listdir(THUMB_DIR):
        if f"{estudio_id}" in filename:
            try:
                os.remove(THUMB_DIR / filename)
            except:
                pass