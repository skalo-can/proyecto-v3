from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud.filtros.pacientes_filtros_crud import filtrar_pacientes


router = APIRouter(prefix="/filtros", tags=["Filtros – Pacientes"])


# Dependencia DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
#   FILTROS DE PACIENTES
# ==========================================================
@router.get("/pacientes")
def obtener_pacientes_filtrados(
    db: Session = Depends(get_db),
    id: int | None = Query(None),
    nombre: str | None = Query(None),
    apellido: str | None = Query(None),
    documento: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return filtrar_pacientes(
        db=db,
        id=id,
        nombre=nombre,
        apellido=apellido,
        documento=documento,
        page=page,
        page_size=page_size,
    )