"""
reset_api.py — MI_PACS (versión moderna con parada limpia)
----------------------------------------------------------
Endpoint clínico para resetear completamente el sistema.
- Detiene el procesador DICOM
- Elimina tablas
- Recrea la BD
- Limpia carpetas físicas
- Crea usuario administrador por defecto
- Reinicia el procesador DICOM
"""

from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
from threading import Event, Thread

from app.core.database import Base, engine, get_db
from app.services.dicom_processor import iniciar_procesador

# Importar modelos para asegurar metadata completa
from app.models.usuario import Usuario
from app.models.medico import Medico
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.estudio_ia_log import EstudioIALog

from app.core.security import get_password_hash

router = APIRouter(prefix="/reset", tags=["Reset del Sistema"])


@router.post("/clinico")
def resetear_sistema_clinico(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Reset clínico completo:
    - Detiene procesador DICOM
    - Elimina todas las tablas
    - Crea tablas modernas
    - Limpia carpetas físicas
    - Crea usuario administrador por defecto
    - Reinicia procesador DICOM
    """

    app = request.app

    # 1. Detener procesador DICOM limpiamente
    stop_event = getattr(app.state, "dicom_stop_event", None)
    hilo = getattr(app.state, "dicom_thread", None)

    if stop_event and hilo:
        print("🛑 Solicitando parada del procesador DICOM...")
        stop_event.set()
        hilo.join(timeout=5)
        print("✅ Procesador DICOM detenido.")

    # 2. Reset de base de datos
    print("🧨 Eliminando todas las tablas antiguas...")
    Base.metadata.drop_all(bind=engine)

    print("🧱 Creando tablas modernas...")
    Base.metadata.create_all(bind=engine)

    # 2.1 Crear usuario administrador por defecto
    admin_email = "admin@mipacs.com"
    admin_password = "admin123"

    admin_user = Usuario(
        nombre="Administrador",
        email=admin_email,
        password_hash=get_password_hash(admin_password),
        rol="admin",
        activo=True,
    )

    db.add(admin_user)
    db.commit()
    print("👑 Usuario administrador creado automáticamente.")

    # 3. Limpieza de carpetas físicas
    BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
    STATIC_DIR = BASE_DIR / "static"
    DICOMS_DIR = STATIC_DIR / "dicoms"
    THUMBS_DIR = STATIC_DIR / "thumbnails"
    INBOX = BASE_DIR / "dicom_inbox"
    ARCHIVO = BASE_DIR / "dicom_archivados"

    carpetas = [DICOMS_DIR, THUMBS_DIR, INBOX, ARCHIVO]

    print("🧹 Limpiando carpetas físicas...")

    for carpeta in carpetas:
        if carpeta.exists():
            shutil.rmtree(carpeta)
        carpeta.mkdir(exist_ok=True)

    # 4. Reiniciar procesador DICOM
    print("🚀 Reiniciando procesador DICOM...")
    nuevo_stop = Event()
    app.state.dicom_stop_event = nuevo_stop

    nuevo_hilo = Thread(target=iniciar_procesador, args=(nuevo_stop,), daemon=True)
    app.state.dicom_thread = nuevo_hilo
    nuevo_hilo.start()

    return {
        "mensaje": "✨ Reset clínico completado. MI_PACS está limpio, moderno y con administrador creado."
    }