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
# GENERACIÓN DE SUB-RUTAS (ARQUITECTURA ESCALABLE)
# ---------------------------------------------------------
def obtener_ruta_jerarquica() -> str:
    """Devuelve una ruta en formato YYYY/MM/DD para evitar cuellos de botella."""
    hoy = datetime.now()
    return f"{hoy.year}/{hoy.month:02d}/{hoy.day:02d}"


# ---------------------------------------------------------
# MINIATURAS PARA IMÁGENES NO DICOM
# ---------------------------------------------------------
def generar_thumbnail(image_path: Path, nombre_base: str, subcarpeta: str) -> str:
    """
    Genera una miniatura PNG de 200x200 px para imágenes no DICOM.
    La guarda en la estructura jerárquica YYYY/MM/DD.
    """
    # Crear la subcarpeta jerárquica si no existe
    carpeta_destino = THUMB_DIR / subcarpeta
    os.makedirs(carpeta_destino, exist_ok=True)

    thumb_filename = f"{nombre_base}.png"
    thumb_path = carpeta_destino / thumb_filename

    with Image.open(image_path) as img:
        img.thumbnail((200, 200))
        img.save(thumb_path, "PNG")

    return f"/static/thumbnails/{subcarpeta}/{thumb_filename}"


# ---------------------------------------------------------
# MINIATURA PARA DICOM
# ---------------------------------------------------------
def generar_thumbnail_dicom(dicom_path: Path, nombre_base: str, subcarpeta: str) -> str | None:
    """
    Extrae la imagen del DICOM y la guarda en la estructura jerárquica YYYY/MM/DD.
    """
    try:
        ds = pydicom.dcmread(str(dicom_path), force=True)

        if "PixelData" not in ds:
            return None

        arr = ds.pixel_array
        img = Image.fromarray(arr)
        img.thumbnail((200, 200))

        # Crear la subcarpeta jerárquica si no existe
        carpeta_destino = THUMB_DIR / subcarpeta
        os.makedirs(carpeta_destino, exist_ok=True)

        thumb_filename = f"{nombre_base}.png"
        thumb_path = carpeta_destino / thumb_filename
        img.save(thumb_path, "PNG")

        return f"/static/thumbnails/{subcarpeta}/{thumb_filename}"

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
    Guarda el archivo y usa la arquitectura escalable para el thumbnail.
    """
    # Crear carpeta del estudio (DICOMs originales)
    estudio_dir = DICOMS_BASE / f"estudio_{estudio_id}"
    estudio_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.split(".")[-1].lower()
    if ext not in ["png", "jpg", "jpeg", "dcm"]:
        raise HTTPException(status_code=400, detail="Formato no permitido")

    new_filename = f"{uuid.uuid4()}.{ext}"
    file_path = estudio_dir / new_filename

    # Guardar archivo físico original
    contenido = await file.read()
    with open(file_path, "wb") as f:
        f.write(contenido)

    # Variables para metadata y thumbnail
    dicom_metadata = None
    thumbnail_url = None
    
    # Obtener la ruta jerárquica (YYYY/MM/DD)
    subcarpeta_fecha = obtener_ruta_jerarquica()

    if ext == "dcm":
        dicom_metadata = extraer_metadata_dicom(file_path)
        # ESTA ES LA MAGIA: Intentamos usar el StudyInstanceUID real como nombre
        uid_estudio = dicom_metadata.get("StudyInstanceUID")
        # Si no tiene UID (raro pero posible), usamos un UUID
        nombre_thumb = uid_estudio if uid_estudio else str(uuid.uuid4())
        
        thumbnail_url = generar_thumbnail_dicom(file_path, nombre_thumb, subcarpeta_fecha)
    else:
        nombre_thumb = str(uuid.uuid4())
        thumbnail_url = generar_thumbnail(file_path, nombre_thumb, subcarpeta_fecha)

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
    # Eliminar DICOMs originales
    estudio_dir = DICOMS_BASE / f"estudio_{estudio_id}"
    if estudio_dir.exists():
        shutil.rmtree(estudio_dir, ignore_errors=True)

    # NOTA: Los thumbnails ahora están en estructura YYYY/MM/DD y la eliminación
    # definitiva se hará vía Base de Datos con una política de retención (ej. 15 años).
    # La eliminación individual por nombre ya no se recomienda aquí para mantener el rendimiento.