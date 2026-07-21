"""
dicom_store_api.py — MI_PACS
---------------------------------------------------------
Envía archivos DICOM a un servidor remoto usando DCMTK (storescu.exe).

Responsabilidades:
✔ Validar archivo DICOM clínico
✔ Resolver ruta física desde ruta pública del frontend
✔ Obtener configuración DICOM del sistema
✔ Ejecutar storescu.exe con parámetros clínicos
✔ Entregar respuesta clara al usuario técnico
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import subprocess

from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol
from app.core.database import get_db

from app.schemas.dicom_config import DicomConfigResponse
from app.models.dicom_config import DicomConfig

from pydantic import BaseModel, Field

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA (FANTASMA ELIMINADO)
from app.core.config import STATIC_DIR


router = APIRouter(prefix="/dicom", tags=["DICOM Store"])


# ---------------------------------------------------------
# Ruta absoluta del ejecutable storescu.exe
# ---------------------------------------------------------
STORESCU_PATH = Path(r"D:\proyecto v3\backend\tools\dcmtk\bin\storescu.exe")


# ---------------------------------------------------------
# Schema clínico de entrada
# ---------------------------------------------------------
class StoreRequest(BaseModel):
    file_path: str = Field(
        ...,
        example="/static/dicoms/estudio_12/imagen_01.dcm",
        description="Ruta pública del archivo DICOM (desde el frontend)"
    )


# ---------------------------------------------------------
# Enviar archivo DICOM usando configuración del sistema
# ---------------------------------------------------------
@router.post("/send")
def send_dicom_endpoint(
    payload: StoreRequest,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Envía un archivo DICOM a un servidor remoto usando DCMTK.

    Permisos:
    ✔ admin
    ✔ tecnico
    """

    requiere_rol(usuario, ["admin", "tecnico"])

    # -----------------------------------------------------
    # 1. Validar ejecutable DCMTK
    # -----------------------------------------------------
    if not STORESCU_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"No se encontró storescu.exe en: {STORESCU_PATH}"
        )

    # -----------------------------------------------------
    # 2. Obtener configuración DICOM del sistema
    # -----------------------------------------------------
    config = db.query(DicomConfig).filter(DicomConfig.id == 1).first()
    if not config:
        raise HTTPException(
            status_code=500,
            detail="No existe configuración DICOM en el sistema."
        )

    # -----------------------------------------------------
    # 3. Resolver ruta física desde ruta pública usando el Ancla
    # -----------------------------------------------------
    public_path = payload.file_path.replace("/static/", "")
    full_path = STATIC_DIR / public_path

    if not full_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Archivo DICOM no encontrado:\n{full_path}"
        )

    if full_path.suffix.lower() != ".dcm":
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden enviar archivos .dcm"
        )

    # -----------------------------------------------------
    # 4. Construir comando storescu
    # -----------------------------------------------------
    cmd = [
        str(STORESCU_PATH),
        "-aet", config.client_ae,
        "-aec", config.ae_title,
        config.ip,
        str(config.port),
        str(full_path),
    ]

    # -----------------------------------------------------
    # 5. Ejecutar comando DCMTK
    # -----------------------------------------------------
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Tiempo de espera agotado al enviar el archivo DICOM."
        )

    # -----------------------------------------------------
    # 6. Manejo de errores DICOM
    # -----------------------------------------------------
    if result.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"Fallo al enviar DICOM:\n{result.stderr or result.stdout}"
        )

    # -----------------------------------------------------
    # 7. Respuesta clínica
    # -----------------------------------------------------
    return {
        "message": "Archivo DICOM enviado correctamente.",
        "output": result.stdout
    }