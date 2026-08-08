"""
dicom_store_api.py — MI_PACS (BLINDADO)
---------------------------------------------------------
Envía archivos DICOM a un servidor remoto usando DCMTK (storescu.exe).

Responsabilidades:
✔ Validar archivo DICOM clínico
✔ Resolver ruta física de forma segura (Anti Path-Traversal)
✔ Obtener configuración DICOM del sistema
✔ Ejecutar storescu.exe con parámetros clínicos de forma segura
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

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA
from app.core.config import STATIC_DIR, BACKEND_DIR

router = APIRouter(prefix="/dicom", tags=["DICOM Store"])


# ---------------------------------------------------------
# 🛡️ Ruta dinámica del ejecutable storescu.exe
# (Se adapta automáticamente al entorno donde corra el servidor)
# ---------------------------------------------------------
STORESCU_PATH = BACKEND_DIR / "tools" / "dcmtk" / "bin" / "storescu.exe"


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
    requiere_rol(usuario, ["admin", "tecnico"])

    # -----------------------------------------------------
    # 1. Validar ejecutable DCMTK
    # -----------------------------------------------------
    if not STORESCU_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail="Error interno: Herramienta de transmisión DICOM no disponible en el servidor."
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
    # 3. 🛡️ Resolver ruta física de forma SEGURA (Anti Path Traversal)
    # -----------------------------------------------------
    # Limpiamos prefijos y creamos la ruta combinada
    public_path = payload.file_path.replace("/static/", "").lstrip("/")
    
    # .resolve() elimina cualquier "../" y calcula la ruta real absoluta en el disco
    full_path = (STATIC_DIR / public_path).resolve()
    static_absoluto = STATIC_DIR.resolve()

    # BLOQUEO CRÍTICO: Verificamos que la ruta final realmente pertenezca a la carpeta estática
    # Si alguien envió "../", la ruta intentará salir y esto lanzará el error.
    try:
        full_path.relative_to(static_absoluto)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Alerta de Seguridad: Intento de acceso a un directorio no permitido."
        )

    if not full_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Archivo DICOM no encontrado en el almacenamiento autorizado."
        )

    if full_path.suffix.lower() != ".dcm":
        raise HTTPException(
            status_code=400,
            detail="Solo se permite la transmisión de archivos con formato .dcm"
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
            detail="Tiempo de espera agotado al comunicar con el servidor DICOM remoto."
        )

    # -----------------------------------------------------
    # 6. Manejo de errores DICOM
    # -----------------------------------------------------
    if result.returncode != 0:
        # 🛡️ Evitamos devolver stdout/stderr completo si no es necesario para evitar fuga de información de red interna
        error_msg = result.stderr.strip() if result.stderr else "Error desconocido de transmisión."
        raise HTTPException(
            status_code=502,
            detail=f"El servidor de destino rechazó la transmisión: {error_msg}"
        )

    # -----------------------------------------------------
    # 7. Respuesta clínica
    # -----------------------------------------------------
    return {
        "message": "Archivo DICOM transmitido correctamente.",
        "output": "Transmisión exitosa (Status OK)"
    }