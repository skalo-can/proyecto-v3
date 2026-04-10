from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

# Importaciones de tu estructura core
from app.core.database import SessionLocal 
from app.schemas.ris_orden import RISOrdenCreate, RISOrdenResponse
from app.crud.ris_orden import crear_orden_ris

router = APIRouter()

# Dependencia para obtener la sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/order", response_model=RISOrdenResponse)
def post_nueva_orden(orden: RISOrdenCreate, db: Session = Depends(get_db)):
    """
    Registra una nueva orden en el RIS.
    """
    try:
        # Aquí ejecutamos la lógica que guarda en database.db
        nueva_orden = crear_orden_ris(db=db, orden=orden)
        return nueva_orden
    except Exception as e:
        print(f"Error detallado: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar la orden")

@router.get("/worklist", response_model=List[RISOrdenResponse])
def get_worklist(db: Session = Depends(get_db)):
    """
    Obtiene la lista de pacientes activos.
    """
    from app.models.ris_orden import RISOrden
    return db.query(RISOrden).filter(RISOrden.estado_ris != "Finalizado").all()

from fastapi import APIRouter, Depends, HTTPException, status
# ... tus otros imports ...

@router.delete("/order/{order_id}")
def eliminar_orden(order_id: int, db: Session = Depends(get_db)):
    from app.models.ris_orden import RISOrden
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Solo permitimos eliminar si el estado es 'En Espera'
    if db_order.estado_ris != "En Espera":
        raise HTTPException(status_code=400, detail="No se puede eliminar una orden en proceso")

    db.delete(db_order)
    db.commit()
    return {"message": "Orden eliminada correctamente"}

@router.put("/order/{order_id}")
def modificar_orden(order_id: int, updated_data: RISOrdenCreate, db: Session = Depends(get_db)):
    from app.models.ris_orden import RISOrden
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Actualizar los campos permitidos
    for key, value in updated_data.model_dump().items():
        setattr(db_order, key, value)
    
    db.commit()
    db.refresh(db_order)
    return db_order