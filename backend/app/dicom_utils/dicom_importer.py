import os
import shutil
from datetime import datetime, date

import pydicom
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

# 🔥 IMPORTAMOS EL ANCLA
from app.core.config import BACKEND_DIR, DICOM_ARCHIVADOS_DIR

# ---------------------------------------------------------
# 🚀 RUTAS CLÍNICAS UNIFICADAS
# ---------------------------------------------------------
DICOM_INBOX = str(BACKEND_DIR / "dicom_inbox")
DICOM_STORAGE_ROOT = str(DICOM_ARCHIVADOS_DIR)


def _safe_get(ds, tag, default=None):
    """Obtiene un atributo DICOM de forma segura."""
    return getattr(ds, tag, default)


import re

def _parse_patient_name(patient_name):
    """
    Convierte PatientName DICOM en fragmentos limpios.
    Limpia basura técnica (ej. '^^^SDA IL', '*') y asocia los nombres al estándar latino:
    1er Apellido, 2do Apellido, 1er Nombre, 2do Nombre.
    """
    if not patient_name or str(patient_name).strip() == "":
        return "DESCONOCIDO", "", "PACIENTE", ""

    # 1. Convertimos a string y limpiamos caracteres extraños que inyectan los equipos
    nombre_crudo = str(patient_name).upper()
    nombre_crudo = re.sub(r'[\*\+\#\~\!\?]', '', nombre_crudo) # Quita basura como * o +
    
    # Algunos equipos meten "SDA IL" (Sin Datos Adicionales / Ilegible) o similar. Lo limpiamos.
    nombre_crudo = nombre_crudo.replace("SDA IL", "").replace("SDA", "").strip()

    # 2. Reemplazamos los '^^^' múltiples por un solo separador, y luego lo pasamos a espacios
    nombre_crudo = re.sub(r'\^+', '^', nombre_crudo)
    partes = nombre_crudo.replace('^', ' ').split()
    
    # 3. Limpiamos espacios vacíos que hayan quedado
    partes = [p.strip() for p in partes if p.strip()]

    # Si después de limpiar no quedó nada
    if not partes:
         return "DESCONOCIDO", "", "PACIENTE", ""

    # 4. Asignación Lógica (Asumiendo formato predominante: Apellido1 Apellido2 Nombre1 Nombre2)
    primer_apellido = ""
    segundo_apellido = ""
    primer_nombre = ""
    segundo_nombre = ""

    cantidad = len(partes)

    if cantidad == 1:
        # Solo tiene un nombre (Ej: "LOAIZA")
        primer_apellido = partes[0]
        primer_nombre = "NO_REGISTRADO"
    elif cantidad == 2:
        # Ej: "LOAIZA JOSE" -> Asumimos 1 Apellido, 1 Nombre
        primer_apellido = partes[0]
        primer_nombre = partes[1]
    elif cantidad == 3:
        # Ej: "LOAIZA LISCANO JOSE" -> 2 Apellidos, 1 Nombre
        primer_apellido = partes[0]
        segundo_apellido = partes[1]
        primer_nombre = partes[2]
    else:
        # Ej: "LOAIZA LISCANO JOSE EDILSON" (4 o más palabras) -> 2 Apellidos, resto a Nombres
        primer_apellido = partes[0]
        segundo_apellido = partes[1]
        primer_nombre = partes[2]
        segundo_nombre = " ".join(partes[3:]) # Junta cualquier palabra extra en el 2do nombre

    return primer_nombre, segundo_nombre, primer_apellido, segundo_apellido


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
    Procesa un único archivo DICOM (Soporta eFilm sin extensión).
    """
    # 🚀 Ignorar archivos de índice o metadatos del visor Lite de eFilm
    nombre_archivo = os.path.basename(file_path).upper()
    if nombre_archivo in ["DICOMDIR", "VIEWER.EXE", "AUTORUN.INF", "THUMBNAILS.DB"] or nombre_archivo.endswith((".EXE", ".TXT", ".XML", ".PDF")):
        return

    try:
        # force=True es vital para los archivos crudos de eFilm
        ds = pydicom.dcmread(file_path, force=True)
    except Exception:
        return

# 1. Extraer metadata clínica de forma robusta y segura
    patient_id = _safe_get(ds, "PatientID", "SIN_ID")
    patient_name = _safe_get(ds, "PatientName", "PACIENTE^DESCONOCIDO")
    birth_date = _safe_get(ds, "PatientBirthDate", None)

    study_uid = _safe_get(ds, "StudyInstanceUID", None)
    series_uid = _safe_get(ds, "SeriesInstanceUID", None)
    sop_uid = _safe_get(ds, "SOPInstanceUID", None)

    # 🔥 Extracción mejorada con respaldo por Tag numérico por si el nombre falla
    study_date = _safe_get(ds, "StudyDate", None)
    if not study_date and hasattr(ds, "00080020"):
        study_date = str(ds.get((0x0008, 0x0020)).value)

    raw_time = _safe_get(ds, "StudyTime", None)
    if not raw_time and hasattr(ds, "00080030"):
        raw_time = str(ds.get((0x0008, 0x0030)).value)
    study_time = raw_time if raw_time else "000000"

    # 🔥 Captura de Institución Blindada
    raw_inst = None
    if "InstitutionName" in ds:
        raw_inst = ds.InstitutionName
    elif (0x0008, 0x0080) in ds:
        raw_inst = ds[0x0008, 0x0080].value

    # Limpiamos el valor extraído (a veces viene como un bloque de bytes o lista)
    if isinstance(raw_inst, bytes):
        raw_inst = raw_inst.decode('utf-8', errors='ignore')
    elif isinstance(raw_inst, pydicom.multival.MultiValue):
        raw_inst = " ".join([str(v) for v in raw_inst])
        
    institution_name = str(raw_inst).strip() if raw_inst else "Desconocida"
    # Si viene con comillas o corchetes raros, los limpiamos
    institution_name = institution_name.strip("[]'\"")

    # 🖨️ Chivato en consola: Esto nos dirá exactamente qué leyó Python del archivo
    print(f"📥 [DICOM PARSER] Archivo: {os.path.basename(file_path)} | Fecha: {study_date} | Hora: {study_time} | Inst: {institution_name}")

    modality = _safe_get(ds, "Modality", "OT")
    study_description = _safe_get(ds, "StudyDescription", "Estudio sin descripción")
    accession_number = _safe_get(ds, "AccessionNumber", study_uid)

    if not study_uid or not sop_uid:
        return

    # 2. Registrar/Actualizar Paciente
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido = _parse_patient_name(patient_name)
    fecha_nacimiento = _parse_date(birth_date) if birth_date else date(1970, 1, 1)

    paciente = db.query(Paciente).filter(Paciente.identificacion == patient_id).first()

    if not paciente:
        paciente = Paciente(
            identificacion=patient_id,
            primer_nombre=primer_nombre,
            segundo_nombre=segundo_nombre,
            primer_apellido=primer_apellido,
            segundo_apellido=segundo_apellido,
            fecha_nacimiento=fecha_nacimiento
        )
        db.add(paciente)
        db.flush()

    # 🔥 NUEVA LÓGICA: ¿Viene por red (inbox) o por disco externo?
    if DICOM_INBOX in file_path:
        estado_logico = "Tomado"
    else:
        estado_logico = "Importado"

    # 3. Registrar/Actualizar Estudio con Fecha y Hora Exacta
    try:
        if study_date:
            clean_time = (str(study_time).split('.')[0] if study_time else "000000").ljust(6, '0')[:6]
            fecha_hora_str = f"{study_date}{clean_time}"
            fecha_estudio_real = datetime.strptime(fecha_hora_str, "%Y%m%d%H%M%S")
        else:
            fecha_estudio_real = datetime.now()
    except Exception as e:
        print(f"MI_PACS → Error procesando fecha/hora: {e}")
        fecha_estudio_real = datetime.now()

    estudio = db.query(Estudio).filter(Estudio.uid == study_uid).first()

    if not estudio:
        estudio = Estudio(
            paciente_id=paciente.id,
            tipo_estudio=modality,
            fecha_estudio=fecha_estudio_real,
            estado="pendiente",
            estado_pacs=estado_logico,  # 🔥 AHORA ASIGNA "Tomado" o "Importado" DINÁMICAMENTE
            descripcion=study_description,
            uid=study_uid,
            institucion=institution_name,
        )
        db.add(estudio)
        db.flush()  # 🔥 Evita condiciones de carrera en importaciones masivas

    # 4. Construir ruta estructurada
    estudio_folder = os.path.join(DICOM_STORAGE_ROOT, str(accession_number))
    series_folder = os.path.join(estudio_folder, series_uid or "SERIE_DESCONOCIDA")
    os.makedirs(series_folder, exist_ok=True)

    final_filename = f"{sop_uid}.dcm"
    final_path = os.path.join(series_folder, final_filename)

    # 5. Mover o copiar archivo a su destino
    try:
        if DICOM_INBOX in file_path:
            shutil.move(file_path, final_path)
        else:
            shutil.copy2(file_path, final_path)
    except Exception as e:
        print(f"MI_PACS → Error guardando archivo físico DICOM: {e}")
        return

    # 6. Registrar Imagen en Base de Datos con metadatos indexados
    metadata_dict = {
        "PatientID": patient_id,
        "PatientName": str(patient_name),
        "StudyInstanceUID": study_uid,
        "SeriesInstanceUID": series_uid,
        "SOPInstanceUID": sop_uid,
        "StudyDate": study_date,
        "StudyTime": study_time,
        "InstitutionName": institution_name,
        "Modality": modality,
        "StudyDescription": study_description,
        "AccessionNumber": accession_number
    }

    imagen_existente = db.query(EstudioImagen).filter(EstudioImagen.ruta_archivo == final_path).first()
    if not imagen_existente:
        imagen = EstudioImagen(
            estudio_id=estudio.id,
            ruta_archivo=final_path,
            dicom_metadata=metadata_dict,
            thumbnail=None,
            fecha_subida=datetime.utcnow(),
        )
        db.add(imagen)

    db.commit()


# ---------------------------------------------------------
# 🚀 Procesamiento de carpetas externas (Escaneo Recursivo)
# ---------------------------------------------------------
def importar_desde_directorio_externo(ruta_directorio: str):
    """
    Escanea de forma recursiva cualquier disco o carpeta externa de eFilm,
    filtrando y procesando cada archivo DICOM encontrado de forma automática.
    """
    print(f"MI_PACS → Iniciando importación masiva desde: {ruta_directorio}")
    if not os.path.isdir(ruta_directorio):
        print("❌ Error: La ruta externa no es válida o no está conectada.")
        return False

    db = SessionLocal()
    conteo_exito = 0

    try:
        for root, dirs, files in os.walk(ruta_directorio):
            for filename in files:
                file_path = os.path.join(root, filename)
                if "." not in filename or filename.lower().endswith(".dcm"):
                    try:
                        process_single_dicom_file(db, file_path)
                        conteo_exito += 1
                    except Exception:
                        continue
        print(f"✅ Importación finalizada. Se procesaron {conteo_exito} archivos exitosamente.")
        return True
    finally:
        db.close()


def process_inbox():
    """Procesa la bandeja de entrada local habitual."""
    print("MI_PACS → Iniciando procesamiento de dicom_inbox…")
    if not os.path.isdir(DICOM_INBOX):
        return

    db = SessionLocal()
    try:
        for filename in os.listdir(DICOM_INBOX):
            file_path = os.path.join(DICOM_INBOX, filename)
            if os.path.isfile(file_path):
                process_single_dicom_file(db, file_path)
    finally:
        db.close()
        print("MI_PACS → Procesamiento de dicom_inbox finalizado.")


if __name__ == "__main__":
    process_inbox() 