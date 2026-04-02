from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

from app.dicom_utils.dicom_preprocessor import import_from_folder

router = APIRouter()

# Ruta real del inbox
INBOX_DIR = r"D:\proyecto v3\backend\dicom_inbox"


class ImportRequest(BaseModel):
    path: str


@router.post("/dicom/importar-desde-disco")
def importar_desde_disco(data: ImportRequest):
    folder_path = data.path

    if not os.path.exists(folder_path):
        raise HTTPException(status_code=400, detail="La ruta no existe en el sistema.")

    try:
        count = import_from_folder(folder_path, INBOX_DIR)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importando archivos: {e}")

    return {
        "status": "ok",
        "mensaje": "Importación completada.",
        "archivos_detectados": count,
        "inbox": INBOX_DIR
    }