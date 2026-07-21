from fastapi import APIRouter, HTTPException
import os
from pathlib import Path
import pydicom
from pydicom.dataset import Dataset, FileDataset
from datetime import datetime

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA (FANTASMA ELIMINADO)
from app.core.config import STATIC_DIR

router = APIRouter()

DICOMS_DIR = STATIC_DIR / "dicoms"


# GENERAR DICOMDIR

@router.get("/dicom/generar-dicomdir/{estudio_id}")
def generar_dicomdir(estudio_id: int):
    estudio_dir = DICOMS_DIR / str(estudio_id)

    if not estudio_dir.exists():
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    dicomdir_path = estudio_dir / "DICOMDIR"

    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = pydicom.uid.MediaStorageDirectoryStorage
    file_meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
    file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian

    ds = FileDataset(
        dicomdir_path,
        {},
        file_meta=file_meta,
        preamble=b"\0" * 128
    )

    ds.PatientName = "DICOMDIR"
    ds.PatientID = "DICOMDIR"
    ds.ContentDate = datetime.now().strftime("%Y%m%d")
    ds.ContentTime = datetime.now().strftime("%H%M%S")

    ds.save_as(dicomdir_path)

    return {
        "status": "ok",
        "dicomdir": str(dicomdir_path)
    }

# EXPORTER ESTUDIOS COMO CD COMPLETO

import zipfile
from shutil import copy2

@router.get("/dicom/exportar-cd/{estudio_id}")
def exportar_cd(estudio_id: int):
    estudio_dir = DICOMS_DIR / str(estudio_id)

    if not estudio_dir.exists():
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    cd_root = STATIC_DIR / f"CD_{estudio_id}"
    dicom_folder = cd_root / "DICOM"
    dicom_folder.mkdir(parents=True, exist_ok=True)

    # Copiar archivos
    for f in estudio_dir.glob("*.dcm"):
        copy2(f, dicom_folder)

    # Generar DICOMDIR
    dicomdir_path = cd_root / "DICOMDIR"
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = pydicom.uid.MediaStorageDirectoryStorage
    file_meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
    file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian

    ds = FileDataset(
        dicomdir_path,
        {},
        file_meta=file_meta,
        preamble=b"\0" * 128
    )
    ds.save_as(dicomdir_path)

    # Crear ZIP
    zip_path = STATIC_DIR / f"CD_{estudio_id}.zip"
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for root, dirs, files in os.walk(cd_root):
            for file in files:
                full = Path(root) / file
                zipf.write(full, arcname=str(full.relative_to(cd_root)))

    return {
        "status": "ok",
        "archivo_zip": str(zip_path)
    }


# CONVERTIR ESTUDIOS A JPG/PNG MASIVAMENTE

from PIL import Image
import numpy as np

@router.get("/dicom/convertir/{estudio_id}")
def convertir_estudio(estudio_id: int, formato: str = "jpg"):
    estudio_dir = DICOMS_DIR / str(estudio_id)

    if not estudio_dir.exists():
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    output_dir = estudio_dir / "export"
    output_dir.mkdir(exist_ok=True)

    convertidos = 0

    for f in estudio_dir.glob("*.dcm"):
        try:
            ds = pydicom.dcmread(f, force=True)
            arr = ds.pixel_array

            arr = arr.astype(float)
            arr = (arr - arr.min()) / (arr.max() - arr.min()) * 255
            arr = arr.astype("uint8")

            img = Image.fromarray(arr)
            out_path = output_dir / f"{f.stem}.{formato}"
            img.save(out_path)
            convertidos += 1
        except:
            continue

    return {
        "status": "ok",
        "convertidos": convertidos,
        "carpeta": str(output_dir)
    }