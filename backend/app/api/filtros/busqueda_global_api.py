from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud.filtros.busqueda_global_crud import busqueda_global


router = APIRouter(prefix="/filtros", tags=["Filtros – Búsqueda Global"])


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
#   BÚSQUEDA GLOBAL
# ==========================================================
@router.get("/busqueda-global")
def buscar(
    db: Session = Depends(get_db),
    texto: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    offset = (page - 1) * page_size
    limit = page_size

    return busqueda_global(
        db=db,
        texto=texto,
        limit=limit,
        offset=offset,
    ) 