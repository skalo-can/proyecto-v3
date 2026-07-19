from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict
import pydantic

# Importaciones de tu core y servicios
from app.core.database import SessionLocal
from app.services.scheduler_service import ejecutar_rutina_backup_diario

# 🚀 CORREGIDO: Eliminamos el prefijo duplicado para que ensamble directo con el main.py
router = APIRouter()

# Esquema para recibir las configuraciones del Frontend
class BackupConfigSchema(pydantic.BaseModel):
    dias_maduracion: int
    modalidades: List[str]  # 🟢 Recibe dinámicamente ["CT", "MR", "DX", "CR", etc.]
    nas_ruta: str
    copia_internacional: bool

# Dependencia de base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 1. GET /api/backup/status — Ver info en tu Dashboard / Panel de Control
@router.get("/backup/status")
def obtener_estado_backup(db: Session = Depends(get_db)):
    """
    Devuelve el estado del sistema de copias de seguridad 
    para pintarlo en las tarjetas del Frontend.
    """
    try:
        # Mapeo inicial simulado adaptado a las nuevas modalidades core del PACS
        return {
            "status": "activo",
            "proxima_ejecucion": "Dinámica",
            "dias_espera_actual": 30,
            "modalidades_activas": ["CT", "MR", "DX", "US", "MG", "CR", "DXA", "PET"],
            "nas_conectado": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer estado: {str(e)}")

# 2. POST /api/backup/config — Guardar lo que elijas en pantalla
@router.post("/backup/config")
def guardar_configuracion_backup(config: BackupConfigSchema, db: Session = Depends(get_db)):
    """
    Recibe los checkboxes de modalidades (incluyendo DX, CR, DXA, PET) y días 
    seleccionados en el frontend y los procesa en el sistema.
    """
    try:
        # 📝 REGISTRO EN CONSOLA: Monitoreo técnico del cambio de reglas
        print(f"⚙️ [CICLO DE VIDA] Aplicando regla: {config.dias_maduracion} días para modalidades: {config.modalidades}")
        print(f"📁 [RUTA DESTINO NAS]: {config.nas_ruta} | Réplica Geográfica: {config.copia_internacional}")
        
        # Aquí mapearás estos valores a tu persistencia global de almacenamiento si lo requieres
        return {"status": "success", "message": "Configuración de ciclo de vida guardada correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar regla: {str(e)}")

# 3. POST /api/backup/run — ¡EL BOTÓN MANUAL DE PRUEBA!
@router.post("/backup/run")
def disparar_backup_manual(background_tasks: BackgroundTasks):
    """
    Ejecuta la rutina de la madrugada de forma inmediata en un hilo de fondo
    para que la interfaz del usuario no se quede congelada esperando.
    """
    try:
        # Usamos background_tasks de FastAPI para que corra asíncrono
        background_tasks.add_task(ejecutar_rutina_backup_diario)
        return {
            "status": "success", 
            "message": "Rutina selectiva de backup iniciada con éxito en segundo plano."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo iniciar el proceso: {str(e)}")
    
    from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import shutil

# Asegúrate de importar tus modelos y la dependencia de base de datos
from app.core.database import get_db
from app.models.estudio import Estudio
from app.models.estudio_ia_log import EstudioIALog # Si tienes logs asociados

# Asumiendo que tu router ya está definido arriba así:
# router = APIRouter()

@router.delete("/purgar-importados")
def purgar_estudios_importados(dias_retencion: int = 30, db: Session = Depends(get_db)):
    """
    Elimina físicamente y de la BD los estudios importados de otras clínicas 
    que superen los días de retención permitidos para referencia.
    """
    try:
        fecha_limite = datetime.now() - timedelta(days=dias_retencion)
        
        # BUSCAR ESTUDIOS IMPORTADOS VIEJOS
        # Ajusta "origen" al nombre real de la columna que uses para saber si es importado (ej: es_importado == True)
        estudios_a_purgar = db.query(Estudio).filter(
            Estudio.origen == 'IMPORTADO',
            Estudio.fecha_estudio < fecha_limite
        ).all()

        if not estudios_a_purgar:
            return {"mensaje": "No hay estudios importados caducados para purgar.", "cantidad_purgada": 0}

        cantidad_borrada = 0

        for estudio in estudios_a_purgar:
            # 1. BORRADO FÍSICO (Archivos DICOM pesados)
            if estudio.ruta_archivos and os.path.exists(estudio.ruta_archivos):
                try:
                    shutil.rmtree(estudio.ruta_archivos) # Borra la carpeta completa del estudio
                except Exception as e:
                    print(f"Error borrando carpeta física {estudio.ruta_archivos}: {e}")
            
            # 2. BORRADO EN BASE DE DATOS
            db.delete(estudio)
            cantidad_borrada += 1

        db.commit()

        # Opcional: Escribir en la tabla de Auditoría aquí
        
        return {
            "mensaje": f"Se han purgado {cantidad_borrada} estudios importados exitosamente.",
            "cantidad_purgada": cantidad_borrada
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error ejecutando la purga: {str(e)}")