"""
reset_api.py — MI_PACS (Versión Blindada SKALO)
----------------------------------------------------------
Control de mantenimiento: Reset clínico, reinicio de servicios
y limpieza selectiva de carpetas físicas.
"""

from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
from threading import Event, Thread

from app.core.database import Base, engine, get_db
from app.models.usuario import Usuario
from app.core.security import get_password_hash
from app.services.dicom_service import reiniciar_servidor_dicom
from app.crud.dicom_config_crud import get_config

# Intentar importar el procesador de dicom_utils
try:
    from app.dicom_utils.dicom_preprocessor import iniciar_procesador
except ImportError:
    def iniciar_procesador(*args, **kwargs):
        print("⚠️ No se encontró la función iniciar_procesador en dicom_utils.")

# Configuración del Router con prefijo /reset
router = APIRouter(prefix="/reset", tags=["Reset del Sistema"])

# Definimos la ruta raíz del proyecto para localizar carpetas de forma segura
BASE_DIR = Path(__file__).resolve().parents[2]

# ---------------------------------------------------------
# 1. REINICIAR SERVICIOS (Botón Rojo)
# ---------------------------------------------------------
@router.post("/restart-services")
def reiniciar_servicios_sistema(db: Session = Depends(get_db)):
    """Reinicia el servidor DICOM físico usando la config de la DB."""
    try:
        config = get_config(db)
        ae_title = config.ae_title if config else "MIPACS"
        port = config.port if config else 11112
        
        reiniciar_servidor_dicom(ae_title, port)
        
        return {
            "success": True, 
            "message": f"Servidor DICOM ({ae_title}:{port}) reiniciado correctamente."
        }
    except Exception as e:
        print(f"❌ Error al reiniciar servicios: {e}")
        return {"success": False, "message": str(e)}

# ---------------------------------------------------------
# 2. LIMPIAR THUMBNAILS
# ---------------------------------------------------------
@router.post("/thumbnails")
def limpiar_thumbnails():
    """Vacia la carpeta de previsualizaciones (thumbnails)"""
    try:
        folder = BASE_DIR / "static" / "thumbnails"
        if folder.exists():
            shutil.rmtree(folder)
        folder.mkdir(parents=True, exist_ok=True)
        return {"success": True, "message": "Miniaturas eliminadas correctamente."}
    except Exception as e:
        print(f"❌ Error al limpiar thumbnails: {e}")
        return {"success": False, "message": str(e)}

# ---------------------------------------------------------
# 3. LIMPIAR INBOX DICOM
# ---------------------------------------------------------
@router.post("/inbox")
def limpiar_inbox_dicom():
    """Vacia la carpeta temporal de recepción (dicom_inbox)"""
    try:
        folder = BASE_DIR / "dicom_inbox"
        if folder.exists():
            shutil.rmtree(folder)
        folder.mkdir(parents=True, exist_ok=True)
        return {"success": True, "message": "Bandeja de entrada DICOM vaciada."}
    except Exception as e:
        print(f"❌ Error al limpiar inbox: {e}")
        return {"success": False, "message": str(e)}

# ---------------------------------------------------------
# 4. RESET CLÍNICO TOTAL
# ---------------------------------------------------------
@router.post("/clinico")
def resetear_sistema_clinico(request: Request, db: Session = Depends(get_db)):
    """Borrado total de DB y carpetas físicas (Preparación producción)"""
    app = request.app

    # Detener hilos DICOM
    stop_event = getattr(app.state, "dicom_stop_event", None)
    hilo = getattr(app.state, "dicom_thread", None)
    if stop_event and hilo:
        stop_event.set()
        hilo.join(timeout=2)

    # Recrear Tablas
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Usuarios Maestros
    usuarios = [
        {"nombre": "Admin MI_PACS", "email": "admin@mipacs.com", "pass": "admin123", "rol": "admin"},
        {"nombre": "SKALO Soporte", "email": "SKALO", "pass": "Soportehc#3104", "rol": "superadmin"}
    ]
    for u in usuarios:
        db.add(Usuario(
            nombre=u["nombre"], email=u["email"],
            password_hash=get_password_hash(u["pass"]),
            rol=u["rol"], activo=True
        ))
    db.commit()

    # Limpieza masiva de carpetas
    for c in ["static/dicoms", "static/thumbnails", "dicom_inbox", "dicom_archivados"]:
        p = BASE_DIR / c
        if p.exists(): shutil.rmtree(p)
        p.mkdir(parents=True, exist_ok=True)

    # Reiniciar procesador
    nuevo_stop = Event()
    app.state.dicom_stop_event = nuevo_stop
    nuevo_hilo = Thread(target=iniciar_procesador, args=(nuevo_stop,), daemon=True)
    app.state.dicom_thread = nuevo_hilo
    nuevo_hilo.start()

    return {"success": True, "message": "✨ Sistema reseteado a valores de fábrica."}