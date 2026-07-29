import os
import shutil
import json
import pydicom
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.paciente import Paciente
from app.models.pacs_config import PACSConfig 

# Importamos las rutas configuradas en tu sistema
from app.core.config import DICOM_ARCHIVADOS_DIR, PDF_REPORTS_DIR

scheduler = BackgroundScheduler()
CONFIG_FILE = "backup_config.json"

def leer_config_json():
    config = {
        "dias_maduracion": 30,
        "modalidades": ["CT", "MR", "DX", "US", "MG", "CR", "DXA", "PET", "RF", "XA"],
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
        
        # 🚀 1. PRE-CÁLCULO PARA LA BARRA DE PROGRESO
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

        if estado_rutina:
            estado_rutina["total_detectados"] = total_estudios_procesar
            estado_rutina["exitosos"] = 0
            estado_rutina["fallidos"] = 0

        if total_estudios_procesar == 0:
            print(f"⚠️ [BACKUP PACS] Ciclo finalizado: No hay estudios que superen el umbral de {dias_espera} días.")
            return

        for mod, estudios_a_respaldar in estudios_por_modalidad.items():
            
            if estado_rutina and estado_rutina.get("cancelado"):
                print("🛑 [MOTOR] Rutina de Backup ABORTADA por orden del operador clínico.")
                break
                
            print(f"📂 [BACKUP] Copiando {len(estudios_a_respaldar)} estudios de [{mod}] (>{dias_espera} días)")
            
            for estudio in estudios_a_respaldar:
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
                    
                    # ====================================================================
                    # 🚀 NUEVO SISTEMA DE NOMBRADO (ESTILO EXPORTACIÓN)
                    # ====================================================================
                    paciente_db = estudio.paciente
                    
                    p_nombre = (getattr(paciente_db, "primer_nombre", "") or "").strip() if paciente_db else ""
                    p_apellido = (getattr(paciente_db, "primer_apellido", "") or "").strip() if paciente_db else ""
                    nombre_paciente = f"{p_nombre}_{p_apellido}".replace(" ", "_")
                    if not nombre_paciente or nombre_paciente == "_": 
                        nombre_paciente = "PACIENTE_DESCONOCIDO"
                        
                    identificacion_paciente = str(getattr(paciente_db, "identificacion", paciente_id)).strip() if paciente_db else str(paciente_id)
                    
                    # Formato final: EJ: JOSE_HELMER_VARON_ID17709056_EST_123
                    nombre_carpeta_backup = f"{nombre_paciente}_ID{identificacion_paciente}_EST_{accession_number}"
                    # ====================================================================
                    
                    ruta_estudio_nas = os.path.join(ruta_destino_nas, nombre_carpeta_backup)
                    ruta_replica_internacional = os.path.join(CLOUD_OFFSITE_DIR, nombre_carpeta_backup)
                    
                    if not os.path.exists(ruta_estudio_nas):
                        print(f"⏳ Procesando estudio ID {estudio_id} (Accession: {accession_number})...")
                        os.makedirs(ruta_estudio_nas, exist_ok=True)
                        
                        # INYECCIÓN DEL MOTOR DE EXPORTACIÓN (BARRERA DE TITANIO DICOM)
                        target_uid = str(getattr(estudio, "study_instance_uid", "")).strip()
                        target_modality = str(getattr(estudio, "tipo_estudio", getattr(estudio, "modalidad", ""))).strip().upper()
                        
                        if not target_uid and hasattr(estudio, "dicom_metadata") and estudio.dicom_metadata:
                            try: 
                                meta = json.loads(estudio.dicom_metadata)
                                target_uid = str(meta.get("StudyInstanceUID", "")).strip()
                            except: pass

                        # RECOPILACIÓN DE RUTAS SOSPECHOSAS
                        rutas_validas = set()
                        r1 = getattr(estudio, "ruta_archivos", None)
                        r2 = getattr(estudio, "ruta_dicom", None)
                        if r1 and os.path.exists(r1): rutas_validas.add(r1)
                        if r2 and os.path.exists(r2): rutas_validas.add(r2)
                        if target_uid:
                            ruid = os.path.join(str(DICOM_ARCHIVADOS_DIR), target_uid)
                            if os.path.exists(ruid): rutas_validas.add(ruid)

                        # BÚSQUEDA EXHAUSTIVA DE EMERGENCIA
                        base_dir = str(DICOM_ARCHIVADOS_DIR)
                        if os.path.exists(base_dir):
                            for folder_name in os.listdir(base_dir):
                                folder_path = os.path.join(base_dir, folder_name)
                                if os.path.isdir(folder_path) and folder_path not in rutas_validas:
                                    all_files = [os.path.join(dp, f) for dp, dn, filenames in os.walk(folder_path) for f in filenames]
                                    for f in all_files[:5]: 
                                        try:
                                            ds = pydicom.dcmread(f, stop_before_pixels=True, force=True)
                                            p_id = str(getattr(ds, "PatientID", "")).strip()
                                            if identificacion_paciente in p_id or p_id in identificacion_paciente:
                                                rutas_validas.add(folder_path)
                                                break
                                        except:
                                            continue

                        carpeta_dicom_destino = os.path.join(ruta_estudio_nas, "1_IMAGENES_DICOM")
                        os.makedirs(carpeta_dicom_destino, exist_ok=True)

                        # BUCLE DE EXTRACCIÓN MILIMÉTRICA
                        archivos_copiados = 0
                        if rutas_validas:
                            try:
                                for ruta in rutas_validas:
                                    for root, dirs, files in os.walk(ruta):
                                        for file in files:
                                            src_file = os.path.join(root, file)
                                            
                                            try:
                                                ds = pydicom.dcmread(src_file, stop_before_pixels=True, force=True)
                                                file_pid = str(getattr(ds, "PatientID", "")).strip()
                                                file_uid = str(getattr(ds, "StudyInstanceUID", "")).strip()
                                                file_mod = str(getattr(ds, "Modality", "")).strip().upper()
                                                
                                                # 🚨 BARRERA 1: IDENTIDAD ESTRICTA DEL PACIENTE
                                                if identificacion_paciente not in file_pid and file_pid not in identificacion_paciente:
                                                    continue 

                                                # 🚨 BARRERA 2: AISLAMIENTO EXACTO DEL ESTUDIO
                                                if target_uid and file_uid and target_uid != file_uid:
                                                    continue 
                                                elif not target_uid and target_modality and file_mod:
                                                    if target_modality not in file_mod and file_mod not in target_modality:
                                                        if target_modality in ["CR", "DX"] and file_mod in ["CR", "DX"]:
                                                            pass
                                                        else:
                                                            continue 
                                            except Exception:
                                                continue # Si no es un archivo DICOM, lo ignoramos

                                            # ¡SI LLEGA AQUÍ, ES EL ARCHIVO CORRECTO Y PURO!
                                            archivos_copiados += 1
                                            nombre_unico = f"IMG_{archivos_copiados:05d}.dcm"
                                            dest_file = os.path.join(carpeta_dicom_destino, nombre_unico)
                                            shutil.copy2(src_file, dest_file)
                                            
                                print(f"  └─ ✅ RESPALDO DICOM AISLADO: {archivos_copiados} imágenes transferidas.")
                            except Exception as e:
                                print(f"  └─ ❌ Error en copia multiserie: {e}")
                        else:
                            print(f"  └─ ⚠️ ALERTA: No se localizó carpeta DICOM específica.")

                        # 2. COPIAR REPORTE PDF FIRMADO
                        ruta_pdf = os.path.join(str(PDF_REPORTS_DIR), f"{accession_number}.pdf")
                        if os.path.exists(ruta_pdf):
                            destino_pdf = os.path.join(ruta_estudio_nas, f"2_REPORTE_CLINICO_{accession_number}.pdf")
                            shutil.copy2(ruta_pdf, destino_pdf)

                        # 3. COPIAR AUDIO / DICTADO
                        base_audios_dir = os.path.join("static", "audios_dictado")
                        rutas_audio = [
                            (os.path.join(base_audios_dir, año, mes, dia, f"dictado_{accession_number}.mp3"), f"3_DICTADO_VOZ_{accession_number}.mp3"),
                            (os.path.join(base_audios_dir, año, mes, dia, f"dictado_{accession_number}.wav"), f"3_DICTADO_VOZ_{accession_number}.wav"),
                            (os.path.join(base_audios_dir, año, mes, dia, f"dictado_{estudio_id}.mp3"), f"3_DICTADO_VOZ_{estudio_id}.mp3"),
                            (os.path.join(base_audios_dir, año, mes, dia, f"dictado_{estudio_id}.wav"), f"3_DICTADO_VOZ_{estudio_id}.wav")
                        ]
                        for ruta_origen, nombre_archivo in rutas_audio:
                            if os.path.exists(ruta_origen):
                                shutil.copy2(ruta_origen, os.path.join(ruta_estudio_nas, nombre_archivo))
                                break

                        # 4. NOTA DESCRIPTIVA DE METADATOS
                        nota_clinica_path = os.path.join(ruta_estudio_nas, "4_INFORMACION_ANEXA.txt")
                        with open(nota_clinica_path, "w", encoding="utf-8") as f:
                            f.write(f"--- RESPALDO MÉDICO ---\n")
                            f.write(f"Nombre: {nombre_paciente.replace('_', ' ')}\n")
                            f.write(f"Identificación (CC/ID): {identificacion_paciente}\n")
                            f.write(f"Accession Number: {accession_number}\n")
                            f.write(f"Estudio ID: {estudio_id}\n")
                            f.write(f"Modalidad: {mod}\n")
                            f.write(f"Total Imágenes Respaldadas: {archivos_copiados}\n")
                            f.write(f"Alerta: {'IMÁGENES NO ENCONTRADAS' if archivos_copiados == 0 else 'IMÁGENES OK'}\n")
                            f.write(f"Fecha Respaldo: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

                    # Copia internacional si está activa
                    if config_front.get("copia_internacional", False):
                        os.makedirs(CLOUD_OFFSITE_DIR, exist_ok=True)
                        if not os.path.exists(ruta_replica_internacional):
                            shutil.copytree(ruta_estudio_nas, ruta_replica_internacional, dirs_exist_ok=True)
                            
                    print(f"✅ Backup Exitoso Completo: {nombre_carpeta_backup} -> {mod}/{año}/{mes}/{dia}")
                    
                    if estado_rutina:
                        estado_rutina["exitosos"] += 1
                        
                except Exception as e_interno:
                    print(f"⚠️ Error procesando el estudio ID {getattr(estudio, 'id', 'Desconocido')}: {str(e_interno)}")
                    if estado_rutina:
                        estado_rutina["fallidos"] += 1

        if not (estado_rutina and estado_rutina.get("cancelado")):
            print("🏁 [BACKUP PACS] Ciclo de copiado en segundo plano finalizado con éxito.")
                    
    except Exception as e:
        print(f"❌ Error crítico en la rutina de backup: {str(e)}")
        if estado_rutina:
            estado_rutina["fallidos"] += 1
    finally:
        db.close()
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