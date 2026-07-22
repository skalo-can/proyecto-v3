import os
import shutil
import tarfile
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.models.ris_orden import RISOrden
from app.models.estudio import Estudio
from app.models.pacs_config import PACSConfig 

# 🔥 INYECTAMOS LAS ANCLAS ABSOLUTAS
from app.core.config import DICOM_ARCHIVADOS_DIR, PDF_REPORTS_DIR

# Inicializamos el planificador global de fondo
scheduler = BackgroundScheduler()

def ejecutar_rutina_backup_diario():
    """
    Rutina maestra ejecutada automáticamente a la hora configurada.
    Estructura NAS: Modalidad / Año / Mes / Día
    Motor Incremental: Solo comprime y mueve lo que falta.
    """
    print(f"📦 [BACKUP PACS] Iniciando ciclo automático de análisis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    
    try:
        # 1. Leer la configuración dinámica desde la Base de Datos
        config = db.query(PACSConfig).first()
        umbral_limite = config.umbral_purga if config else 80  
        dias_espera = getattr(config, 'dias_maduracion', 30) if config else 30
        
        # Detectar el disco donde opera el PACS
        ruta_disco = "D:\\" if os.path.exists("D:\\") else "."
        
        # Rutas físicas (pueden venir de la BD si lo adaptas después)
        NAS_LOCAL_DIR = r"D:\MI_PACS_NAS_EXTERNAL"
        CLOUD_OFFSITE_DIR = r"D:\MI_PACS_SECURE_REPLICA"
        
        # Importación manual externa si la ruta cambió
        from app.dicom_utils.dicom_importer import importar_desde_directorio_externo
        if os.path.exists(NAS_LOCAL_DIR) and "D:" not in NAS_LOCAL_DIR.upper():
            print(f"📁 [MODO IMPORTACIÓN] Detectada ruta externa activa para ingesta: {NAS_LOCAL_DIR}")
            importar_desde_directorio_externo(NAS_LOCAL_DIR)
        
        # 2. Definir ventana de maduración (TODO lo anterior a esta fecha límite)
        fecha_limite = datetime.now() - timedelta(days=dias_espera)
        
        # 3. Modalidades a escanear selectivamente
        modalidades = ["CT", "MR", "DX", "US", "MG", "CR", "DXA", "PET", "RF", "XA"]
        
        for mod in modalidades:
            # 🚀 LÓGICA DE CAPTURA TOTAL: Atrapa todo lo viejo que se haya quedado atrás
            estudios_a_respaldar = db.query(RISOrden).filter(
                RISOrden.modalidad == mod,
                RISOrden.fecha_creacion <= fecha_limite,
                RISOrden.estado_ris.in_(["Atendido", "Finalizado Sin Reporte"])
            ).all()
            
            if not estudios_a_respaldar:
                continue
                
            print(f"📂 [BACKUP] Validando {len(estudios_a_respaldar)} estudios maduros de la modalidad [{mod}]")
            
            for orden in estudios_a_respaldar:
                # --- A. CONSTRUCCIÓN DE RUTAS (AÑO / MES / DÍA) ---
                fecha_est = orden.fecha_creacion if orden.fecha_creacion else datetime.now()
                año = str(fecha_est.year)
                mes = f"{fecha_est.month:02d}"
                dia = f"{fecha_est.day:02d}"
                
                ruta_destino_nas = os.path.join(NAS_LOCAL_DIR, mod, año, mes, dia)
                os.makedirs(ruta_destino_nas, exist_ok=True)
                
                nombre_archivo_backup = f"PACIENTE_{orden.id_orden}_{orden.apellido}.tar.gz"
                ruta_final_tar = os.path.join(ruta_destino_nas, nombre_archivo_backup)
                ruta_replica_internacional = os.path.join(CLOUD_OFFSITE_DIR, nombre_archivo_backup)
                
                ruta_dicom_origen = os.path.join(str(DICOM_ARCHIVADOS_DIR), str(orden.accession_number))
                
                # --- B. MOTOR INCREMENTAL (Solo empaqueta si no existe) ---
                if not os.path.exists(ruta_final_tar):
                    print(f"⏳ Empaquetando nuevo estudio: {orden.accession_number}...")
                    with tarfile.open(ruta_final_tar, "w:gz") as tar:
                        # Dicom
                        if os.path.exists(ruta_dicom_origen):
                            tar.add(ruta_dicom_origen, arcname="IMAGENES_DICOM")
                        
                        # PDF
                        ruta_pdf_reporte = os.path.join(str(PDF_REPORTS_DIR), f"{orden.accession_number}.pdf")
                        if os.path.exists(ruta_pdf_reporte):
                            tar.add(ruta_pdf_reporte, arcname="REPORTE_FIRMADO.pdf")
                            
                        # Notas
                        nota_clinica_path = os.path.join(ruta_destino_nas, f"NOTAS_{orden.accession_number}.txt")
                        with open(nota_clinica_path, "w", encoding="utf-8") as f:
                            f.write(f"Paciente: {orden.nombre} {orden.apellido}\n")
                            f.write(f"Accession Number: {orden.accession_number}\n")
                            f.write(f"Modalidad: {mod} | Fecha Estudio: {año}-{mes}-{dia}\n")
                            f.write(f"Estado de Cierre: {orden.estado_ris}\n")
                            f.write(f"Fecha Respaldo: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                        
                        tar.add(nota_clinica_path, arcname="INFORMACION_ANEXA.txt")
                        os.remove(nota_clinica_path)

                    # Réplica fuera del país simultánea
                    os.makedirs(CLOUD_OFFSITE_DIR, exist_ok=True)
                    if not os.path.exists(ruta_replica_internacional):
                        shutil.copy2(ruta_final_tar, ruta_replica_internacional)
                        
                    print(f"✅ Backup Exitoso: {orden.accession_number} guardado en {mod}/{año}/{mes}/{dia}")
                
                # --- C. ALGORITMO DE PURGA SEGURA ---
                # Se evalúa individualmente. Si el disco se está llenando, borra el origen físico
                # SOLO si tiene la absoluta certeza de que el archivo .tar.gz ya existe a salvo.
                total_disk, used_disk, free_disk = shutil.disk_usage(ruta_disco)
                porcentaje_uso_actual = (used_disk / total_disk) * 100
                
                if porcentaje_uso_actual >= umbral_limite:  
                    if os.path.exists(ruta_final_tar) and os.path.exists(ruta_dicom_origen):
                        shutil.rmtree(ruta_dicom_origen)
                        with open(f"{ruta_dicom_origen}_PURGED.txt", "w") as f_log:
                            f_log.write(f"Estudio purgado localmente por límite de espacio ({porcentaje_uso_actual:.1f}%) el {datetime.now()}\n")
                        print(f"♻️ [PURGA] Espacio crítico. Eliminados archivos DICOM originales de {orden.accession_number}.")
                        
    except Exception as e:
        print(f"❌ Error crítico en la rutina de backup: {str(e)}")
    finally:
        db.close()


def inicializar_scheduler():
    """Inicia el planificador dinámico desde la DB."""
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
            
            scheduler.add_job(
                ejecutar_rutina_backup_diario, 
                'cron', 
                hour=hora, 
                minute=minuto,
                id='rutina_backup_pacs'
            )
            scheduler.start()
            print(f"⏰ [SCHEDULER] Motor activado dinámicamente: Ejecución diaria a las {config.hora_backup}.")
        except Exception as e:
            print(f"❌ Error al inicializar el scheduler con la DB: {e}")
            scheduler.add_job(ejecutar_rutina_backup_diario, 'cron', hour=1, minute=0, id='rutina_backup_pacs')
            scheduler.start()
        finally:
            db.close()

def reprogramar_cron_backup(nueva_hora_str: str):
    """Sincroniza la hora en memoria en tiempo real."""
    try:
        hora, minuto = map(int, nueva_hora_str.split(":"))
        if scheduler.get_job('rutina_backup_pacs'):
            scheduler.remove_job('rutina_backup_pacs')
            
        scheduler.add_job(
            ejecutar_rutina_backup_diario, 
            'cron', 
            hour=hora, 
            minute=minuto,
            id='rutina_backup_pacs'
        )
        print(f"🔄 [SCHEDULER REPROGRAMADO] Próximo ciclo cambiado con éxito a las: {nueva_hora_str}")
        return True
    except Exception as e:
        print(f"❌ Error al reprogramar el scheduler: {e}")
        return False