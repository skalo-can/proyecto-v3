"""
MI_PACS — Backend principal
---------------------------------------------------------
Inicializa la aplicación FastAPI, configura CORS, registra routers
clínicos (PACS + RIS), monta carpetas estáticas y expone endpoints
de estado y compatibilidad.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
import os
import platform
from threading import Thread, Event

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal

# Routers clínicos
from app.api.paciente_api import router as paciente_router
from app.api.auth_api import router as auth_router
from app.api.estudio_api import router as estudio_router
from app.api.dicom_store_api import router as dicom_store_router
from app.api.dicom_audio_api import router as dicom_audio_router
from app.api.dicom_transcripcion_api import router as dicom_transcripcion_router
from app.api.dicom_firma_api import router as dicom_firma_router
from app.api.paciente_portal_api import router as paciente_portal_router
from app.api.paciente_link_api import router as paciente_link_router
from app.api.paciente_email_api import router as paciente_email_router
from app.api.reset_api import router as reset_router
from app.api.dicom_import import router as dicom_import_router
from app.api.dicom_import_new_api import router as dicom_import_new_router
from app.api.dicom_stream_api import router as dicom_stream_router
from app.api.stats_api import router as stats_router # NUEVO
from app.api.dicom_tools_api import router as dicom_tools_router
from app.api.dicom_advanced_tools_api import router as dicom_advanced_tools_router
from app.api.dicom_email_tools_api import router as dicom_email_tools_router
from app.api.dicom_cd_tools_api import router as dicom_cd_tools_router
from app.api.auditoria_api import router as auditoria_router
from app.api.email_logs_api import router as email_logs_router
from app.api.pdf_report_api import router as pdf_report_router
from app.api.whatsapp_api import router as whatsapp_router
from app.api.secure_links_api import router as secure_links_router
from app.api.filtros.pacientes_filtros_api import router as pacientes_filtros_router
from app.api.filtros.estudios_filtros_api import router as estudios_filtros_router
from app.api.filtros.busqueda_global_api import router as busqueda_global_router


# Router de conectividad DICOM unificado
from app.api import dicom_config_api

# 🔥 NUEVO: Router de modalidades conectadas
from app.api.dicom_modalities_api import router as dicom_modalities_router

# Modelos (aseguran creación de tablas)
from app.models import estudio, estudio_imagen, paciente, dicom_config
from app.models.usuario import Usuario
from app.models.medico import Medico
from app.models.estudio_ia_log import EstudioIALog

# Servidor DICOM dinámico
from app.services.dicom_service import reiniciar_servidor_dicom
from app.crud.dicom_config_crud import get_config, create_default_config

# ---------------------------------------------------------
# FASTAPI — CONFIGURACIÓN PRINCIPAL
# ---------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.API_VERSION,
)

print(
    ">>> DEBUG: Antes de cualquier import, existe app/static?:",
    os.path.exists(os.path.join(os.path.dirname(__file__), "static")),
)

# CORS
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear tablas
Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------
# REGISTRO DE ROUTERS
# ---------------------------------------------------------
app.include_router(auth_router, prefix="/api")
app.include_router(paciente_router, prefix="/api")
app.include_router(estudio_router, prefix="/api")
app.include_router(dicom_store_router, prefix="/api")
app.include_router(dicom_audio_router, prefix="/api")
app.include_router(dicom_transcripcion_router, prefix="/api")
app.include_router(dicom_firma_router, prefix="/api")
app.include_router(paciente_portal_router, prefix="/api")
app.include_router(paciente_link_router, prefix="/api")
app.include_router(paciente_email_router, prefix="/api")
app.include_router(reset_router, prefix="/api")
app.include_router(dicom_import_router, prefix="/api")
app.include_router(dicom_tools_router, prefix="/api")
app.include_router(dicom_import_new_router, prefix="/api")
app.include_router(dicom_stream_router, prefix="/api")
app.include_router(stats_router, prefix="/api") # NUEVO
app.include_router(dicom_advanced_tools_router, prefix="/api")
app.include_router(dicom_email_tools_router, prefix="/api")
app.include_router(dicom_cd_tools_router, prefix="/api")
app.include_router(auditoria_router, prefix="/api")
app.include_router(email_logs_router, prefix="/api")
app.include_router(pdf_report_router, prefix="/api")
app.include_router(whatsapp_router, prefix="/api")
app.include_router(secure_links_router, prefix="/api")
app.include_router(pacientes_filtros_router, prefix="/filtros")
app.include_router(estudios_filtros_router, prefix="/filtros")
app.include_router(busqueda_global_router, prefix="/filtros")


# Router DICOM unificado
app.include_router(dicom_config_api.router, prefix="/api")

# 🔥 NUEVO: Modalidades conectadas (ya tiene prefix="/api/dicom")
app.include_router(dicom_modalities_router)


# ---------------------------------------------------------
# Archivos estáticos
# ---------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
static_dir = os.path.join(BASE_DIR, "static")
os.makedirs(static_dir, exist_ok=True)

dicoms_dir = os.path.join(static_dir, "dicoms")
thumbnails_dir = os.path.join(static_dir, "thumbnails")

os.makedirs(dicoms_dir, exist_ok=True)
os.makedirs(thumbnails_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ---------------------------------------------------------
# Endpoint de compatibilidad /uploads
# ---------------------------------------------------------
@app.get("/uploads/{filename}")
async def serve_dicom(filename: str):
    file_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "uploads", filename)
    )

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    with open(file_path, "rb") as f:
        data = f.read()

    media_type = (
        "application/dicom"
        if filename.lower().endswith(".dcm")
        else "application/octet-stream"
    )

    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Length": str(len(data)),
            "Accept-Ranges": "bytes",
        },
    )


# ---------------------------------------------------------
# Estado del sistema
# ---------------------------------------------------------
@app.get("/status")
def status():
    return {"message": "Sistema clínico funcionando correctamente"}


# ---------------------------------------------------------
# Procesador DICOM + Servidor DICOM dinámico
# ---------------------------------------------------------
def start_background_tasks(app_instance: FastAPI):
    stop_event = Event()
    app_instance.state.dicom_stop_event = stop_event

    # Procesador DICOM continuo
    # hilo = Thread(target=iniciar_procesador, args=(stop_event,), daemon=True)
    # app_instance.state.dicom_thread = hilo
    # hilo.start()

# ---------------------------------------------------------
# ARRANQUE SEGURO DEL SERVIDOR DICOM (Windows + Reload)
# ---------------------------------------------------------
db = SessionLocal()
config = get_config(db)
if not config:
    config = create_default_config(db)

# Evitar múltiples arranques del SCP
if os.environ.get("SERVER_STARTED") != "true":
    os.environ["SERVER_STARTED"] = "true"
    print(f"🔵 Iniciando Servidor DICOM → AE={config.ae_title}, Puerto={config.port}")
    reiniciar_servidor_dicom(config.ae_title, config.port)
else:
    print("🟡 Servidor DICOM ya estaba iniciado. Evitando duplicado.")

@app.on_event("startup")
def startup_event():
    start_background_tasks(app)