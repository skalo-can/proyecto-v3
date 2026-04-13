from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

router = APIRouter(tags=["Estadísticas del sistema"])

@router.get("/stats-dashboard")
def get_stats_dashboard(db: Session = Depends(get_db)):
    """
    Endpoint diseñado específicamente para los estados de DashboardStats.jsx
    """
    try:
        p_count = db.query(Paciente).count()
        e_count = db.query(Estudio).count()
        i_count = db.query(EstudioImagen).count()

        # 1. Calculamos las modalidades reales de la base de datos
        modalidades_query = db.query(
            Estudio.tipo_estudio, 
            func.count(Estudio.id)
        ).group_by(Estudio.tipo_estudio).all()

        modalidades_lista = [
            {"name": m[0] if m[0] else "OTRO", "value": m[1]} 
            for m in modalidades_query
        ]

        # Si no hay datos, enviamos una lista vacía para que el .map() no falle
        if not modalidades_lista:
            modalidades_lista = [{"name": "SIN DATOS", "value": 0}]

        # 2. Crecimiento (puedes dejarlo vacío [] o con un dato de inicio)
        crecimiento_lista = [
            {"fecha": "2026-01", "cantidad": p_count}
        ]

        # 3. Estructura EXACTA que pide tu componente React
        data_final = {
            "pacientesTotal": p_count,
            "estudiosTotal": e_count if e_count > 0 else 1, # Evita división por cero en el Front
            "imagenesTotal": i_count,
            "almacenamientoGB": "150.45", # Dato simulado por ahora
            "porcentajeNAS": 12,          # Dato simulado por ahora
            "crecimiento": crecimiento_lista,
            "modalidades": modalidades_lista
        }

        return data_final

    except Exception as e:
        print(f"❌ Error en stats-dashboard: {e}")
        return {
            "pacientesTotal": 0,
            "estudiosTotal": 1,
            "imagenesTotal": 0,
            "almacenamientoGB": "0.00",
            "porcentajeNAS": 0,
            "crecimiento": [],
            "modalidades": []
        }

# --- ENDPOINTS ADICIONALES (Mantenidos por seguridad) ---

@router.get("/pacientes_por_mes")
def pacientes_por_mes(db: Session = Depends(get_db)):
    results = db.query(func.strftime("%Y-%m", Paciente.creado_en).label("mes"), func.count(Paciente.id)).group_by("mes").all()
    return [{"mes": r[0], "total": r[1]} for r in results]