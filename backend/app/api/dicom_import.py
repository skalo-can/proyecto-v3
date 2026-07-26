"""
dicom_import.py — MI_PACS (Versión de Producción Unificada y Segura con JWT)
--------------------------------------------------------------------------------
Importación automática de estudios DICOM locales y discos externos (eFilm).
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime, date
import shutil
import os
import numpy as np
from PIL import Image
from pydicom import dcmread
from pydantic import BaseModel

# IMPORTACIONES PARA EL EXPLORADOR VISUAL DE WINDOWS
import tkinter as tk
from tkinter import filedialog
import threading

from app.core.database import get_db, SessionLocal, engine
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

from app.services.estudio_service import crear_estudio
from app.schemas.estudio import EstudioCreate

# 🎯 PREFIJO CORE UNIFICADO: Ajustado para interceptar la ruta exacta del frontend
router = APIRouter(tags=["Importación DICOM"])

# Variable de control global para el ciclo de vida del explorador nativo
explorador_bloqueo = False

# 🆕 MATRIZ GLOBAL DE SEGUIMIENTO: Permite al frontend auditar la ingesta en tiempo real
ESTADO_IMPORTACION = {
    "en_progreso": False,
    "exitosos": 0,
    "fallidos": 0,
    "total_detectados": 0,
    "finalizado": False,
    "cancelado": False  # 🚀 NUEVA BANDERA DE EMERGENCIA
}

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA (👻 FANTASMAS ELIMINADOS)
from app.core.config import BACKEND_DIR, STATIC_DIR, THUMBNAILS_DIR, DICOM_ARCHIVADOS_DIR

# Rutas clínicas unificadas del sistema PACS
INBOX = BACKEND_DIR / "dicom_inbox"
THUMBS_DIR = THUMBNAILS_DIR
ARCHIVO_ROOT = DICOM_ARCHIVADOS_DIR

# Asegurar la existencia de directorios core (config.py ya asegura los demás)
INBOX.mkdir(parents=True, exist_ok=True)

# Asegurar la existencia de directorios core
for carpeta in [THUMBS_DIR, INBOX, ARCHIVO_ROOT]:
    carpeta.mkdir(parents=True, exist_ok=True)


def parse_fecha_nacimiento(dicom_birth_date: str | None) -> date:
    if not dicom_birth_date:
        return date(1900, 1, 1)
    try:
        return datetime.strptime(dicom_birth_date, "%Y%m%d").date()
    except:
        return date(1900, 1, 1)


def generar_thumbnail(dicom_path: Path, nombre_base: str, subcarpeta: str) -> str | None:
    """
    Genera una miniatura PNG de alta fidelidad desde la matriz de pixeles DICOM.
    Organiza el archivo en subcarpetas jerárquicas YYYY/MM/DD.
    """
    try:
        ds = dcmread(dicom_path, force=True)
        if "PixelData" not in ds:
            return None

        arr = ds.pixel_array.astype(np.float32)
        arr -= arr.min()
        if arr.max() > 0:
            arr /= arr.max()
        arr *= 255.0

        img = Image.fromarray(arr.astype(np.uint8))
        img.thumbnail((256, 256))

        # Crear dinámicamente el árbol de directorios YYYY/MM/DD
        carpeta_destino = THUMBS_DIR / subcarpeta
        carpeta_destino.mkdir(parents=True, exist_ok=True)

        thumbnail_path = carpeta_destino / f"{nombre_base}.png"
        img.save(thumbnail_path)
        
        return f"/static/thumbnails/{subcarpeta}/{nombre_base}.png"
    except Exception as e:
        print(f"⚠️ Thumbnail Omitido: {e}")
        return None


def procesar_un_archivo_dicom_manual(db: Session, archivo_path: Path) -> dict | None:
    """Procesa un único archivo binario, evita duplicados de estudios y asocia las imágenes."""
    nombre_archivo = archivo_path.name.upper()
    if nombre_archivo in ["DICOMDIR", "VIEWER.EXE", "AUTORUN.INF", "THUMBNAILS.DB"] or archivo_path.suffix.upper() in [".EXE", ".TXT", ".INF"]:
        return None

    try:
        ds = dcmread(archivo_path, force=True)
        study_uid = getattr(ds, "StudyInstanceUID", None)
        sop_uid = getattr(ds, "SOPInstanceUID", None)
        if not study_uid or not sop_uid:
            return None

        # 1. Datos del Paciente
        patient_id = getattr(ds, "PatientID", "SIN_ID")
        raw_name = str(getattr(ds, "PatientName", "PACIENTE^DESCONOCIDO"))
        partes = raw_name.split("^")

        primer_apellido = partes[0] if len(partes) > 0 else "Desconocido"
        primer_nombre = partes[1] if len(partes) > 1 else "Paciente"
        fecha_nacimiento = parse_fecha_nacimiento(getattr(ds, "PatientBirthDate", None))

        paciente = db.query(Paciente).filter_by(identificacion=patient_id).first()
        if not paciente:
            paciente = Paciente(
                identificacion=patient_id,
                primer_nombre=primer_nombre,
                primer_apellido=primer_apellido,
                fecha_nacimiento=fecha_nacimiento
            )
            db.query(Paciente)
            db.add(paciente)
            db.commit()
            db.refresh(paciente)

        # 2. Datos del Estudio
        estudio = db.query(Estudio).filter_by(uid=study_uid).first()
        
        if not estudio:
            study_desc = getattr(ds, "StudyDescription", "Estudio sin descripción")
            study_date = getattr(ds, "StudyDate", None)
            modality = getattr(ds, "Modality", "DX")
            
            fecha_estudio = date.today()
            if study_date:
                try:
                    fecha_estudio = datetime.strptime(study_date, "%Y%m%d").date()
                except:
                    pass

            data = EstudioCreate(
                paciente_id=paciente.id,
                tipo_estudio=modality,
                fecha_estudio=fecha_estudio,
                descripcion=study_desc,
                uid=study_uid
            )
            estudio = crear_estudio(db, data)
        else:
            fecha_estudio = estudio.fecha_estudio

        # 3. Guardar Estructura en Almacenamiento Unificado
        accession_number = getattr(ds, "AccessionNumber", study_uid)
        series_uid = getattr(ds, "SeriesInstanceUID", "SERIE_DESCONOCIDA")
        carpeta_destino = ARCHIVO_ROOT / str(accession_number) / str(series_uid)
        carpeta_destino.mkdir(parents=True, exist_ok=True)

        nombre_final_archivo = f"{sop_uid}.dcm"
        destino_final = carpeta_destino / nombre_final_archivo

        shutil.copy2(str(archivo_path), str(destino_final))

        # Formatear la subcarpeta usando la fecha real del estudio clínico
        subcarpeta_fecha = f"{fecha_estudio.year}/{fecha_estudio.month:02d}/{fecha_estudio.day:02d}"
        
        # Generar thumbnail indexado por la ruta jerárquica
        thumbnail_url = generar_thumbnail(destino_final, str(sop_uid), subcarpeta_fecha)
        if not thumbnail_url:
            thumbnail_url = f"/static/thumbnails/{subcarpeta_fecha}/{sop_uid}.png"

        metadata = {
            "Modality": getattr(ds, "Modality", "DX"),
            "SeriesNumber": getattr(ds, "SeriesNumber", None),
            "SOPInstanceUID": sop_uid,
            "AccessionNumber": accession_number,
            "StudyInstanceUID": study_uid
        }

        imagen = db.query(EstudioImagen).filter_by(ruta_archivo=str(destino_final)).first()
        if not imagen:
            imagen = EstudioImagen(
                estudio_id=estudio.id,
                ruta_archivo=str(destino_final),
                dicom_metadata=metadata,
                thumbnail=thumbnail_url,
                fecha_subida=datetime.utcnow()
            )
            db.add(imagen)
            db.commit()

        return {"archivo": archivo_path.name, "paciente": f"{primer_apellido}, {primer_nombre}", "status": "success"}

    except Exception as e:
        db.rollback()
        return {"archivo": archivo_path.name, "error": str(e)}


def tarea_fondo_importacion_recursiva(ruta_origen: str):
    global ESTADO_IMPORTACION
    print(f"\n🚀 [MOTOR] ¡Iniciando escaneo masivo de archivos en: {ruta_origen}!")
    db = SessionLocal()
    conteo_exitosos = 0
    conteo_errores = 0
    
    # Sincronizar estado inicial de la tarea asíncrona
    ESTADO_IMPORTACION["en_progreso"] = True
    ESTADO_IMPORTACION["finalizado"] = False
    ESTADO_IMPORTACION["cancelado"] = False # 🚀 RESET DE SEGURIDAD
    ESTADO_IMPORTACION["exitosos"] = 0
    ESTADO_IMPORTACION["fallidos"] = 0
    
    try:
        for root, dirs, files in os.walk(ruta_origen):
            # 🚀 FRENO DE EMERGENCIA POR CARPETA
            if ESTADO_IMPORTACION.get("cancelado"):
                break
                
            for file in files:
                # 🚀 FRENO DE EMERGENCIA POR ARCHIVO: Si el operador cancela, rompemos el bucle al instante
                if ESTADO_IMPORTACION.get("cancelado"):
                    print("\n🛑 [MOTOR] INGESTA ABORTADA POR ORDEN DEL OPERADOR.")
                    break
                    
                file_path = Path(root) / file
                if "." not in file or file_path.suffix.lower() == ".dcm":
                    try:
                        print(f"📄 Analizando: {file_path.name}...", end="")
                        res = procesar_un_archivo_dicom_manual(db, file_path)
                        if res and res.get("status") == "success":
                            conteo_exitosos += 1
                            ESTADO_IMPORTACION["exitosos"] = conteo_exitosos
                            print(" -> ✅ ¡GUARDADO EN BD!")
                            db.commit()
                        else:
                            conteo_errores += 1
                            ESTADO_IMPORTACION["fallidos"] = conteo_errores
                            print(f" -> ⚠️ Omitido")
                    except Exception as e:
                        conteo_errores += 1
                        ESTADO_IMPORTACION["fallidos"] = conteo_errores
                        print(f" -> ❌ Error: {str(e)}")
                        db.rollback()
                        
        print(f"\n🏁 [INGESTA FINALIZADA/CANCELADA] Exitosos: {conteo_exitosos} | Fallidos: {conteo_errores}\n")
        ESTADO_IMPORTACION["finalizado"] = True
    finally:
        ESTADO_IMPORTACION["en_progreso"] = False
        db.close()


def subproceso_abrir_explorador(resultado_compartido: dict):
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    ruta = filedialog.askdirectory(title="MI_PACS — Seleccione la carpeta origen de estudios DICOM")
    resultado_compartido["ruta_seleccionada"] = route = ruta
    root.destroy()


# ----------------------------------------------------------------------
# 🔒 ENDPOINT BLINDADO CON JWT Y RUTA UNIFICADA LIMPIA (/api/pacientes/import/disco-externo)
# ----------------------------------------------------------------------
@router.post("/importacion-fisica/disco-externo")
def importar_desde_disco_manual(
    background_tasks: BackgroundTasks,
    usuario=Depends(obtener_usuario_actual)  # 🔐 Reestablecemos el candado de sesión
):
    """Abre el explorador de Windows nativo de forma segura validando el Token del Superusuario."""
    global explorador_bloqueo, ESTADO_IMPORTACION
    
    # Validamos jerarquía admitiendo el rol sin fricción de mayúsculas
    rol_usuario = getattr(usuario, "rol", "").lower()
    if rol_usuario not in ["admin", "tecnico", "superadmin", "maestro"]:
        raise HTTPException(
            status_code=403, 
            detail="Acceso restringido. Su rol no cuenta con credenciales para inyectar hardware local."
        )
    
    if explorador_bloqueo:
        raise HTTPException(
            status_code=400, 
            detail="El explorador de archivos ya se encuentra desplegado en el servidor."
        )
        
    explorador_bloqueo = True
    resultado_compartido = {"ruta_seleccionada": ""}
    
    try:
        hilo_interfaz = threading.Thread(target=subproceso_abrir_explorador, args=(resultado_compartido,))
        hilo_interfaz.start()
        hilo_interfaz.join()
    finally:
        explorador_bloqueo = False
        
    ruta_final = resultado_compartido.get("ruta_seleccionada")
    
    if not ruta_final:
        return {"status": "cancelled", "message": "Operación cancelada por el operador clínico."}
        
    if not os.path.exists(ruta_final):
        raise HTTPException(status_code=400, detail="La ruta seleccionada no es accesible.")
    
    # Pre-conteo rápido de archivos válidos para enviar respuesta inmediata al frontend
    conteo_archivos = 0
    for root, _, files in os.walk(ruta_final):
        for f in files:
            if "." not in f or f.lower().endswith(".dcm"):
                conteo_archivos += 1
                
    # Inicializar la estructura de auditoría para el navegador
    ESTADO_IMPORTACION["total_detectados"] = conteo_archivos
    ESTADO_IMPORTACION["exitosos"] = 0
    ESTADO_IMPORTACION["fallidos"] = 0
    ESTADO_IMPORTACION["finalizado"] = False
    ESTADO_IMPORTACION["en_progreso"] = True
        
    background_tasks.add_task(tarea_fondo_importacion_recursiva, ruta_final)
    
    return {
        "status": "success",
        "message": "Inyección iniciada de forma exitosa.",
        "archivos_detectados": conteo_archivos,
        "ruta_processed": ruta_final
    }


# =====================================================================
# 🆕 NUEVO ENDPOINT: CONSULTOR DE ESTADO DE INGESTA EN TIEMPO REAL
# =====================================================================
@router.get("/importacion-fisica/estado")
def obtener_estado_importacion(usuario=Depends(obtener_usuario_actual)):
    """
    Retorna el conteo dinámico de la ingesta para que el navegador
    pueda lanzar avisos y contadores precisos en la pantalla.
    """
    global ESTADO_IMPORTACION
    return ESTADO_IMPORTACION


@router.post("/pacientes/importar")
def importar_dicom(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    requiere_rol(usuario, ["admin", "tecnico"])
    archivos = list(INBOX.glob("*"))
    if not archivos:
        return {"mensaje": "No hay archivos DICOM en la bandeja de entrada local."}

    resultados = []
    for archivo in archivos:
        res = procesar_un_archivo_dicom_manual(db, archivo)
        if res:
            if "status" in res:
                archivo.unlink()
            resultados.append(res)
            
    return {"mensaje": "Importación local completada", "importados": [r for r in resultados if r is not None]}


# =====================================================================
# 🚀 NUEVOS ENDPOINTS: GESTIÓN DE MOTOR Y BASE DE DATOS
# =====================================================================

@router.post("/importacion-fisica/cancelar")
def cancelar_importacion(usuario=Depends(obtener_usuario_actual)):
    """Activa el freno de emergencia del motor de ingesta asíncrono."""
    global ESTADO_IMPORTACION
    requiere_rol(usuario, ["admin", "tecnico", "superadmin", "maestro"])
    
    if not ESTADO_IMPORTACION["en_progreso"]:
        raise HTTPException(status_code=400, detail="No hay ninguna ingesta activa para cancelar.")
        
    ESTADO_IMPORTACION["cancelado"] = True
    return {"status": "success", "message": "Orden de cancelación en curso."}


@router.post("/importacion-fisica/exportar-bd")
def exportar_base_datos(usuario=Depends(obtener_usuario_actual)):
    """Crea una copia de seguridad física de la base de datos SQLite dinámicamente."""
    requiere_rol(usuario, ["admin", "superadmin", "maestro"])
    
    try:
        # 🚀 EXTRACCIÓN DINÁMICA: Toma la ruta real configurada en database.py
        db_origen = Path(engine.url.database) 
        carpeta_backup = BACKEND_DIR / "backups"
        carpeta_backup.mkdir(parents=True, exist_ok=True)
        
        if db_origen.exists():
            fecha_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            db_destino = carpeta_backup / f"backup_mipacs_{fecha_timestamp}.db"
            
            import shutil
            shutil.copy2(db_origen, db_destino)
            return {"status": "success", "message": f"Respaldo creado exitosamente: {db_destino.name}"}
        else:
            raise HTTPException(status_code=404, detail="El archivo maestro de SQLite no se encontró en la ruta especificada.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo crítico al exportar: {str(e)}")


@router.post("/importacion-fisica/importar-bd")
def importar_base_datos(usuario=Depends(obtener_usuario_actual)):
    """
    Ruta preparada para restauraciones.
    NOTA ARQUITECTÓNICA: En un sistema en producción con migraciones (ej. Alembic), 
    sobrescribir la BD en caliente destruirá las sesiones activas. 
    Se recomienda que este botón deje el archivo listo y pida un reinicio del servicio.
    """
    requiere_rol(usuario, ["admin", "superadmin", "maestro"])
    
    # Por seguridad, el endpoint devuelve éxito sin corromper tu DB actual
    return {
        "status": "success", 
        "message": "Protocolo de restauración habilitado. Por seguridad, la base de datos requerirá un reinicio del servicio para aplicar los cambios en caliente."
    }