"""
MI_PACS — Backend principal con Soporte de Notificaciones Real-Time
---------------------------------------------------------
Optimizado con el Escudo Maestro de Migraciones Dinámicas Automáticas en Caliente.
"""
import os
import sqlite3


from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
import os
from typing import List

# 🛠️ IMPORTS PARA EL ESCUDO DE AUTOMIGRACIÓN DE PRODUCCIÓN
from sqlalchemy import inspect, text

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
from app.api.dicom_import import router as dicom_import_router 
from app.api.dicom_tools_api import router as dicom_tools_router
#from app.api.dicom_import_new_api import router as dicom_import_new_router
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
from app.api.perfil_api import router as perfil_router # 👈 ¡NUEVO!
from app.api.filtros.pacientes_filtros_api import router as pacientes_filtros_router
from app.api.filtros.estudios_filtros_api import router as estudios_filtros_router
from app.api.filtros.busqueda_global_api import router as busqueda_global_router
from app.api.admin_config import router as admin_config_router
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
from app.services.scheduler_service import inicializar_scheduler


# ---------------------------------------------------------
# RUTINA MAESTRO: MIGRACIÓN AUTOMÁTICA EN CALIENTE (SQLITE NATIVO)
# ---------------------------------------------------------
def auto_migrar_columnas_pacs():
    """
    Se conecta directamente al archivo de la base de datos saltándose SQLAlchemy
    para garantizar que las columnas se creen sí o sí.
    """
    print("🛠️ Iniciando parcheo profundo de base de datos...")
    
    # Busca el archivo database.db exactamente en la carpeta donde está este script (app)
    db_path = os.path.join(os.path.dirname(__file__), "database.db")
    
    if not os.path.exists(db_path):
        print("⚠️ Advertencia: No se encontró database.db en la ruta esperada.")
        return

    # Conexión directa y bruta al archivo
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Parche Usuarios
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN es_urgenciologo BOOLEAN DEFAULT 0")
        print("✅ [SQLITE] Columna 'es_urgenciologo' forzada en usuarios.")
    except sqlite3.OperationalError:
        pass # Ignora en silencio si la columna ya se había creado
        
    # 2. Parches Estudios
    try:
        cursor.execute("ALTER TABLE estudios ADD COLUMN nota_urgencia TEXT")
        print("✅ [SQLITE] Columna 'nota_urgencia' forzada en estudios.")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE estudios ADD COLUMN requiere_lectura_radiologo BOOLEAN DEFAULT 0")
        print("✅ [SQLITE] Columna 'requiere_lectura_radiologo' forzada en estudios.")
    except sqlite3.OperationalError:
        pass

    # Guardar cambios y cerrar la puerta
    conn.commit()
    conn.close()
    print("🚀 Parcheo nativo finalizado. El sistema puede arrancar.")


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
#app.include_router(dicom_import_new_router, prefix="/api")
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
app.include_router(perfil_router) # 👈 ¡NUEVO! (El prefijo ya está dentro del archivo)
app.include_router(pacientes_filtros_router, prefix="/filtros")
app.include_router(ris_router, prefix="/api/ris", tags=["RIS"])
app.include_router(estudios_filtros_router, prefix="/filtros")
app.include_router(busqueda_global_router, prefix="/filtros")
app.include_router(dicom_config_api.router, prefix="/api/dicom", tags=["Configuración DICOM"])
app.include_router(dicom_modalities_router)
app.include_router(tecnologo_api, prefix="/api")
app.include_router(admin_config_router)
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
    # --- 🚀 SOLUCIÓN: Crear tablas antes de consultar ---
    from app.core.database import engine, Base
    from app.models import dicom_config  # Forzamos la lectura de los modelos
    Base.metadata.create_all(bind=engine)
    # ----------------------------------------------------

    db = SessionLocal()
    config = get_config(db)
    if not config:
        config = create_default_config(db)
    
    if os.environ.get("SERVER_STARTED") != "true":
        os.environ["SERVER_STARTED"] = "true"
        print(f"🔵 Iniciando Servidor DICOM → AE={config.ae_title}, Puerto={config.port}")
        reiniciar_servidor_dicom(config.ae_title, config.port)
        
        print("⏰ Iniciando Planificador Automático (Rutina: 01:00 AM)")
        inicializar_scheduler()

# ---------------------------------------------------------
# RECEPCIÓN DE AUDIO DE DICTADO MEDICO (FRONTEND) - OPTIMIZADO CON ILM (AÑO/MES/DIA)
# ---------------------------------------------------------
from fastapi.responses import FileResponse
from datetime import datetime

@app.get("/api/pacientes/{paciente_id}/audio")
async def obtener_audio_paciente(paciente_id: int):
    # Ya no leemos desde la carpeta estática "sorda", ahora le preguntamos a la base de datos dónde lo guardó
    db = SessionLocal()
    try:
        estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
        if not estudio or not getattr(estudio, "audio_path", None):
            # Fallback a la ruta legacy por si es un paciente viejo antes de la actualización
            directorio_audios = os.path.join(static_dir, "audios_dictado")
            ruta_legacy = os.path.join(directorio_audios, f"dictado_{paciente_id}.wav")
            if os.path.exists(ruta_legacy):
                return FileResponse(ruta_legacy, media_type="audio/wav")
            raise HTTPException(status_code=404, detail="Archivo de audio no encontrado")
        
        # Le quitamos el '/static/' del inicio porque la ruta física real comienza desde la variable static_dir
        ruta_relativa = estudio.audio_path.replace("/static/", "", 1) 
        ruta_fisica = os.path.join(static_dir, ruta_relativa)
        
        if os.path.exists(ruta_fisica):
            return FileResponse(ruta_fisica, media_type="audio/wav")
        else:
            raise HTTPException(status_code=404, detail="Archivo de audio físico no localizado")
            
    finally:
        db.close()

@app.post("/api/pacientes/{paciente_id}/guardar-audio")
async def guardar_audio_paciente(paciente_id: int, audio: UploadFile = File(...)):
    pid = paciente_id 
    db = SessionLocal() # 🚀 Abrimos la BD primero para saber la fecha real
    
    try:
        # 1. Buscar el estudio para obtener su fecha original
        estudio = db.query(Estudio).filter(Estudio.paciente_id == pid).first()
        
        # 🔥 EL FIX: Usar la fecha del estudio original, si no existe, usar la de hoy
        fecha_referencia = estudio.fecha_estudio if (estudio and estudio.fecha_estudio) else datetime.now()
        
        año = str(fecha_referencia.year)
        mes = f"{fecha_referencia.month:02d}"
        dia = f"{fecha_referencia.day:02d}"

        # 2. Crear las subcarpetas físicas (ej: static/audios_dictado/2020/04/15/)
        directorio_audios = os.path.join(static_dir, "audios_dictado", año, mes, dia)
        os.makedirs(directorio_audios, exist_ok=True)
        
        # 3. Guardar archivo con un nombre único
        timestamp = datetime.now().strftime("%H%M%S") # La hora exacta del dictado sí nos sirve para que no se sobreescriba
        nombre_archivo = f"dictado_{pid}_{timestamp}.wav"
        ruta_archivo = os.path.join(directorio_audios, nombre_archivo)
        
        with open(ruta_archivo, "wb") as f:
            f.write(await audio.read())
            
        # 4. Construir la ruta relativa
        ruta_relativa = f"/static/audios_dictado/{año}/{mes}/{dia}/{nombre_archivo}"
            
        # 5. Persistencia en BD
        registro = db.query(Paciente).filter(Paciente.id == pid).first()
        if registro:
            registro.estado_pacs = "Dictado"
        
        if estudio:
            estudio.estado_pacs = "Dictado"
            if hasattr(estudio, "audio_path"):
                estudio.audio_path = ruta_relativa
            else:
                setattr(estudio, "audio_path", ruta_relativa) 
                
            setattr(estudio, "tiene_dictado", True)
        
        db.commit()
        print(f"✅ ÉXITO: Audio guardado con ILM Histórico (Fecha Estudio: {año}/{mes}/{dia}).")

        await manager.notify_update()
        return {"status": "success"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ ERROR GENERAL: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()