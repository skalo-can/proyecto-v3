import os
import shutil
import tarfile
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.models.ris_orden import RISOrden
from app.models.estudio import Estudio
from app.models.pacs_config import PACSConfig  # Importamos tu modelo dinámico

# Inicializamos el planificador global de fondo
scheduler = BackgroundScheduler()

def ejecutar_rutina_backup_diario():
    """
    Rutina maestra ejecutada automáticamente a la hora configurada.
    Filtra estudios por antigüedad, modalidad y estados de entrega válidos.
    Aplica purga local automática basada en el umbral de la base de datos.
    """
    print(f"📦 [BACKUP PACS] Iniciando ciclo automático de análisis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    
    try:
        # 1. Leer la configuración dinámica desde la Base de Datos
        config = db.query(PACSConfig).first()
        umbral_limite = config.umbral_purga if config else 80  # Fallback a 80% si no existe
        
        # Detectar el disco donde opera el PACS para medir hardware (D: o raíz si es local)
        ruta_disco = "D:\\" if os.path.exists("D:\\") else "."
        
        # 2. Definir ventana de maduración (por defecto 30 días atrás)
        dias_espera = 30 
        fecha_objetivo = (datetime.now() - timedelta(days=dias_espera)).date()
        
        # 3. Definir rutas físicas
        NAS_LOCAL_DIR = r"D:\MI_PACS_NAS_EXTERNAL"
        CLOUD_OFFSITE_DIR = r"D:\MI_PACS_SECURE_REPLICA"
        
        # 🚀 CORREGIDO: Se cambia RX por DX e incorporamos CR, DXA y PET al bucle de escaneo masivo
        modalidades = ["CT", "MR", "DX", "US", "MG", "CR", "DXA", "PET"]
        
        for mod in modalidades:
            estudios_a_respaldar = db.query(RISOrden).filter(
                RISOrden.modalidad == mod,
                RISOrden.fecha_registro >= datetime.combine(fecha_objetivo, datetime.min.time()),
                RISOrden.fecha_registro <= datetime.combine(fecha_objetivo, datetime.max.time()),
                RISOrden.estado_ris.in_(["Atendido", "Finalizado Sin Reporte"])
            ).all()
            
            if not estudios_a_respaldar:
                continue
                
            print(f"📂 [BACKUP] Procesando {len(estudios_a_respaldar)} estudios de la modalidad [{mod}]")
            
            # Crear directorio estructurado en el NAS por Modalidad/Año/Mes
            ruta_destino_nas = os.path.join(
                NAS_LOCAL_DIR, 
                mod, 
                str(fecha_objetivo.year), 
                f"{fecha_objetivo.month:02d}"
            )
            os.makedirs(ruta_destino_nas, exist_ok=True)
            
            for orden in estudios_a_respaldar:
                nombre_archivo_backup = f"PACIENTE_{orden.id_orden}_{orden.apellido}.tar.gz"
                ruta_final_tar = os.path.join(ruta_destino_nas, nombre_archivo_backup)
                ruta_dicom_origen = f"D:\\proyecto v3\\backend\\app\\dicom_archivados\\{orden.accession_number}"
                ruta_replica_internacional = os.path.join(CLOUD_OFFSITE_DIR, nombre_archivo_backup)
                
                # --- PROCESO DE EMPAQUETADO COMPLETO ---
                with tarfile.open(ruta_final_tar, "w:gz") as tar:
                    if os.path.exists(ruta_dicom_origen):
                        tar.add(ruta_dicom_origen, arcname="IMAGENES_DICOM")
                    
                    ruta_pdf_reporte = f"D:\\proyecto v3\\backend\\static\\reports\\{orden.accession_number}.pdf"
                    if os.path.exists(ruta_pdf_reporte):
                        tar.add(ruta_pdf_reporte, arcname="REPORTE_FIRMADO.pdf")
                        
                    nota_clinica_path = os.path.join(ruta_destino_nas, f"NOTAS_{orden.accession_number}.txt")
                    with open(nota_clinica_path, "w", encoding="utf-8") as f:
                        f.write(f"Paciente: {orden.nombre} {orden.apellido}\n")
                        f.write(f"Accession Number: {orden.accession_number}\n")
                        f.write(f"Estado de Cierre: {orden.estado_ris}\n")
                        f.write(f"Fecha Respaldo: {datetime.now().strftime('%Y-%m-%d')}\n")
                    
                    tar.add(nota_clinica_path, arcname="INFORMACION_ANEXA.txt")
                    os.remove(nota_clinica_path)
                
                # --- PASO C: RÉPLICA FUERA DEL PAÍS ---
                os.makedirs(CLOUD_OFFSITE_DIR, exist_ok=True)
                shutil.copy2(ruta_final_tar, ruta_replica_internacional)
                
                print(f"✅ Estudio {orden.accession_number} respaldado con éxito en NAS y Réplica Internacional.")
                
                # ==============================================================================
                # 🚀 ALGORITMO DE PURGA SEGURA CON CONFIGURACIÓN DINÁMICA
                # ==============================================================================
                total_disk, used_disk, free_disk = shutil.disk_usage(ruta_disco)
                porcentaje_uso_actual = (used_disk / total_disk) * 100
                
                # Usamos el umbral traído dinámicamente de la Base de Datos
                if porcentaje_uso_actual >= umbral_limite:  
                    print(f"⚠️ [PURGA] Ocupación en {porcentaje_uso_actual:.2f}% superó el umbral configurado de {umbral_limite}%.")
                    
                    existe_en_nas = os.path.exists(ruta_final_tar)
                    existe_en_replica = os.path.exists(ruta_replica_internacional)
                    
                    if existe_en_nas and existe_en_replica:
                        if os.path.exists(ruta_dicom_origen):
                            shutil.rmtree(ruta_dicom_origen)
                            
                            with open(f"{ruta_dicom_origen}_PURGED.txt", "w") as f_log:
                                f_log.write(f"Estudio purgado localmente por espacio el {datetime.now()}\n")
                                f_log.write(f"Ubicación NAS: {ruta_final_tar}\n")
                                
                            print(f"♻️ [PURGA EXITOSA] Archivos pesados de {orden.accession_number} eliminados de caché local.")
                    else:
                        print(f"🛑 [ALERTA] No se purgó {orden.accession_number} porque falló la doble verificación de copias.")
                else:
                    print(f"🟢 [PURGA] Almacenamiento en {porcentaje_uso_actual:.2f}%. Está por debajo del {umbral_limite}%, sin purga.")
                    
    except Exception as e:
        print(f"❌ Error crítico en la rutina de backup: {str(e)}")
    finally:
        db.close()


def inicializar_scheduler():
    """
    Inicia el planificador leyendo la hora configurada en la base de datos de manera dinámica.
    """
    if not scheduler.running:
        db = SessionLocal()
        try:
            config = db.query(PACSConfig).first()
            if not config:
                config = PACSConfig(hora_backup="01:00", umbral_purga=80)
                db.add(config)
                db.commit()
                db.refresh(config)
            
            # Separar "01:00" -> hora=1, minuto=0
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
            # Fallback seguro si falla la base de datos por alguna razón
            scheduler.add_job(ejecutar_rutina_backup_diario, 'cron', hour=1, minute=0, id='rutina_backup_pacs')
            scheduler.start()
        finally:
            db.close()

def reprogramar_cron_backup(nueva_hora_str: str):
    """
    Elimina la tarea vieja y programa la nueva hora en tiempo real en la memoria del hilo de ejecución.
    """
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