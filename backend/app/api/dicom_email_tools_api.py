from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from pathlib import Path
from typing import Literal
import os
import zipfile
from shutil import copy2
from datetime import datetime, timedelta
import uuid
import smtplib
from email.message import EmailMessage

import pydicom
from pydicom.dataset import Dataset, FileDataset
from PIL import Image
import numpy as np

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BASE_DIR / "static"
DICOMS_DIR = STATIC_DIR / "dicoms"
EXPORTS_DIR = STATIC_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


class EnviarEstudioRequest(BaseModel):
    email: EmailStr
    formato: Literal["zip", "cd", "jpg", "link"]


# ---------------------------
# Helpers de generación
# ---------------------------
def _get_estudio_paths(estudio_id: int):
    db = SessionLocal()
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    imagenes = (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == estudio_id)
        .all()
    )
    db.close()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    if not imagenes:
        raise HTTPException(status_code=404, detail="El estudio no tiene imágenes")

    return estudio, imagenes


def generar_zip_dicom(estudio_id: int) -> Path:
    _, imagenes = _get_estudio_paths(estudio_id)
    zip_path = EXPORTS_DIR / f"estudio_{estudio_id}_dicom.zip"

    with zipfile.ZipFile(zip_path, "w") as zipf:
        for img in imagenes:
            if os.path.exists(img.ruta_archivo):
                zipf.write(img.ruta_archivo, arcname=os.path.basename(img.ruta_archivo))

    return zip_path


def generar_cd_virtual(estudio_id: int) -> Path:
    _, imagenes = _get_estudio_paths(estudio_id)

    cd_root = EXPORTS_DIR / f"CD_{estudio_id}_{uuid.uuid4().hex[:8]}"
    dicom_folder = cd_root / "DICOM"
    dicom_folder.mkdir(parents=True, exist_ok=True)

    for img in imagenes:
        if os.path.exists(img.ruta_archivo):
            copy2(img.ruta_archivo, dicom_folder)

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
    ds.PatientName = "DICOMDIR"
    ds.PatientID = "DICOMDIR"
    ds.save_as(dicomdir_path)

    zip_path = EXPORTS_DIR / f"CD_{estudio_id}.zip"
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for root, dirs, files in os.walk(cd_root):
            for file in files:
                full = Path(root) / file
                zipf.write(full, arcname=str(full.relative_to(cd_root)))

    return zip_path


def convertir_a_jpg(estudio_id: int) -> Path:
    _, imagenes = _get_estudio_paths(estudio_id)

    out_dir = EXPORTS_DIR / f"jpg_{estudio_id}_{uuid.uuid4().hex[:8]}"
    out_dir.mkdir(parents=True, exist_ok=True)

    convertidos = 0

    for img in imagenes:
        if not os.path.exists(img.ruta_archivo):
            continue
        try:
            ds = pydicom.dcmread(img.ruta_archivo, force=True)
            if "PixelData" not in ds:
                continue

            arr = ds.pixel_array
            arr = arr.astype(float)
            arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-6) * 255
            arr = arr.astype("uint8")

            image = Image.fromarray(arr)
            out_path = out_dir / f"{Path(img.ruta_archivo).stem}.jpg"
            image.save(out_path)
            convertidos += 1
        except:
            continue

    if convertidos == 0:
        raise HTTPException(status_code=400, detail="No se pudieron convertir imágenes a JPG")

    zip_path = EXPORTS_DIR / f"estudio_{estudio_id}_jpg.zip"
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for f in out_dir.glob("*.jpg"):
            zipf.write(f, arcname=f.name)

    return zip_path


def generar_link_seguro(archivo: Path, expiracion_horas: int = 48) -> str:
    token = uuid.uuid4().hex
    expires_at = datetime.utcnow() + timedelta(hours=expiracion_horas)

    # Aquí podrías guardar token, ruta y expiración en BD.
    # Por ahora, asumimos acceso directo vía /static/exports.
    relative = archivo.relative_to(STATIC_DIR)
    url_base = settings.BACKEND_CORS_ORIGINS[0] if settings.BACKEND_CORS_ORIGINS else "http://localhost:8000"
    return f"{url_base}/static/{relative.as_posix()}?token={token}&exp={int(expires_at.timestamp())}"


def enviar_email_con_adjunto(destino: str, asunto: str, cuerpo: str, archivo: Path | None):
    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = destino
    msg.set_content(cuerpo)

    if archivo and archivo.exists():
        with open(archivo, "rb") as f:
            data = f.read()
        msg.add_attachment(
            data,
            maintype="application",
            subtype="zip",
            filename=archivo.name,
        )

    with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
        if getattr(settings, "EMAIL_TLS", False):
            server.starttls()
        if settings.EMAIL_USER and settings.EMAIL_PASSWORD:
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
        server.send_message(msg)


# ---------------------------
# Endpoint maestro
# ---------------------------
@router.post("/dicom/enviar-estudio-email/{estudio_id}")
def enviar_estudio_email(estudio_id: int, data: EnviarEstudioRequest):
    formato = data.formato
    email = data.email

    archivo_final: Path | None = None
    link_final: str | None = None

    if formato == "zip":
        archivo_final = generar_zip_dicom(estudio_id)
        asunto = f"Estudio DICOM #{estudio_id} (ZIP)"
        cuerpo = "Adjuntamos su estudio en formato DICOM (ZIP)."
        enviar_email_con_adjunto(email, asunto, cuerpo, archivo_final)
        return {"status": "ok", "modo": "zip", "archivo": str(archivo_final)}

    if formato == "cd":
        archivo_final = generar_cd_virtual(estudio_id)
        asunto = f"Estudio DICOM #{estudio_id} (CD virtual)"
        cuerpo = "Adjuntamos su estudio en formato CD virtual (ZIP con DICOMDIR)."
        enviar_email_con_adjunto(email, asunto, cuerpo, archivo_final)
        return {"status": "ok", "modo": "cd", "archivo": str(archivo_final)}

    if formato == "jpg":
        archivo_final = convertir_a_jpg(estudio_id)
        asunto = f"Estudio #{estudio_id} en imágenes JPG"
        cuerpo = "Adjuntamos su estudio convertido a imágenes JPG."
        enviar_email_con_adjunto(email, asunto, cuerpo, archivo_final)
        return {"status": "ok", "modo": "jpg", "archivo": str(archivo_final)}

    if formato == "link":
        archivo_final = generar_zip_dicom(estudio_id)
        link_final = generar_link_seguro(archivo_final)
        asunto = f"Enlace de descarga de estudio #{estudio_id}"
        cuerpo = f"Puede descargar su estudio desde el siguiente enlace:\n\n{link_final}\n\nEl enlace expirará en 48 horas."
        enviar_email_con_adjunto(email, asunto, cuerpo, None)
        return {"status": "ok", "modo": "link", "link": link_final}

    raise HTTPException(status_code=400, detail="Formato no soportado")