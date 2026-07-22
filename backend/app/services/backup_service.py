# backend/app/services/backup_service.py
import os
import shutil
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.estudio import Estudio

def ejecutar_backup_incremental(db: Session, config: dict):
    """
    Motor físico de backup. 
    Estructura destino: NAS_RUTA / MODALIDAD / AÑO / MES / DIA / CARPETA_ESTUDIO
    """
    nas_ruta = config.get("nas_ruta")
    dias_maduracion = config.get("dias_maduracion", 30)
    modalidades = config.get("modalidades", [])

    if not nas_ruta or not os.path.exists(nas_ruta):
        raise FileNotFoundError(f"La ruta NAS destino no está disponible: {nas_ruta}")

    # Calcular la fecha límite de maduración
    fecha_limite = datetime.now() - timedelta(days=dias_maduracion)

    # Buscar estudios en la base de datos que ya estén maduros
    query = db.query(Estudio).filter(Estudio.fecha_estudio <= fecha_limite)
    
    if modalidades:
        # Filtra solo las modalidades seleccionadas en el frontend (CR, CT, MR...)
        query = query.filter(Estudio.tipo_estudio.in_(modalidades))

    estudios_a_respaldar = query.all()
    estudios_copiados = 0
    errores = 0

    for estudio in estudios_a_respaldar:
        # 1. Identificar la ruta de origen de los DICOM físicos
        ruta_origen = getattr(estudio, "ruta_archivos", getattr(estudio, "ruta_dicom", None))
        
        if not ruta_origen or not os.path.exists(ruta_origen):
            continue # Si no hay archivos físicos, pasamos al siguiente

        # 2. Desglosar fecha (ILM)
        fecha = estudio.fecha_estudio if estudio.fecha_estudio else datetime.now()
        año = str(fecha.year)
        mes = f"{fecha.month:02d}"
        dia = f"{fecha.day:02d}"

        # 3. Identificar Modalidad
        modalidad = getattr(estudio, "tipo_estudio", "OTRAS")
        if not modalidad: modalidad = "OTRAS"
        modalidad = modalidad.upper()

        # 4. Construir el directorio destino estructurado
        nombre_carpeta_estudio = f"PAC_{estudio.paciente_id}_EST_{estudio.id}"
        ruta_destino = os.path.join(nas_ruta, modalidad, año, mes, dia, nombre_carpeta_estudio)

        # 5. LÓGICA INCREMENTAL: Solo copiar si no existe en el destino
        if not os.path.exists(ruta_destino):
            try:
                # dirs_exist_ok=True permite fusionar si la carpeta se copió a medias previamente
                shutil.copytree(ruta_origen, ruta_destino, dirs_exist_ok=True)
                estudios_copiados += 1
            except Exception as e:
                print(f"❌ Error al respaldar el estudio {estudio.id}: {e}")
                errores += 1

    return {
        "estudios_procesados": len(estudios_a_respaldar),
        "nuevos_copiados": estudios_copiados,
        "errores": errores
    }