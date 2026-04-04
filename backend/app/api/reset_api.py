"""
reset_api.py — MI_PACS (Versión Blindada SKALO)
----------------------------------------------------------
"""

from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
from threading import Event, Thread

from app.core.database import Base, engine, get_db

# Importar modelos para asegurar metadata completa
from app.models.usuario import Usuario
from app.models.medico import Medico
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.estudio_ia_log import EstudioIALog

from app.core.security import get_password_hash

# CORRECCIÓN DE RUTA SEGÚN TUS CARPETAS:
try:
    from app.dicom_utils.dicom_preprocessor import iniciar_procesador
except ImportError:
    # Definimos una función de respaldo por si el nombre interno varía
    def iniciar_procesador(*args, **kwargs):
        print("⚠️ No se encontró la función iniciar_procesador en dicom_utils.")

router = APIRouter(prefix="/reset", tags=["Reset del Sistema"])

@router.post("/clinico")
def resetear_sistema_clinico(
    request: Request,
    db: Session = Depends(get_db)
):
    app = request.app

    # 1. Detener procesador DICOM
    stop_event = getattr(app.state, "dicom_stop_event", None)
    hilo = getattr(app.state, "dicom_thread", None)

    if stop_event and hilo:
        stop_event.set()
        hilo.join(timeout=2)

    # 2. Reset de base de datos
    # Al ejecutar esto, se crearán las tablas con la columna ROL actualizada
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # 2.1 CREACIÓN DE USUARIOS MAESTROS
    usuarios_a_crear = [
        {
            "nombre": "Administrador MI_PACS",
            "email": "admin@mipacs.com",
            "password": "admin123",
            "rol": "admin"
        },
        {
            "nombre": "SKALO Soporte Maestro",
            "email": "SKALO", 
            "password": "Soportehc#3104",
            "rol": "superadmin"
        }
    ]

    for u in usuarios_a_crear:
        nuevo_usuario = Usuario(
            nombre=u["nombre"],
            email=u["email"],
            password_hash=get_password_hash(u["password"]),
            rol=u["rol"],
            activo=True,
        )
        db.add(nuevo_usuario)
    
    db.commit()

    # 3. Limpieza de carpetas físicas
    BASE_DIR = Path(__file__).resolve().parents[2]
    carpetas = [
        BASE_DIR / "static" / "dicoms",
        BASE_DIR / "static" / "thumbnails",
        BASE_DIR / "dicom_inbox",
        BASE_DIR / "dicom_archivados"
    ]

    for carpeta in carpetas:
        if carpeta.exists():
            shutil.rmtree(carpeta)
        carpeta.mkdir(parents=True, exist_ok=True)

    # 4. Reiniciar procesador
    nuevo_stop = Event()
    app.state.dicom_stop_event = nuevo_stop
    nuevo_hilo = Thread(target=iniciar_procesador, args=(nuevo_stop,), daemon=True)
    app.state.dicom_thread = nuevo_hilo
    nuevo_hilo.start()

    return {"mensaje": "✨ Sistema limpio. SKALO y Admin creados correctamente."}