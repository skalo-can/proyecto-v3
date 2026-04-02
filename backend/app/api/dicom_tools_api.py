from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from pathlib import Path
from pydicom import dcmread

from app.dicom_utils.dicom_preprocessor import import_from_folder

router = APIRouter()

INBOX_DIR = r"D:\proyecto v3\backend\dicom_inbox"


# -------------------------------
# MODELOS
# -------------------------------
class PathRequest(BaseModel):
    path: str


# -------------------------------
# 1) LISTAR ARCHIVOS DETECTADOS
# -------------------------------
@router.post("/dicom/listar-archivos")
def listar_archivos(data: PathRequest):
    folder = Path(data.path)

    if not folder.exists():
        raise HTTPException(status_code=400, detail="La ruta no existe.")

    encontrados = []

    for root, dirs, files in os.walk(folder):
        for f in files:
            full = Path(root) / f
            try:
                with open(full, "rb") as fp:
                    preamble = fp.read(132)
                    if preamble[128:132] == b"DICM":
                        encontrados.append(str(full))
            except:
                continue

    return {
        "status": "ok",
        "total_detectados": len(encontrados),
        "archivos": encontrados
    }


# -------------------------------
# 2) VALIDAR CD / CARPETA DICOM
# -------------------------------
@router.post("/dicom/validar")
def validar_dicom(data: PathRequest):
    folder = Path(data.path)

    if not folder.exists():
        raise HTTPException(status_code=400, detail="La ruta no existe.")

    dicomdir = folder / "DICOMDIR"
    tiene_dicomdir = dicomdir.exists()

    archivos_validos = 0
    archivos_invalidos = 0

    for root, dirs, files in os.walk(folder):
        for f in files:
            full = Path(root) / f
            try:
                ds = dcmread(full, force=True)
                if hasattr(ds, "SOPInstanceUID"):
                    archivos_validos += 1
                else:
                    archivos_invalidos += 1
            except:
                archivos_invalidos += 1

    return {
        "status": "ok",
        "tiene_dicomdir": tiene_dicomdir,
        "archivos_validos": archivos_validos,
        "archivos_invalidos": archivos_invalidos,
        "diagnostico": "OK" if archivos_validos > 0 else "NO SE DETECTARON DICOM"
    }


# -------------------------------
# 3) LIMPIAR INBOX
# -------------------------------
@router.delete("/dicom/limpiar-inbox")
def limpiar_inbox():
    if not os.path.exists(INBOX_DIR):
        raise HTTPException(status_code=400, detail="El inbox no existe.")

    eliminados = 0

    for f in os.listdir(INBOX_DIR):
        full = os.path.join(INBOX_DIR, f)
        try:
            os.remove(full)
            eliminados += 1
        except:
            continue

    return {
        "status": "ok",
        "eliminados": eliminados
    }


# -------------------------------
# 4) REPROCESAR INBOX
# -------------------------------
@router.post("/dicom/reprocesar-inbox")
def reprocesar_inbox():
    from app.dicom_importer import process_inbox

    try:
        process_inbox()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reprocesando: {e}")

    return {
        "status": "ok",
        "mensaje": "Reprocesamiento completado."
    }