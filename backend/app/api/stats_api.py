import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

router = APIRouter(tags=["Estadísticas del sistema"])

def get_pacs_size_gb():
    """
    Calcula el tamaño real en disco de la carpeta de imágenes DICOM.
    IMPORTANTE: Cambia esta ruta a la carpeta donde tu servidor almacena los archivos reales.
    """
    # Usamos la ruta de tu proyecto o la ruta absoluta del almacenamiento DICOM
    ruta_pacs = r"D:\proyecto v3\storage\dicom" # Ajusta según tu configuración real
    total_size = 0
    
    try:
        if os.path.exists(ruta_pacs):
            for dirpath, dirnames, filenames in os.walk(ruta_pacs):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    # Solo sumamos si es un archivo real
                    if os.path.isfile(fp):
                        total_size += os.path.getsize(fp)
        
        # Conversión: Bytes -> KB -> MB -> GB
        size_gb = total_size / (1024**3)
        return round(size_gb, 2)
    except Exception as e:
        print(f"⚠️ Error calculando tamaño de disco: {e}")
        return 0.00

@router.get("/stats-dashboard")
def get_stats_dashboard(db: Session = Depends(get_db)):
    """
    Genera estadísticas reales basadas en el conteo de registros 
    y el peso físico de los archivos en el servidor.
    """
    try:
        # 1. CONTEOS DIRECTOS DE BASE DE DATOS (Auditoría real)
        p_count = db.query(Paciente).count()
        e_count = db.query(Estudio).count()
        i_count = db.query(EstudioImagen).count()

        # 2. CÁLCULO DE ALMACENAMIENTO FÍSICO
        espacio_gb = get_pacs_size_gb()
        
        # Porcentaje de uso basado en un NAS de 1TB (1000GB) como ejemplo
        capacidad_maxima_gb = 1000 
        uso_nas = round((espacio_gb / capacidad_maxima_gb) * 100, 2) if capacidad_maxima_gb > 0 else 0

        # 3. DISTRIBUCIÓN POR MODALIDADES (Solo las que existen)
        modalidades_query = db.query(
            Estudio.tipo_estudio, 
            func.count(Estudio.id).label("total")
        ).group_by(Estudio.tipo_estudio).all()

        modalidades_lista = [
            {"name": str(m.tipo_estudio).upper(), "value": m.total} 
            for m in modalidades_query if m.tipo_estudio
        ]

        # 4. CRECIMIENTO HISTÓRICO REAL
        # Agrupamos por fecha de estudio para mostrar la evolución real
        crecimiento_query = db.query(
            func.strftime("%Y-%m-%d", Estudio.fecha_estudio).label("fecha"),
            func.count(Estudio.id).label("cantidad")
        ).group_by("fecha").order_by("fecha").all()

        crecimiento_lista = [
            {"fecha": c.fecha, "cantidad": c.cantidad} 
            for c in crecimiento_query
        ]

        # 5. CONSTRUCCIÓN DE LA RESPUESTA (Sin datos falsos)
        return {
            "pacientesTotal": p_count,
            "estudiosTotal": e_count,
            "imagenesTotal": i_count,
            "almacenamientoGB": f"{espacio_gb:.2f}",
            "porcentajeNAS": uso_nas,
            "crecimiento": crecimiento_lista,
            "modalidades": modalidades_lista,
            "success": True
        }

    except Exception as e:
        print(f"❌ Error crítico en Estadísticas Reales: {e}")
        return {
            "pacientesTotal": 0,
            "estudiosTotal": 0,
            "imagenesTotal": 0,
            "almacenamientoGB": "0.00",
            "porcentajeNAS": 0,
            "crecimiento": [],
            "modalidades": [],
            "success": False
        }

# --- ENDPOINTS AUXILIARES ---

@router.get("/pacientes_por_mes")
def pacientes_por_mes(db: Session = Depends(get_db)):
    results = db.query(
        func.strftime("%Y-%m", Paciente.creado_en).label("mes"), 
        func.count(Paciente.id)
    ).group_by("mes").all()
    return [{"mes": r[0], "total": r[1]} for r in results]

@router.get("/tipos_estudio")
def tipos_estudio(db: Session = Depends(get_db)):
    results = db.query(
        Estudio.tipo_estudio, 
        func.count(Estudio.id)
    ).group_by(Estudio.tipo_estudio).all()
    return [{"tipo": r[0], "total": r[1]} for r in results]