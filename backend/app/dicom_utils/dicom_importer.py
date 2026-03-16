"""
dicom_importer.py — MI_PACS
---------------------------------------------------------
Módulo clínico responsable del procesamiento completo de archivos DICOM
provenientes de la bandeja de entrada (dicom_inbox).

Rol dentro del ecosistema MI_PACS:
----------------------------------
Este módulo es el corazón del flujo PACS. Actúa como puente entre:

✔ Motor DICOM (pydicom)
✔ Base de datos clínica (Paciente, Estudio, EstudioImagen)
✔ Sistema de archivos clínico (static/dicoms)
✔ Visor DICOM del frontend

Responsabilidades clínicas:
---------------------------
1. Leer archivos DICOM desde dicom_inbox
2. Extraer metadata clínica relevante
3. Crear o actualizar:
   - Paciente
   - Estudio
   - EstudioImagen
4. Construir estructura clínica en disco:
   static/dicoms/<Paciente>/<StudyUID>/<SeriesUID>/
5. Mover el archivo DICOM a su ubicación definitiva
6. Registrar la imagen en la base de datos
7. Mantener trazabilidad completa del flujo PACS

Garantías clínicas:
-------------------
✔ Nunca crea carpetas fuera de static/dicoms  
✔ Nunca usa rutas relativas  
✔ Nunca interrumpe el flujo PACS por un archivo corrupto  
✔ Mantiene compatibilidad con visores DICOM estándar  

Este módulo NO:
---------------
✘ Genera miniaturas  
✘ Expone rutas públicas  
✘ Interactúa con FastAPI directamente  
✘ Modifica configuraciones DICOM  
"""

import os
import shutil
from datetime import datetime, date

import pydicom
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen


# ---------------------------------------------------------
# Rutas clínicas absolutas
# ---------------------------------------------------------
DICOM_INBOX = r"D:\proyecto v3\backend\dicom_inbox"
DICOM_STORAGE_ROOT = r"D:\proyecto v3\backend\static\dicoms"


# ---------------------------------------------------------
# Utilidades internas
# ---------------------------------------------------------
def _safe_get(ds, tag, default=None):
    """Obtiene un atributo DICOM de forma segura."""
    return getattr(ds, tag, default)


def _parse_patient_name(patient_name):
    """
    Convierte PatientName DICOM (ej. 'GARCIA^JUAN^CARLOS') en:
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
    """
    if not patient_name:
        return "DESCONOCIDO", None, "PACIENTE", None

    parts = str(patient_name).replace("^", " ").split()

    if len(parts) == 1:
        return parts[0], None, "PACIENTE", None
    if len(parts) == 2:
        return parts[1], None, parts[0], None
    if len(parts) == 3:
        return parts[1], parts[2], parts[0], None

    return parts[1], parts[2], parts[0], " ".join(parts[3:])


def _parse_date(dicom_date):
    """Convierte una fecha DICOM (YYYYMMDD) a date de Python."""
    if not dicom_date:
        return date.today()
    try:
        return datetime.strptime(dicom_date, "%Y%m%d").date()
    except Exception:
        return date.today()


# ---------------------------------------------------------
# Procesamiento de un archivo DICOM
# ---------------------------------------------------------
def process_single_dicom_file(db: Session, file_path: str):
    """
    Procesa un único archivo DICOM y lo integra al sistema clínico MI_PACS.

    Flujo clínico:
    --------------
    1. Leer encabezado DICOM
    2. Extraer metadata
    3. Crear/actualizar Paciente
    4. Crear/actualizar Estudio
    5. Registrar EstudioImagen
    6. Mover archivo a static/dicoms/<Paciente>/<StudyUID>/<SeriesUID>/
    """

    print(f"MI_PACS → Procesando archivo DICOM: {file_path}")

    try:
        ds = pydicom.dcmread(file_path, force=True)
    except Exception as e:
        print(f"MI_PACS → Error leyendo DICOM: {file_path} → {e}")
        return

    # -----------------------------
    # 1. Extraer metadata clínica
    # -----------------------------
    patient_id = _safe_get(ds, "PatientID", "SIN_ID")
    patient_name = _safe_get(ds, "PatientName", "PACIENTE^DESCONOCIDO")
    birth_date = _safe_get(ds, "PatientBirthDate", None)

    study_uid = _safe_get(ds, "StudyInstanceUID", None)
    series_uid = _safe_get(ds, "SeriesInstanceUID", None)
    sop_uid = _safe_get(ds, "SOPInstanceUID", None)

    study_date = _safe_get(ds, "StudyDate", None)
    modality = _safe_get(ds, "Modality", "OT")
    study_description = _safe_get(ds, "StudyDescription", "Estudio sin descripción")

    if not study_uid or not sop_uid:
        print("MI_PACS → DICOM sin StudyInstanceUID o SOPInstanceUID. Se omite.")
        return

    # -----------------------------
    # 2. Paciente
    # -----------------------------
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido = _parse_patient_name(patient_name)
    fecha_nacimiento = _parse_date(birth_date) if birth_date else date(1970, 1, 1)

    paciente = (
        db.query(Paciente)
        .filter(Paciente.identificacion == patient_id)
        .first()
    )

    if not paciente:
        paciente = Paciente(
            identificacion=patient_id,
            primer_nombre=primer_nombre,
            segundo_nombre=segundo_nombre,
            primer_apellido=primer_apellido,
            segundo_apellido=segundo_apellido,
            fecha_nacimiento=fecha_nacimiento,
            email=None,
            password_hash=None,
        )
        db.add(paciente)
        db.flush()
        print(f"MI_PACS → Paciente creado: {paciente.identificacion}")
    else:
        print(f"MI_PACS → Paciente existente: {paciente.identificacion}")

    # -----------------------------
    # 3. Estudio
    # -----------------------------
    fecha_estudio = _parse_date(study_date) if study_date else date.today()

    estudio = (
        db.query(Estudio)
        .filter(
            Estudio.paciente_id == paciente.id,
            Estudio.descripcion == study_description,
        )
        .first()
    )

    if not estudio:
        estudio = Estudio(
            paciente_id=paciente.id,
            tipo=modality,
            fecha=fecha_estudio,
            estado="pendiente",
            descripcion=study_description,
            archivo=None,
        )
        db.add(estudio)
        db.flush()
        print(f"MI_PACS → Estudio creado: ID={estudio.id}, tipo={modality}")
    else:
        print(f"MI_PACS → Estudio existente: ID={estudio.id}")

    # -----------------------------
    # 4. Construir ruta final
    # -----------------------------
    patient_folder = os.path.join(DICOM_STORAGE_ROOT, str(patient_id))
    study_folder = os.path.join(patient_folder, study_uid)
    series_folder = os.path.join(study_folder, series_uid or "SERIE_DESCONOCIDA")

    os.makedirs(series_folder, exist_ok=True)

    final_filename = f"{sop_uid}.dcm"
    final_path = os.path.join(series_folder, final_filename)

    try:
        shutil.move(file_path, final_path)
    except Exception as e:
        print(f"MI_PACS → Error moviendo archivo a storage final: {e}")
        return

    # -----------------------------
    # 5. Registrar imagen
    # -----------------------------
    metadata_dict = {
        "PatientID": patient_id,
        "PatientName": str(patient_name),
        "StudyInstanceUID": study_uid,
        "SeriesInstanceUID": series_uid,
        "SOPInstanceUID": sop_uid,
        "StudyDate": study_date,
        "Modality": modality,
        "StudyDescription": study_description,
    }

    imagen = EstudioImagen(
        estudio_id=estudio.id,
        ruta_archivo=final_path,
        dicom_metadata=metadata_dict,
        thumbnail=None,
        fecha_subida=datetime.utcnow(),
    )
    db.add(imagen)

    if not estudio.archivo:
        estudio.archivo = final_path

    db.commit()
    print(f"MI_PACS → Imagen registrada en BD: {final_path}")


# ---------------------------------------------------------
# Procesamiento de la bandeja dicom_inbox
# ---------------------------------------------------------
def process_inbox():
    """
    Procesa todos los archivos DICOM presentes en dicom_inbox.

    Garantías:
    ----------
    ✔ No interrumpe el flujo si un archivo falla  
    ✔ Procesa solo archivos DICOM válidos  
    ✔ Mantiene trazabilidad completa  
    """
    print("MI_PACS → Iniciando procesamiento de dicom_inbox…")

    if not os.path.isdir(DICOM_INBOX):
        print(f"MI_PACS → Carpeta dicom_inbox no existe: {DICOM_INBOX}")
        return

    db = SessionLocal()

    try:
        for filename in os.listdir(DICOM_INBOX):
            file_path = os.path.join(DICOM_INBOX, filename)

            if not os.path.isfile(file_path):
                continue

            if not (filename.lower().endswith(".dcm") or "." not in filename):
                print(f"MI_PACS → Archivo no DICOM, se omite: {filename}")
                continue

            process_single_dicom_file(db, file_path)

    finally:
        db.close()
        print("MI_PACS → Procesamiento de dicom_inbox finalizado.")


if __name__ == "__main__":
    process_inbox()