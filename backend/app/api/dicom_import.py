"""
dicom_import.py — MI_PACS (versión moderna)
-------------------------------------------
Importación automática de estudios DICOM usando el modelo moderno.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime, date
import shutil
import numpy as np
from PIL import Image
from pydicom import dcmread

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

from app.services.estudio_service import crear_estudio
from app.schemas.estudio import EstudioCreate


router = APIRouter(prefix="/dicom", tags=["Importación DICOM"])


# ---------------------------------------------------------
# Rutas clínicas del sistema PACS
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
STATIC_DIR = BASE_DIR / "static"
DICOMS_DIR = STATIC_DIR / "dicoms"
THUMBS_DIR = STATIC_DIR / "thumbnails"

INBOX = BASE_DIR / "dicom_inbox"
ARCHIVO = BASE_DIR / "dicom_archivados"

# Crear carpetas si no existen
for carpeta in [DICOMS_DIR, THUMBS_DIR, INBOX, ARCHIVO]:
    carpeta.mkdir(exist_ok=True)


# ---------------------------------------------------------
# Convertir fecha DICOM (YYYYMMDD) a date
# ---------------------------------------------------------
def parse_fecha_nacimiento(dicom_birth_date: str | None) -> date:
    if not dicom_birth_date:
        return date(1900, 1, 1)
    try:
        return datetime.strptime(dicom_birth_date, "%Y%m%d").date()
    except:
        return date(1900, 1, 1)


# ---------------------------------------------------------
# Generar miniatura PNG desde un archivo DICOM
# ---------------------------------------------------------
def generar_thumbnail(dicom_path: Path, thumbnail_path: Path):
    try:
        ds = dcmread(dicom_path)

        if "PixelData" not in ds:
            return None

        arr = ds.pixel_array.astype(np.float32)

        arr -= arr.min()
        arr /= arr.max()
        arr *= 255.0

        img = Image.fromarray(arr.astype(np.uint8))
        img.thumbnail((256, 256))
        img.save(thumbnail_path)

        return str(thumbnail_path)

    except Exception as e:
        print("Error generando thumbnail:", e)
        return None


# ---------------------------------------------------------
# IMPORTAR ESTUDIOS DICOM (solo admin y técnico)
# ---------------------------------------------------------
@router.post("/importar")
def importar_dicom(
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["admin", "tecnico"])

    archivos = list(INBOX.glob("*"))

    if not archivos:
        return {"mensaje": "No hay archivos DICOM para importar."}

    resultados = []

    for archivo in archivos:
        try:
            ds = dcmread(archivo)

            # ---------------------------------------------------------
            # 1. Datos del paciente
            # ---------------------------------------------------------
            patient_id = getattr(ds, "PatientID", None)
            raw_name = str(getattr(ds, "PatientName", "Desconocido"))
            partes = raw_name.split("^")

            primer_apellido = partes[0] if len(partes) > 0 else "Desconocido"
            primer_nombre = partes[1] if len(partes) > 1 else "Paciente"
            fecha_nacimiento = parse_fecha_nacimiento(getattr(ds, "PatientBirthDate", None))

            # Buscar o crear paciente
            paciente = db.query(Paciente).filter_by(identificacion=patient_id).first()

            if not paciente:
                paciente = Paciente(
                    identificacion=patient_id,
                    primer_nombre=primer_nombre,
                    segundo_nombre=None,
                    primer_apellido=primer_apellido,
                    segundo_apellido=None,
                    fecha_nacimiento=fecha_nacimiento,
                    email=None,
                    password_hash=None,
                )
                db.add(paciente)
                db.commit()
                db.refresh(paciente)

            # ---------------------------------------------------------
            # 2. Datos del estudio (MODERNO)
            # ---------------------------------------------------------
            study_desc = getattr(ds, "StudyDescription", "Sin descripción")
            study_date = getattr(ds, "StudyDate", None)
            modality = getattr(ds, "Modality", "RX")
            uid = getattr(ds, "StudyInstanceUID", f"generated-{datetime.now().timestamp()}")

            fecha_estudio = None
            if study_date:
                try:
                    fecha_estudio = datetime.strptime(study_date, "%Y%m%d").date()
                except:
                    fecha_estudio = date.today()

            # Crear estudio moderno
            data = EstudioCreate(
                paciente_id=paciente.id,
                tipo_estudio=modality,
                fecha_estudio=fecha_estudio,
                descripcion=study_desc,
                uid=uid
            )

            nuevo_estudio = crear_estudio(db, data)

            # ---------------------------------------------------------
            # 3. Registrar imagen DICOM
            # ---------------------------------------------------------
            sop_uid = getattr(ds, "SOPInstanceUID", f"generated-{datetime.now().timestamp()}")
            nombre_archivo = f"{sop_uid}.dcm"

            # Carpeta física del estudio
            carpeta_estudio = DICOMS_DIR / f"estudio_{nuevo_estudio.id}"
            carpeta_estudio.mkdir(exist_ok=True)

            destino_static = carpeta_estudio / nombre_archivo
            shutil.copy(str(archivo), str(destino_static))

            # Thumbnail
            thumbnail_path = THUMBS_DIR / f"{sop_uid}.png"
            generar_thumbnail(destino_static, thumbnail_path)

            metadata = {
                "Modality": getattr(ds, "Modality", None),
                "SeriesNumber": getattr(ds, "SeriesNumber", None),
                "SOPInstanceUID": sop_uid,
                "ViewPosition": getattr(ds, "ViewPosition", None),
                "BodyPartExamined": getattr(ds, "BodyPartExamined", None),
                "AcquisitionDate": getattr(ds, "AcquisitionDate", None),
                "AcquisitionTime": getattr(ds, "AcquisitionTime", None),
            }

            imagen = EstudioImagen(
                estudio_id=nuevo_estudio.id,
                ruta_archivo=f"/static/dicoms/estudio_{nuevo_estudio.id}/{nombre_archivo}",
                dicom_metadata=metadata,
                thumbnail=f"/static/thumbnails/{sop_uid}.png"
            )

            db.add(imagen)
            db.commit()

            # ---------------------------------------------------------
            # 4. Mover archivo original a dicom_archivados
            # ---------------------------------------------------------
            destino_archivo = ARCHIVO / archivo.name
            shutil.move(str(archivo), str(destino_archivo))

            resultados.append({
                "archivo": archivo.name,
                "paciente": f"{primer_apellido}, {primer_nombre}",
                "id": patient_id,
                "estudio": study_desc,
                "imagen": imagen.ruta_archivo,
                "thumbnail": imagen.thumbnail
            })

        except Exception as e:
            resultados.append({
                "archivo": archivo.name,
                "error": str(e)
            })

    return {
        "mensaje": "Importación completada",
        "importados": resultados
    }