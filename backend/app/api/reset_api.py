from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import logging

from app.core.database import Base, engine, get_db
from app.models.usuario import Usuario
from app.core.security import get_password_hash

# Configuración de logs para ver errores en la terminal negra
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reset", tags=["Reset del Sistema"])

# Ubicación base del proyecto
BASE_DIR = Path(__file__).resolve().parents[2]

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
                is_active=True,                        # Campo sincronizado
                permisos=PERMISOS_FULL                 # Inyección de matriz total
            )
            db.add(nuevo_usuario)
        
        db.commit()
        logger.info("Usuarios maestros creados exitosamente.")

        # --- PASO 3: LIMPIEZA DE ARCHIVOS FÍSICOS ---
        carpetas = ["static/dicoms", "static/thumbnails", "dicom_inbox", "dicom_archivados"]
        
        for carpeta in carpetas:
            ruta = BASE_DIR / carpeta
            if ruta.exists():
                shutil.rmtree(ruta, ignore_errors=True)
            # Creamos la carpeta de nuevo, limpia y lista
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