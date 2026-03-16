"""
dicom_processor.py — MI_PACS (versión moderna con parada limpia)
Procesador automático basado en metadata DICOM.
"""

import os
import time
import asyncio
import pydicom
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.core.database import SessionLocal

from app.services.paciente_service import (
    crear_paciente_desde_dicom,
    obtener_paciente_por_identificacion
)
from app.services.estudio_service import crear_estudio, obtener_estudio_por_uid
from app.services.estudio_imagen_service import save_image_and_register
from app.schemas.estudio import EstudioCreate
from app.crud.crud_modality import register_modality


# ---------------------------------------------------------
# RUTA DEL INBOX
# ---------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INBOX_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "dicom_inbox"))
os.makedirs(INBOX_DIR, exist_ok=True)


# ---------------------------------------------------------
# CONVERTIR FECHA DICOM
# ---------------------------------------------------------
def convertir_fecha_dicom(dicom_date: str) -> date:
    try:
        return datetime.strptime(dicom_date.strip(), "%Y%m%d").date()
    except:
        return date.today()


# ---------------------------------------------------------
# PROCESADOR PRINCIPAL (con stop_event)
# ---------------------------------------------------------
def iniciar_procesador(stop_event):
    print("MI_PACS → Procesador DICOM basado en metadata iniciado...")
    print("INBOX real:", INBOX_DIR)

    while not stop_event.is_set():
        try:
            procesar_archivos()
        except Exception as e:
            print("❌ Error en procesador DICOM:", str(e))

        # Pequeña pausa para no saturar CPU
        for _ in range(20):
            if stop_event.is_set():
                break
            time.sleep(0.1)

    print("🛑 Procesador DICOM detenido limpiamente.")


# ---------------------------------------------------------
# PROCESAR ARCHIVOS
# ---------------------------------------------------------
def procesar_archivos():
    archivos = os.listdir(INBOX_DIR)
    if not archivos:
        return

    for filename in archivos:
        file_path = os.path.join(INBOX_DIR, filename)
        print("Intentando procesar:", file_path)

        try:
            ds = pydicom.dcmread(file_path, force=True)
        except Exception as e:
            print("❌ Archivo no es DICOM:", filename, str(e))
            continue

        study_uid = getattr(ds, "StudyInstanceUID", None)
        modality = getattr(ds, "Modality", "OT")
        study_date = getattr(ds, "StudyDate", None)
        study_desc = getattr(ds, "StudyDescription", None)
        patient_id = getattr(ds, "PatientID", None)
        patient_name = getattr(ds, "PatientName", None)

        if not study_uid:
            print("❌ DICOM sin StudyInstanceUID, ignorado:", filename)
            continue

        db: Session = SessionLocal()

        try:
            estudio = obtener_o_crear_estudio(
                db=db,
                study_uid=study_uid,
                modality=modality,
                study_date=study_date,
                study_desc=study_desc,
                patient_id=patient_id,
                patient_name=patient_name
            )

            asyncio.run(
                registrar_imagen(db, estudio.id, file_path, filename)
            )

            os.remove(file_path)
            print("✅ Procesado y registrado:", filename)

        except Exception as e:
            print("❌ Error procesando archivo:", filename, str(e))

        finally:
            db.close()


# ---------------------------------------------------------
# OBTENER O CREAR PACIENTE
# ---------------------------------------------------------
def obtener_o_crear_paciente(db: Session, patient_id: str, patient_name: str):
    if not patient_id:
        patient_id = "DESCONOCIDO"

    paciente = obtener_paciente_por_identificacion(db, str(patient_id))

    if paciente:
        return paciente

    nuevo = crear_paciente_desde_dicom(
        db=db,
        identificacion=str(patient_id),
        nombre_completo=str(patient_name) if patient_name else "PACIENTE DICOM"
    )

    print(f"📌 Paciente creado automáticamente: {nuevo.identificacion} (ID interno {nuevo.id})")
    return nuevo


# ---------------------------------------------------------
# OBTENER O CREAR ESTUDIO
# ---------------------------------------------------------
def obtener_o_crear_estudio(db: Session, study_uid, modality, study_date, study_desc, patient_id, patient_name):

    paciente = obtener_o_crear_paciente(db, patient_id, patient_name)

    estudio = obtener_estudio_por_uid(db, study_uid)
    if estudio:
        return estudio

    fecha_convertida = convertir_fecha_dicom(study_date) if study_date else date.today()

    data = EstudioCreate(
        paciente_id=paciente.id,
        tipo_estudio=modality or "OT",
        fecha_estudio=fecha_convertida,
        uid=study_uid,
        descripcion=study_desc or f"Estudio DICOM ({modality})"
    )

    nuevo = crear_estudio(db, data)

    print(f"📌 Estudio creado automáticamente: {nuevo.descripcion} (UID {study_uid})")
    return nuevo


# ---------------------------------------------------------
# REGISTRAR IMAGEN
# ---------------------------------------------------------
async def registrar_imagen(db: Session, estudio_id: int, file_path: str, original_name: str):

    class FakeUpload:
        def __init__(self, filename, path):
            self.filename = filename
            self._path = path

        async def read(self):
            with open(self._path, "rb") as f:
                return f.read()

    filename = original_name if original_name.lower().endswith(".dcm") else original_name + ".dcm"

    fake = FakeUpload(filename=filename, path=file_path)

    await save_image_and_register(db, estudio_id, fake)