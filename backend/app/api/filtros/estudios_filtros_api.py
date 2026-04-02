from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud.filtros.estudios_filtros_crud import filtrar_estudios


router = APIRouter(prefix="/filtros", tags=["Filtros – Estudios"])


# ==========================================================
#   DEPENDENCIA DB
# ==========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
#   FILTROS DE ESTUDIOS
# ==========================================================
@router.get("/estudios")
def obtener_estudios_filtrados(
    db: Session = Depends(get_db),
    id: int | None = Query(None),
    paciente_id: int | None = Query(None),
    tipo: str | None = Query(None),
    fecha: str | None = Query(None),
    sort: str = Query("id"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    offset = (page - 1) * page_size
    limit = page_size

    return filtrar_estudios(
        db=db,
        id=id,
        paciente_id=paciente_id,
        tipo=tipo,
        fecha=fecha,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )