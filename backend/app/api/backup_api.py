# backend/app/api/backup_api.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from pydantic import BaseModel
import json
import os
import shutil

from app.core.database import SessionLocal, get_db
from app.models.estudio import Estudio

# Motores de servicios (Importados limpiamente en la cabecera)
from app.services.scheduler_service import ejecutar_rutina_backup_diario
from app.services.efilm_migration_service import ejecutar_migracion_efilm

router = APIRouter()

# Archivo temporal para guardar la configuración del frontend
CONFIG_FILE = "backup_config.json"

# ==========================================
# ESQUEMAS DE DATOS (PYDANTIC)
# ==========================================
class BackupConfigSchema(BaseModel):
    dias_maduracion: int
    modalidades: List[str]
    nas_ruta: str
    copia_internacional: bool

class EfilmConfigRequest(BaseModel):
    host: str = "localhost"
    database: str = "Efilm"
    usuario: str = "sa"
    password: str = "admin123"
    ruta_archivos: str = "C:\\Efilm\\Images"

# ==========================================
# FUNCIONES AUXILIARES
# ==========================================
def guardar_config_json(config: BackupConfigSchema):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config.dict(), f)

def leer_config_json():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    # Valores por defecto si nunca se ha guardado
    return {
        "dias_maduracion": 30,
        "modalidades": ["CT", "MR", "CR", "US", "DX"],
        "nas_ruta": "D:\\MI_PACS_NAS_EXTERNAL",
        "copia_internacional": False
    }

# ==========================================
# ENDPOINTS
# ==========================================

# 1. GET /backup/status — Ver info en el Dashboard
@router.get("/backup/status")
def obtener_estado_backup(db: Session = Depends(get_db)):
    try:
        config = leer_config_json()
        return {
            "status": "activo",
            "proxima_ejecucion": "01:00 AM",
            "dias_espera_actual": config["dias_maduracion"],
            "modalidades_activas": config["modalidades"],
            "nas_conectado": os.path.exists(config["nas_ruta"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer estado: {str(e)}")

# 2. POST /backup/config — Guardar reglas
@router.post("/backup/config")
def guardar_configuracion_backup(config: BackupConfigSchema, db: Session = Depends(get_db)):
    try:
        guardar_config_json(config)
        print(f"⚙️ [BACKUP] Regla guardada: {config.dias_maduracion} días | Modalidades: {config.modalidades}")
        return {"status": "success", "message": "Configuración de respaldo guardada correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar regla: {str(e)}")

# 3. POST /backup/run — ¡EL BOTÓN MANUAL QUE LLAMA AL MOTOR MAESTRO!
@router.post("/backup/run")
def disparar_backup_manual(background_tasks: BackgroundTasks):
    try:
        config = leer_config_json()
        if not os.path.exists(config["nas_ruta"]):
            raise Exception("La ruta de destino NAS no existe o el disco está desconectado.")
            
        # 🚀 Disparamos la rutina maestra avanzada (.tar.gz) en segundo plano
        background_tasks.add_task(ejecutar_rutina_backup_diario)
        
        return {
            "status": "success", 
            "message": "Motor avanzado (Tar.Gz) iniciado en segundo plano. Analizando estados y estructurando en NAS."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo iniciar: {str(e)}")

# 4. DELETE /purgar-importados — Limpieza del sistema
@router.delete("/purgar-importados")
def purgar_estudios_importados(dias_retencion: int = 30, db: Session = Depends(get_db)):
    try:
        fecha_limite = datetime.now() - timedelta(days=dias_retencion)
        estudios_a_purgar = db.query(Estudio).filter(
            Estudio.origen == 'IMPORTADO',
            Estudio.fecha_estudio < fecha_limite
        ).all()

        if not estudios_a_purgar:
            return {"mensaje": "No hay estudios caducados.", "cantidad_purgada": 0}

        cantidad_borrada = 0
        for estudio in estudios_a_purgar:
            if estudio.ruta_archivos and os.path.exists(estudio.ruta_archivos):
                try:
                    shutil.rmtree(estudio.ruta_archivos)
                except Exception as e:
                    print(f"Error borrando: {e}")
            
            db.delete(estudio)
            cantidad_borrada += 1

        db.commit()
        return {
            "mensaje": f"Se han purgado {cantidad_borrada} estudios importados.",
            "cantidad_purgada": cantidad_borrada
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error purga: {str(e)}")

# 5. POST /importar-efilm — INGESTA MASIVA DESDE EFILM / SQL SERVER
@router.post("/importar-efilm")
def iniciar_migracion_efilm(config: EfilmConfigRequest, background_tasks: BackgroundTasks):
    """
    Botón maestro para iniciar la importación desde un sistema Efilm heredado.
    Se ejecuta en segundo plano porque puede tardar horas.
    """
    db = SessionLocal()
    try:
        # Convertimos el modelo a diccionario
        config_dict = config.dict()
        
        # Lo enviamos a procesar en segundo plano para no bloquear el frontend
        background_tasks.add_task(ejecutar_migracion_efilm, db, config_dict)
        
        return {
            "status": "success",
            "message": "Migración masiva desde Efilm iniciada. Las imágenes se registrarán como 'Importado' y serán respaldadas automáticamente."
        }
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=f"Error al iniciar migración: {str(e)}")