"""
MI_PACS — Backend principal con Soporte de Notificaciones Real-Time
---------------------------------------------------------
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
import os
from typing import List

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal

# ---------------------------------------------------------
# 1. IMPORTACIÓN CRÍTICA DE MODELOS (Orden corregido)
# ---------------------------------------------------------
from app.models.medico import Medico 
from app.models.usuario import Usuario
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.dicom_config import DicomConfig
from app.models.ris_orden import RISOrden
from app.models.estudio_ia_log import EstudioIALog

# --- ROUTERS CLÍNICOS ---
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
from app.api.dicom_import import router as dicom_import_router # Asegurado formato consistente
from app.api.dicom_tools_api import router as dicom_tools_router
from app.api.dicom_import_new_api import router as dicom_import_new_router
from app.api.dicom_stream_api import router as dicom_stream_router
from app.api.stats_api import router as stats_router
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
from app.api.admin_config import router as admin_config_router

# 🚀 NUEVO: Importación del router del Panel de Configuración de Backups
from app.api.backup_api import router as backup_router

# Router del RIS y Conectividad
from app.api.ris import router as ris_router
from app.api import dicom_config_api
from app.api.dicom_modalities_api import router as dicom_modalities_router
from app.api.ris_tecnologo_api import router as tecnologo_api
from app.api.usuario_api import router as usuario_api

# Servidor DICOM dinámico y Scheduler
from app.services.dicom_service import reiniciar_servidor_dicom
from app.crud.dicom_config_crud import get_config, create_default_config

# 🚀 NUEVO: Importación del servicio encargado de planificar las tareas automáticas
from app.services.scheduler_service import inicializar_scheduler

# ---------------------------------------------------------
# GESTOR DE CONEXIONES EN TIEMPO REAL (WEBSOCKETS)
# ---------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def notify_update(self):
        for connection in self.active_connections:
            try:
                await connection.send_text("refresh_data")
            except Exception:
                pass

manager = ConnectionManager()

# ---------------------------------------------------------
# FASTAPI — CONFIGURACIÓN PRINCIPAL
# ---------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.API_VERSION,
)

# 🔥 AJUSTE DE CORS: Cambiado a "*" para permitir acceso total desde tabletas y red local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. CREACIÓN DE TABLAS
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------
# ENDPOINT WEBSOCKET PARA EL FRONTEND
# ---------------------------------------------------------
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ---------------------------------------------------------
# REGISTRO DE ROUTERS
# ---------------------------------------------------------
app.include_router(auth_router, prefix="/api")
app.include_router(usuario_api, prefix="/api")
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
app.include_router(stats_router, prefix="/api")
app.include_router(dicom_advanced_tools_router, prefix="/api")
app.include_router(dicom_email_tools_router, prefix="/api")
app.include_router(dicom_cd_tools_router, prefix="/api")
app.include_router(auditoria_router, prefix="/api")
app.include_router(email_logs_router, prefix="/api")
app.include_router(pdf_report_router, prefix="/api")
app.include_router(whatsapp_router, prefix="/api")
app.include_router(secure_links_router, prefix="/api")
app.include_router(pacientes_filtros_router, prefix="/filtros")
app.include_router(ris_router, prefix="/api/ris", tags=["RIS"])
app.include_router(estudios_filtros_router, prefix="/filtros")
app.include_router(busqueda_global_router, prefix="/filtros")
app.include_router(dicom_config_api.router, prefix="/api/dicom", tags=["Configuración DICOM"])
app.include_router(dicom_modalities_router)
app.include_router(tecnologo_api, prefix="/api")
app.include_router(admin_config_router)

# 🚀 NUEVO: Registro del router encargado de administrar las copias de seguridad selectivas
app.include_router(backup_router, prefix="/api", tags=["Gestión de Backups"])

@app.post("/api/notify-new-study")
async def trigger_notification():
    await manager.notify_update()
    return {"status": "Notificación enviada"}

# ---------------------------------------------------------
# ARCHIVOS ESTÁTICOS
# ---------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
static_dir = os.path.join(BASE_DIR, "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    config = get_config(db)
    if not config:
        config = create_default_config(db)
    
    if os.environ.get("SERVER_STARTED") != "true":
        os.environ["SERVER_STARTED"] = "true"
        print(f"🔵 Iniciando Servidor DICOM → AE={config.ae_title}, Puerto={config.port}")
        reiniciar_servidor_dicom(config.ae_title, config.port)
        
        # 🚀 NUEVO: Arrancar el planificador automático a la 1:00 AM para NAS y envíos diferidos
        print("⏰ Iniciando Planificador Automático (Rutina: 01:00 AM)")
        inicializar_scheduler()

@app.get("/status")
def status():
    return {"message": "Sistema clínico funcionando correctamente"}
