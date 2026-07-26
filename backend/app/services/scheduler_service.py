import os
import shutil
import tarfile
import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.pacs_config import PACSConfig 

# Importamos las rutas configuradas en tu sistema
from app.core.config import DICOM_ARCHIVADOS_DIR, PDF_REPORTS_DIR

scheduler = BackgroundScheduler()
CONFIG_FILE = "backup_config.json"

def leer_config_json():
    # Valores por defecto si el usuario aún no ha guardado nada en el panel
    config = {
        "dias_maduracion": 30,
        "modalidades": ["CT", "MR", "DX", "US", "MG", "CR", "DXA", "PET", "RF", "XA"],
        "nas_ruta": "D:\\MI_PACS_NAS_EXTERNAL", 
        "copia_internacional": False
    }
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                config.update(data)
        except Exception:
            pass
            
    # 🚀 Se eliminó el blindaje que forzaba la ruta. Ahora el sistema confía 100% 
    # en la configuración guardada ('data') proveniente de tu frontend.
    return config


def ejecutar_rutina_backup_diario(estado_rutina=None):
    print(f"📦 [BACKUP PACS] Iniciando ciclo automático de análisis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    
    try:
        config_pacs = db.query(PACSConfig).first()
        config_front = leer_config_json()
        
        NAS_LOCAL_DIR = config_front["nas_ruta"]
        dias_espera = config_front["dias_maduracion"] 
        modalidades_activas = config_front["modalidades"]
        
        CLOUD_OFFSITE_DIR = r"D:\MI_PACS_SECURE_REPLICA"
        
        fecha_limite = datetime.now() - timedelta(days=dias_espera)
        
        # 🚀 1. PRE-CÁLCULO PARA LA BARRA DE PROGRESO DE REACT
        total_estudios_procesar = 0
        estudios_por_modalidad = {}
        
        for mod in modalidades_activas:
            query = db.query(Estudio).filter(Estudio.fecha_estudio <= fecha_limite)
            if hasattr(Estudio, "tipo_estudio"):
                query = query.filter(Estudio.tipo_estudio == mod)
            estudios = query.all()
            if estudios:
                estudios_por_modalidad[mod] = estudios
                total_estudios_procesar += len(estudios)

        # Sincronizamos el total detectado con el frontend
        if estado_rutina:
            estado_rutina["total_detectados"] = total_estudios_procesar
            estado_rutina["exitosos"] = 0
            estado_rutina["fallidos"] = 0

        # Si no hay nada que empaquetar, terminamos limpio
        if total_estudios_procesar == 0:
            print(f"⚠️ [BACKUP PACS] Ciclo finalizado: No hay estudios que superen el umbral de {dias_espera} días de maduración.")
            return

        for mod, estudios_a_respaldar in estudios_por_modalidad.items():
            
            # 🚀 2. FRENO DE EMERGENCIA GLOBAL
            if estado_rutina and estado_rutina.get("cancelado"):
                print("🛑 [MOTOR] Rutina de Backup ABORTADA por orden del operador clínico.")
                break
                
            print(f"📂 [BACKUP] Empaquetando {len(estudios_a_respaldar)} estudios maduros de la modalidad [{mod}] (>{dias_espera} días)")
            
            for estudio in estudios_a_respaldar:
                # 🚀 3. FRENO DE EMERGENCIA POR ESTUDIO
                if estado_rutina and estado_rutina.get("cancelado"):
                    break

                try:
                    fecha_est = getattr(estudio, "fecha_estudio", None) or datetime.now()
                    año, mes, dia = str(fecha_est.year), f"{fecha_est.month:02d}", f"{fecha_est.day:02d}"
                    
                    ruta_destino_nas = os.path.join(NAS_LOCAL_DIR, mod, año, mes, dia)
                    os.makedirs(ruta_destino_nas, exist_ok=True)
                    
                    estudio_id = getattr(estudio, "id", "1")
                    paciente_id = getattr(estudio, "paciente_id", "Desconocido")
                    accession_number = getattr(estudio, "accession_number", str(estudio_id))
                    
                    nombre_archivo_backup = f"PACIENTE_{paciente_id}_EST_{accession_number}.tar.gz"
                    ruta_final_tar = os.path.join(ruta_destino_nas, nombre_archivo_backup)
                    ruta_replica_internacional = os.path.join(CLOUD_OFFSITE_DIR, nombre_archivo_backup)
                    
                    if not os.path.exists(ruta_final_tar):
                        print(f"⏳ Comprimiendo estudio ID {estudio_id} (Accession: {accession_number})...")
                        with tarfile.open(ruta_final_tar, "w:gz") as tar:
                            
                            # 1. EMPAQUETAR IMÁGENES DICOM
                            ruta_dicom = getattr(estudio, "ruta_archivos", "")
                            if not ruta_dicom or not os.path.exists(ruta_dicom):
                                ruta_dicom = os.path.join(str(DICOM_ARCHIVADOS_DIR), accession_number)
                            
                            if os.path.exists(ruta_dicom):
                                tar.add(ruta_dicom, arcname=f"1_IMAGENES_DICOM_{accession_number}")
                                
                            # 2. EMPAQUETAR REPORTE PDF FIRMADO
                            ruta_pdf = os.path.join(str(PDF_REPORTS_DIR), f"{accession_number}.pdf")
                            if os.path.exists(ruta_pdf):
                                tar.add(ruta_pdf, arcname=f"2_REPORTE_CLINICO_{accession_number}.pdf")

                            # 3. EMPAQUETAR AUDIO / DICTADO
                            base_audios_dir = os.path.join("static", "audios_dictado")
                            ruta_audio_wav = os.path.join(base_audios_dir, año, mes, dia, f"dictado_{accession_number}.wav")
                            ruta_audio_mp3 = os.path.join(base_audios_dir, año, mes, dia, f"dictado_{accession_number}.mp3")
                            ruta_audio_wav_alt = os.path.join(base_audios_dir, año, mes, dia, f"dictado_{estudio_id}.wav")
                            ruta_audio_mp3_alt = os.path.join(base_audios_dir, año, mes, dia, f"dictado_{estudio_id}.mp3")
                            
                            if os.path.exists(ruta_audio_mp3):
                                tar.add(ruta_audio_mp3, arcname=f"3_DICTADO_VOZ_{accession_number}.mp3")
                            elif os.path.exists(ruta_audio_wav):
                                tar.add(ruta_audio_wav, arcname=f"3_DICTADO_VOZ_{accession_number}.wav")
                            elif os.path.exists(ruta_audio_wav_alt):
                                tar.add(ruta_audio_wav_alt, arcname=f"3_DICTADO_VOZ_{estudio_id}.wav")
                            elif os.path.exists(ruta_audio_mp3_alt):
                                tar.add(ruta_audio_mp3_alt, arcname=f"3_DICTADO_VOZ_{estudio_id}.mp3")

                            # 4. NOTA DESCRIPTIVA DE METADATOS
                            nota_clinica_path = os.path.join(ruta_destino_nas, f"NOTAS_EST_{estudio_id}.txt")
                            with open(nota_clinica_path, "w", encoding="utf-8") as f:
                                f.write(f"--- RESPALDO MÉDICO ---\n")
                                f.write(f"Accession Number: {accession_number}\n")
                                f.write(f"Estudio ID: {estudio_id}\n")
                                f.write(f"Paciente ID: {paciente_id}\n")
                                f.write(f"Modalidad: {mod}\n")
                                f.write(f"Fecha Respaldo: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                            tar.add(nota_clinica_path, arcname="4_INFORMACION_ANEXA.txt")
                            os.remove(nota_clinica_path)

                    if config_front.get("copia_internacional", False):
                        os.makedirs(CLOUD_OFFSITE_DIR, exist_ok=True)
                        if not os.path.exists(ruta_replica_internacional):
                            shutil.copy2(ruta_final_tar, ruta_replica_internacional)
                            
                    print(f"✅ Backup Exitoso Completo: {accession_number} -> {mod}/{año}/{mes}/{dia}")
                    
                    # 🚀 4. SINCRONIZAR ÉXITO CON REACT
                    if estado_rutina:
                        estado_rutina["exitosos"] += 1
                        
                except Exception as e_interno:
                    print(f"⚠️ Error empaquetando el estudio ID {getattr(estudio, 'id', 'Desconocido')}: {str(e_interno)}")
                    # 🚀 SINCRONIZAR FALLO CON REACT
                    if estado_rutina:
                        estado_rutina["fallidos"] += 1

        if not (estado_rutina and estado_rutina.get("cancelado")):
            print("🏁 [BACKUP PACS] Ciclo de compresión y respaldo en segundo plano finalizado con éxito.")
                    
    except Exception as e:
        print(f"❌ Error crítico en la rutina de backup: {str(e)}")
        if estado_rutina:
            estado_rutina["fallidos"] += 1
    finally:
        db.close()
        # 🚀 5. APAGAR EL MONITOR DE LA INTERFAZ
        if estado_rutina:
            estado_rutina["finalizado"] = True
            estado_rutina["en_progreso"] = False


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