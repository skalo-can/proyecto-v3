from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

router = APIRouter(
    prefix="/stats",
    tags=["Estadísticas del sistema"]
)

# ---------------------------------------------------------
# 1. Total de pacientes
# ---------------------------------------------------------
@router.get("/pacientes")
def total_pacientes(db: Session = Depends(get_db)):
    total = db.query(Paciente).count()
    return {"total": total}

# ---------------------------------------------------------
# 2. Total de estudios
# ---------------------------------------------------------
@router.get("/estudios")
def total_estudios(db: Session = Depends(get_db)):
    total = db.query(Estudio).count()
    return {"total": total}

# ---------------------------------------------------------
# 3. Total de imágenes
# ---------------------------------------------------------
@router.get("/imagenes")
def total_imagenes(db: Session = Depends(get_db)):
    total = db.query(EstudioImagen).count()
    return {"total": total}

# ---------------------------------------------------------
# 4. Pacientes nuevos por mes (SQLite compatible)
# ---------------------------------------------------------
@router.get("/pacientes_por_mes")
def pacientes_por_mes(db: Session = Depends(get_db)):
    results = (
        db.query(
            func.strftime("%Y-%m", Paciente.creado_en).label("mes"),
            func.count(Paciente.id).label("total")
        )
        .group_by(func.strftime("%Y-%m", Paciente.creado_en))
        .order_by(func.strftime("%Y-%m", Paciente.creado_en))
        .all()
    )

    return [{"mes": r.mes, "total": r.total} for r in results]

# ---------------------------------------------------------
# 5. Distribución por tipo de estudio (CORREGIDO)
# ---------------------------------------------------------
@router.get("/tipos_estudio")
def tipos_estudio(db: Session = Depends(get_db)):
    results = (
        db.query(Estudio.tipo_estudio, func.count(Estudio.id))
        .group_by(Estudio.tipo_estudio)
        .all()
    )

    return [{"tipo": tipo, "total": total} for tipo, total in results]

# ---------------------------------------------------------
# 6. Actividad semanal del PACS (SQLite compatible)
# ---------------------------------------------------------
@router.get("/actividad_semanal")
def actividad_semanal(db: Session = Depends(get_db)):
    results = (
        db.query(
            func.strftime("%w", Estudio.fecha_estudio).label("dia_num"),
            func.strftime("%w", Estudio.fecha_estudio).label("dia_num"),
            func.count(Estudio.id).label("total")
        )
        .group_by(func.strftime("%w", Estudio.fecha_estudio))
        .order_by(func.strftime("%w", Estudio.fecha_estudio))
        .all()
    )

    dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

    return [
        {"dia": dias[int(r.dia_num)], "total": r.total}
        for r in results
    ]

# ---------------------------------------------------------
# 7. Estudios por mes (SQLite compatible)
# ---------------------------------------------------------
@router.get("/estudios_por_mes")
def estudios_por_mes(db: Session = Depends(get_db)):
    results = (
        db.query(
            func.strftime("%Y-%m", Estudio.fecha_estudio).label("mes"),
            func.count(Estudio.id).label("total")
        )
        .group_by(func.strftime("%Y-%m", Estudio.fecha_estudio))
        .order_by(func.strftime("%Y-%m", Estudio.fecha_estudio))
        .all()
    )

    return [{"mes": r.mes, "total": r.total} for r in results]

# ---------------------------------------------------------
# 8. Imágenes por mes (SQLite compatible)
# ---------------------------------------------------------
@router.get("/imagenes_por_mes")
def imagenes_por_mes(db: Session = Depends(get_db)):
    results = (
        db.query(
            func.strftime("%Y-%m", EstudioImagen.creado_en).label("mes"),
            func.count(EstudioImagen.id).label("total")
        )
        .group_by(func.strftime("%Y-%m", EstudioImagen.creado_en))
        .order_by(func.strftime("%Y-%m", EstudioImagen.creado_en))
        .all()
    )

    return [{"mes": r.mes, "total": r.total} for r in results]

# ---------------------------------------------------------
# 9. Modalidades por mes (SQLite compatible)
# ---------------------------------------------------------
@router.get("/modalidades_por_mes")
def modalidades_por_mes(db: Session = Depends(get_db)):
    results = (
        db.query(
            func.strftime("%Y-%m", Estudio.fecha_estudio).label("mes"),
            Estudio.tipo_estudio,
            func.count(Estudio.id).label("total")
        )
        .group_by(
            func.strftime("%Y-%m", Estudio.fecha_estudio),
            Estudio.tipo_estudio
        )
        .order_by(
            func.strftime("%Y-%m", Estudio.fecha_estudio),
            Estudio.tipo_estudio
        )
        .all()
    )

    return [
        {
            "mes": r.mes,
            "modalidad": r.tipo_estudio,
            "total": r.total
        }
        for r in results
    ]