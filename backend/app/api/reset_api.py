from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import logging

from app.core.database import Base, engine, get_db
from app.models.usuario import Usuario
from app.core.security import get_password_hash

# 🚀 NUEVAS IMPORTACIONES PARA EL SOFT RESET
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.ris_orden import RISOrden
from app.models.reporte import Reporte
from app.models.archivo_estudio import ArchivoEstudio

# 🔥 INYECTAMOS LAS ANCLAS ABSOLUTAS (ELIMINACIÓN DE FANTASMAS)
from app.core.config import BACKEND_DIR, DICOMS_DIR, THUMBNAILS_DIR, DICOM_ARCHIVADOS_DIR

# Configuración de logs para ver errores en la terminal negra
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reset", tags=["Reset del Sistema"])

# --- 1. MATRIZ MAESTRA DE PERMISOS (Poder Total para SKALO) ---
PERMISOS_FULL = {
    "atender_pacientes": True, "reprocesar_dicom": True, "notificar_critico": True,
    "importar_medios": True, "modificar_estudio": True, "quemar_cd_dvd": True,
    "subir_adjuntos": True, "ver_worklist": True, "escribir_informe": True,
    "firma_electronica": True, "solicitar_retoma": True, "acceso_ia": True,
    "validar_previo": True, "exportar_key_images": True, "consultar_historial": True,
    "ver_pacientes": True, "correccion_ortografica": True, "envio_multicanal": True,
    "gestionar_plantillas": True, "escuchar_audio": True, "crear_orden": True,
    "validar_datos": True, "gestionar_agenda": True, "recaudo_pagos": True,
    "entregar_resultados": True, "estado_nodos_dicom": True, "logs_sistema": True
}

@router.post("/clinico")
def resetear_sistema_clinico(request: Request, db: Session = Depends(get_db)):
    """
    PURIFICACIÓN TOTAL: 
    1. Borra y recrea la base de datos.
    2. Crea al Superusuario SKALO y Admin.
    3. Limpia carpetas de imágenes y archivos temporales.
    """
    try:
        # --- PASO 1: RECONSTRUCCIÓN DE BASE DE DATOS ---
        logger.info("Iniciando purificación de base de datos...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        # --- PASO 2: CREACIÓN DE USUARIOS MAESTROS ---
        usuarios_maestros = [
            {
                "nombre": "SKALO Soporte Maestro",
                "username": "SKALO",
                "email": "soporte@mipacs.com",
                "pass": "Soportehc#3104",
                "rol": "superadmin" # Rol de máximo nivel
            },
            {
                "nombre": "Administrador Local",
                "username": "admin",
                "email": "admin@mipacs.com",
                "pass": "admin123",
                "rol": "admin"
            }
        ]

        for u in usuarios_maestros:
            nuevo_usuario = Usuario(
                nombre=u["nombre"],
                username=u["username"],
                email=u["email"],
                password=get_password_hash(u["pass"]), # Hash de seguridad
                rol=u["rol"],
                is_active=True,                    # Campo sincronizado
                permisos=PERMISOS_FULL                # Inyección de matriz total
            )
            db.add(nuevo_usuario)
        
        db.commit()
        logger.info("Usuarios maestros creados exitosamente.")

        # --- PASO 3: LIMPIEZA DE ARCHIVOS FÍSICOS (BLINDADO CON ANCLAS) ---
        carpetas_absolutas = [
            DICOMS_DIR, 
            THUMBNAILS_DIR, 
            BACKEND_DIR / "dicom_inbox", 
            DICOM_ARCHIVADOS_DIR
        ]
        
        for ruta in carpetas_absolutas:
            if ruta.exists():
                shutil.rmtree(ruta, ignore_errors=True)
            ruta.mkdir(parents=True, exist_ok=True)
            
        logger.info("Carpetas de almacenamiento purificadas.")

        return {
            "success": True, 
            "message": "✨ Sistema MI_PACS purificado. SKALO ha retomado el control total."
        }

    except Exception as e:
        db.rollback()
        error_msg = f"Fallo crítico en Reset: {str(e)}"
        logger.error(error_msg)
        return {"success": False, "message": error_msg}
    
    finally:
        db.close()


# =========================================================
# 🟢 NUEVO ENDPOINT: EXCLUSIVO PARA EL BOTÓN DEL FRONTEND
# =========================================================
@router.post("/soft")
def limpieza_clinica_frontend(request: Request, db: Session = Depends(get_db)):
    """
    LIMPIEZA CLÍNICA: 
    Borra únicamente pacientes, órdenes, reportes, estudios e imágenes.
    Mantiene intactos a los usuarios, contraseñas, Nodos DICOM y configuración.
    """
    try:
        logger.info("Iniciando purificación clínica (Soft Reset) desde Frontend...")
        
        # 1. Borrar datos de tablas clínicas (De hijos a padres para evitar conflictos)
        db.query(ArchivoEstudio).delete()
        db.query(EstudioImagen).delete()
        db.query(Reporte).delete()
        db.query(Estudio).delete()
        db.query(RISOrden).delete()
        db.query(Paciente).delete()
        
        db.commit()

        # 2. Limpieza de las imágenes físicas (DICOMs) blindada con anclas
        carpetas_absolutas = [
            DICOMS_DIR, 
            THUMBNAILS_DIR, 
            BACKEND_DIR / "dicom_inbox", 
            DICOM_ARCHIVADOS_DIR
        ]
        
        for ruta in carpetas_absolutas:
            if ruta.exists():
                shutil.rmtree(ruta, ignore_errors=True)
            ruta.mkdir(parents=True, exist_ok=True)
            
        logger.info("Datos clínicos y archivos purificados correctamente.")

        return {
            "success": True, 
            "message": "🧹 Limpieza clínica completada. Los pacientes y estudios han sido eliminados del sistema."
        }

    except Exception as e:
        db.rollback()
        error_msg = f"Fallo en limpieza clínica: {str(e)}"
        logger.error(error_msg)
        return {"success": False, "message": error_msg}