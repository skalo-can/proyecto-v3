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

# Motores de servicios oficiales
from app.services.scheduler_service import ejecutar_rutina_backup_diario
from app.services.efilm_migration_service import ejecutar_migracion_efilm

router = APIRouter()

# Archivo temporal para guardar la configuración del frontend
CONFIG_FILE = "backup_config.json"

# ==========================================
# 🚀 MATRIZ GLOBAL DE SEGUIMIENTO (ASÍNCRONA)
# ==========================================
ESTADO_RUTINA = {
    "en_progreso": False,
    "exitosos": 0,
    "fallidos": 0,
    "total_detectados": 0,
    "finalizado": False,
    "cancelado": False,
    "operacion": ""
}

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
    # Valores por defecto seguros orientados a la unidad H:
    config = {
        "dias_maduracion": 30,
        "modalidades": ["CT", "MR", "CR", "US", "DX"],
        "nas_ruta": "H:\\MI_PACS_NAS_EXTERNAL",
        "copia_internacional": False
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                config.update(data)
        except Exception:
            pass
            
    # 🛡️ Blindaje crítico: Forzamos la ruta fija al disco H externo independientemente del JSON viejo
    # config["nas_ruta"] = "H:\\MI_PACS_NAS_EXTERNAL"
    return config

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
    
# 2.5 GET /backup/config — Cargar reglas en la interfaz
@router.get("/backup/config")
def obtener_configuracion_backup(db: Session = Depends(get_db)):
    try:
        # Devuelve el JSON tal cual para que React lo pinte en pantalla
        return leer_config_json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar configuración: {str(e)}")

# 3. POST /backup/run — ¡BOTÓN OFICIAL CONECTADO AL MOTOR DE MADURACIÓN!
@router.post("/backup/run")
def disparar_backup_manual(background_tasks: BackgroundTasks):
    global ESTADO_RUTINA
    try:
        config = leer_config_json()
        if not os.path.exists(config["nas_ruta"]):
            raise Exception(f"La ruta de destino NAS ({config['nas_ruta']}) no existe o el disco está desconectado.")
            
        # 🚀 Arrancamos el monitor asíncrono
        ESTADO_RUTINA.update({
            "en_progreso": True,
            "exitosos": 0,
            "fallidos": 0,
            "total_detectados": 100, # Valor temporal, el servicio real actualizará esto
            "finalizado": False,
            "cancelado": False,
            "operacion": "backup"
        })
            
        # Llamada asíncrona al motor maestro pasando la referencia del ESTADO
        background_tasks.add_task(ejecutar_rutina_backup_diario, ESTADO_RUTINA)
        
        return {
            "status": "processing", 
            "archivos_detectados": 100,
            "message": "Rutina automática iniciada en segundo plano aplicando reglas de maduración."
        }
    except Exception as e:
        ESTADO_RUTINA["en_progreso"] = False
        raise HTTPException(status_code=400, detail=f"No se pudo iniciar: {str(e)}")

# 4. DELETE /purgar-importados — Limpieza del sistema
@router.delete("/purgar-importados")
def purgar_estudios_importados(dias_retencion: int = 30, db: Session = Depends(get_db)):
    try:
        fecha_limite = datetime.now() - timedelta(days=dias_retencion)
        
        # 🔥 Usamos estado_pacs == 'Importado' que es el campo correcto de la base de datos
        estudios_a_purgar = db.query(Estudio).filter(
            Estudio.estado_pacs == 'Importado',
            Estudio.fecha_estudio < fecha_limite
        ).all()

        if not estudios_a_purgar:
            return {"mensaje": "No hay estudios caducados.", "cantidad_purgada": 0}

        cantidad_borrada = 0
        for estudio in estudios_a_purgar:
            if hasattr(estudio, 'ruta_archivos') and estudio.ruta_archivos and os.path.exists(estudio.ruta_archivos):
                try:
                    shutil.rmtree(estudio.ruta_archivos)
                except Exception as e:
                    print(f"Error borrando archivos físicos: {e}")
            
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
    db = SessionLocal()
    try:
        config_dict = config.dict()
        background_tasks.add_task(ejecutar_migracion_efilm, db, config_dict)
        return {
            "status": "success",
            "message": "Migración masiva desde Efilm iniciada."
        }
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=f"Error al iniciar migración: {str(e)}") 

# ==========================================
# 📡 ENDPOINTS DE NODOS DICOM (C-STORE)
# ==========================================
@router.get("/nodos")
def obtener_nodos_dicom():
    """
    Devuelve la lista de estaciones DICOM configuradas en la infraestructura
    para el envío manual y automático de estudios.
    """
    # Simulando tu estación TACSKL real para la conexión inmediata
    return [
        {
            "id": 1,
            "nombre": "tomografia",
            "ae_title": "TACSKL",
            "ip": "192.168.5.23",
            "puerto": 4006,
            "modalidades": ["CT", "CR", "DX"] 
        }
    ]

# Importación crítica para que el candado funcione
from app.core.auth import obtener_usuario_actual

# Esquema para recibir la orden del frontend
class EnvioDicomRequest(BaseModel):
    destino_aet: str
    estudios_ids: List[int]

# El endpoint oficial que recibe la orden
@router.post("/dicom/send")
def procesar_envio_dicom(
    datos: EnvioDicomRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)
):
    try:
        print(f"🚀 [C-STORE] Orden recibida autorizada para enviar a {datos.destino_aet}")
        print(f"📁 IDs de estudios a enviar: {datos.estudios_ids}")

        # 👇 Asegúrate de que esta línea esté alineada exactamente igual que los 'print' de arriba
        background_tasks.add_task(enviar_estudios_a_nodo, datos.destino_aet, datos.estudios_ids)

        return {
            "status": "success", 
            "message": f"Orden de transferencia hacia {datos.destino_aet} autorizada e iniciada."
        }
    except Exception as e:
        print(f"❌ Error al iniciar envío: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# ==========================================
# 🏥 ENDPOINTS DE PERFIL INSTITUCIONAL
# ==========================================
PERFIL_FILE = "perfil_institucion.json"

class PerfilSchema(BaseModel):
    nombre_clinica: str = ""
    nit_registro: str = ""
    direccion: str = ""
    telefono: str = ""
    email: str = ""
    sitio_web: str = ""
    modalidades_activas: List[str] = []
    smtp_server: str = ""
    smtp_port: str = ""
    smtp_user: str = ""
    smtp_pass: str = ""
    wa_token: str = ""
    sms_api_key: str = ""
    envio_automatico: bool = False

@router.get("/admin/perfil-institucion")
def obtener_perfil_institucion():
    if os.path.exists(PERFIL_FILE):
        try:
            with open(PERFIL_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "nombre_clinica": "", "nit_registro": "", "direccion": "",
        "telefono": "", "email": "", "sitio_web": "",
        "modalidades_activas": ["CR", "DX", "US"],
        "smtp_server": "", "smtp_port": "", "smtp_user": "", "smtp_pass": "",
        "wa_token": "", "sms_api_key": "", "envio_automatico": False
    }

@router.post("/admin/perfil-institucion")
def guardar_perfil_institucion(perfil: PerfilSchema):
    try:
        with open(PERFIL_FILE, "w") as f:
            json.dump(perfil.dict(), f)
        return {"status": "success", "message": "Perfil guardado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    

# ==========================================
# 🚀 ENDPOINTS DE COMUNICACIÓN ASÍNCRONA
# ==========================================
@router.get("/admin/estado-rutina")
def obtener_estado_rutina():
    """Endpoint de Polling para React"""
    global ESTADO_RUTINA
    return ESTADO_RUTINA

@router.post("/admin/cancelar-rutina")
def cancelar_rutina():
    """Freno de emergencia del motor"""
    global ESTADO_RUTINA
    if not ESTADO_RUTINA["en_progreso"]:
        raise HTTPException(status_code=400, detail="No hay ninguna rutina en curso.")
    
    ESTADO_RUTINA["cancelado"] = True
    return {"status": "success", "message": "Orden de cancelación en curso."}

from fastapi import Query

# ==========================================
# 🔍 BUSCADOR DE BACKUPS EN EL NAS (MEJORADO)
# ==========================================
@router.get("/backup/buscar-en-nas")
def buscar_en_nas(q: str = Query(..., min_length=2)):
    try:
        config = leer_config_json()
        nas_ruta = config["nas_ruta"]
        
        if not os.path.exists(nas_ruta):
            raise HTTPException(status_code=400, detail="El disco NAS no está conectado o la ruta es inaccesible.")
        
        resultados = []
        # 🚀 TRUCO DE BÚSQUEDA: Dividimos lo que escribes en palabras separadas
        terminos_busqueda = q.lower().strip().split()
        
        for root, dirs, files in os.walk(nas_ruta):
            # Optimización: ignoramos carpetas internas
            dirs[:] = [d for d in dirs if not d.startswith("1_IMAGENES_DICOM") and d != "MI_PACS_Visor_Lite"]
            
            for dir_name in dirs:
                # Convertimos el nombre de la carpeta a minúsculas
                nombre_carpeta = dir_name.lower()
                
                # 🔥 LÓGICA INTELIGENTE: Verificamos que TODAS las palabras que escribiste estén en el nombre
                coincide = all(termino in nombre_carpeta for termino in terminos_busqueda)
                
                if coincide and "_ID" in dir_name and "_EST_" in dir_name:
                    ruta_completa = os.path.join(root, dir_name)
                    
                    # Extraer datos de la estructura
                    partes_ruta = root.replace(nas_ruta, "").strip("\\/").split(os.sep)
                    modalidad = partes_ruta[0] if len(partes_ruta) > 0 else "N/A"
                    fecha_str = f"{partes_ruta[1]}-{partes_ruta[2]}-{partes_ruta[3]}" if len(partes_ruta) >= 4 else "Desconocida"
                    
                    try:
                        p_nombre = dir_name.split("_ID")[0].replace("_", " ")
                        p_id = dir_name.split("_ID")[1].split("_EST_")[0]
                        p_est = dir_name.split("_EST_")[1]
                    except:
                        p_nombre = dir_name
                        p_id = "-"
                        p_est = "-"
                    
                    resultados.append({
                        "nombre_paciente": p_nombre,
                        "identificacion": p_id,
                        "accession_number": p_est,
                        "modalidad": modalidad,
                        "fecha_backup": fecha_str,
                        "ruta": ruta_completa
                    })
                        
        return resultados
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
class RutaRequest(BaseModel):
    ruta: str

@router.post("/backup/abrir-ubicacion")
def abrir_ubicacion(datos: RutaRequest):
    """Abre mágicamente la carpeta local en el explorador de Windows del servidor"""
    try:
        if os.path.exists(datos.ruta):
            os.startfile(datos.ruta)
            return {"status": "success", "message": "Carpeta abierta en el servidor."}
        else:
            raise HTTPException(status_code=404, detail="La ruta ya no existe en el disco.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo abrir la carpeta: {str(e)}") 