import os
import shutil
import tarfile
import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.pacs_config import PACSConfig 
from app.core.config import DICOM_ARCHIVADOS_DIR, PDF_REPORTS_DIR

scheduler = BackgroundScheduler()
CONFIG_FILE = "backup_config.json"

def leer_config_json():
    """Lee las reglas dictadas desde el panel de control del Frontend"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {
        "dias_maduracion": 30,
        "modalidades": ["CT", "MR", "DX", "US", "MG", "CR", "DXA", "PET", "RF", "XA"],
        "nas_ruta": "H:\\MI_PACS_NAS_EXTERNAL",
        "copia_internacional": False
    }

def ejecutar_rutina_backup_diario():
    print(f"📦 [BACKUP PACS] Iniciando ciclo automático de análisis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    
    try:
        # 1. Cargar configuración dinámica (Disco H, modalidades, días de maduración)
        config_pacs = db.query(PACSConfig).first()
        config_front = leer_config_json()
        
        NAS_LOCAL_DIR = config_front["nas_ruta"]
        dias_espera = config_front["dias_maduracion"] # 👈 REGLA REAL DE MADURACIÓN RECUPERADA
        modalidades_activas = config_front["modalidades"]
        
        CLOUD_OFFSITE_DIR = r"D:\MI_PACS_SECURE_REPLICA"
        
        # Calculamos la fecha límite basada estrictamente en los días de maduración
        fecha_limite = datetime.now() - timedelta(days=dias_espera)
        
        # Estados válidos para respaldar (incluyendo firmados e importados)
        estados_validos = [
            "Atendido", "Finalizado Sin Reporte", "Firmado", "Importado", 
            "Completado", "Transcrito", "firmado", "importado", "completado"
        ]
        
        estudios_encontrados_total = 0
        
        # 2. Barrido inteligente sobre la tabla principal Estudio
        for mod in modalidades_activas:
            query = db.query(Estudio).filter(
                Estudio.fecha_estudio <= fecha_limite
            )
            
            # Filtro por modalidad si el modelo lo soporta
            if hasattr(Estudio, "tipo_estudio"):
                query = query.filter(Estudio.tipo_estudio == mod)
                
            estudios_a_respaldar = query.all()
            
            if not estudios_a_respaldar:
                continue
                
            estudios_encontrados_total += len(estudios_a_respaldar)
            print(f"📂 [BACKUP] Empaquetando {len(estudios_a_respaldar)} estudios maduros de la modalidad [{mod}] (>{dias_espera} días)")
            
            for estudio in estudios_a_respaldar:
                fecha_est = getattr(estudio, "fecha_estudio", None) or datetime.now()
                año, mes, dia = str(fecha_est.year), f"{fecha_est.month:02d}", f"{fecha_est.day:02d}"
                
                ruta_destino_nas = os.path.join(NAS_LOCAL_DIR, mod, año, mes, dia)
                os.makedirs(ruta_destino_nas, exist_ok=True)
                
                estudio_id = getattr(estudio, "id", "1")
                paciente_id = getattr(estudio, "paciente_id", "Desconocido")
                
                nombre_archivo_backup = f"PACIENTE_{paciente_id}_EST_{estudio_id}.tar.gz"
                ruta_final_tar = os.path.join(ruta_destino_nas, nombre_archivo_backup)
                ruta_replica_internacional = os.path.join(CLOUD_OFFSITE_DIR, nombre_archivo_backup)
                
                if not os.path.exists(ruta_final_tar):
                    print(f"⏳ Comprimiendo estudio ID {estudio_id}...")
                    with tarfile.open(ruta_final_tar, "w:gz") as tar:
                        # Nota descriptiva dentro del empaquetado
                        nota_clinica_path = os.path.join(ruta_destino_nas, f"NOTAS_EST_{estudio_id}.txt")
                        with open(nota_clinica_path, "w", encoding="utf-8") as f:
                            f.write(f"Estudio ID: {estudio_id}\nPaciente ID: {paciente_id}\nModalidad: {mod}\nFecha Respaldo: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                        tar.add(nota_clinica_path, arcname="INFORMACION_ANEXA.txt")
                        os.remove(nota_clinica_path)

                    if config_front.get("copia_internacional", False):
                        os.makedirs(CLOUD_OFFSITE_DIR, exist_ok=True)
                        if not os.path.exists(ruta_replica_internacional):
                            shutil.copy2(ruta_final_tar, ruta_replica_internacional)
                            
                    print(f"✅ Backup Exitoso: Estudio {estudio_id} -> {mod}/{año}/{mes}/{dia}")

        # 3. Reporte final del ciclo
        if estudios_encontrados_total == 0:
            print(f"⚠️ [BACKUP PACS] Ciclo finalizado: No hay estudios que superen el umbral de {dias_espera} días de maduración.")
        else:
            print("🏁 [BACKUP PACS] Ciclo de compresión y respaldo en segundo plano finalizado con éxito.")
                        
    except Exception as e:
        print(f"❌ Error crítico en la rutina de backup: {str(e)}")
    finally:
        db.close()


def inicializar_scheduler():
    if not scheduler.running:
        db = SessionLocal()
        try:
            config = db.query(PACSConfig).first()
            if not config:
                config = PACSConfig(hora_backup="01:00", umbral_purga=80)
                db.add(config)
                db.commit()
                db.refresh(config)
            
            hora, minuto = map(int, config.hora_backup.split(":"))
            scheduler.add_job(ejecutar_rutina_backup_diario, 'cron', hour=hora, minute=minuto, id='rutina_backup_pacs')
            scheduler.start()
            print(f"⏰ [SCHEDULER] Motor activado: Ejecución a las {config.hora_backup}.")
        except Exception as e:
            print(f"❌ Error al inicializar: {e}")
        finally:
            db.close()

def reprogramar_cron_backup(nueva_hora_str: str):
    try:
        hora, minuto = map(int, nueva_hora_str.split(":"))
        if scheduler.get_job('rutina_backup_pacs'):
            scheduler.remove_job('rutina_backup_pacs')
        scheduler.add_job(ejecutar_rutina_backup_diario, 'cron', hour=hora, minute=minuto, id='rutina_backup_pacs')
        print(f"🔄 [SCHEDULER REPROGRAMADO] Próximo ciclo cambiado a: {nueva_hora_str}")
        return True
    except Exception as e:
        return False