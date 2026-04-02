from fastapi import APIRouter, HTTPException
import os
import zipfile
from pathlib import Path
import pydicom
from PIL import Image
import numpy as np

from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BASE_DIR / "static"
DICOMS_DIR = STATIC_DIR / "dicoms"
THUMB_DIR = STATIC_DIR / "thumbnails"


# ---------------------------------------------------------
# 1) GENERAR THUMBNAILS
# ---------------------------------------------------------
@router.post("/dicom/generar-thumbnails")
def generar_thumbnails():
    db = SessionLocal()
    generados = 0

    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    imagenes = db.query(EstudioImagen).all()

    for img in imagenes:
        try:
            dicom_path = Path(img.ruta_archivo)
            ds = pydicom.dcmread(dicom_path, force=True)

            if "PixelData" not in ds:
                continue

            arr = ds.pixel_array

            # Normalizar a 8 bits
            arr = arr.astype(float)
            arr = (arr - arr.min()) / (arr.max() - arr.min()) * 255
            arr = arr.astype("uint8")

            image = Image.fromarray(arr)
            thumb_path = THUMB_DIR / f"{img.id}.jpg"
            image.save(thumb_path)

            img.thumbnail = str(thumb_path)
            generados += 1

        except Exception:
            continue

    db.commit()
    db.close()

    return {
        "status": "ok",
        "thumbnails_generados": generados
    }


# ---------------------------------------------------------
# 2) RECONSTRUIR ESTUDIOS DAÑADOS
# ---------------------------------------------------------
@router.post("/dicom/reconstruir-estudios")
def reconstruir_estudios():
    db = SessionLocal()
    reparados = 0

    for estudio in db.query(Estudio).all():
        if not estudio.archivo or not os.path.exists(estudio.archivo):
            # Buscar una imagen válida
            imagen = (
                db.query(EstudioImagen)
                .filter(EstudioImagen.estudio_id == estudio.id)
                .first()
            )
            if imagen and os.path.exists(imagen.ruta_archivo):
                estudio.archivo = imagen.ruta_archivo
                reparados += 1

    db.commit()
    db.close()

    return {
        "status": "ok",
        "estudios_reparados": reparados
    }


# ---------------------------------------------------------
# 3) EXPORTAR ESTUDIO A ZIP
# ---------------------------------------------------------
@router.get("/dicom/exportar/{estudio_id}")
def exportar_estudio(estudio_id: int):
    db = SessionLocal()

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    imagenes = (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == estudio_id)
        .all()
    )

    if not imagenes:
        raise HTTPException(status_code=404, detail="El estudio no tiene imágenes")

    zip_path = STATIC_DIR / f"estudio_{estudio_id}.zip"

    with zipfile.ZipFile(zip_path, "w") as zipf:
        for img in imagenes:
            if os.path.exists(img.ruta_archivo):
                zipf.write(img.ruta_archivo, arcname=os.path.basename(img.ruta_archivo))

    return {
        "status": "ok",
        "archivo_zip": str(zip_path)
    }