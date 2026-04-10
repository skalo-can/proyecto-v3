from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

# Importaciones de tu estructura core
from app.core.database import SessionLocal 
from app.schemas.ris_orden import RISOrdenCreate, RISOrdenResponse
from app.crud.ris_orden import crear_orden_ris
from app.models.ris_orden import RISOrden

router = APIRouter()

# Dependencia para obtener la sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- CREATE ---
@router.post("/order", response_model=RISOrdenResponse)
def post_nueva_orden(orden: RISOrdenCreate, db: Session = Depends(get_db)):
    """Registra una nueva orden en el RIS (Estado inicial: En Espera)"""
    try:
        nueva_orden = crear_orden_ris(db=db, orden=orden)
        return nueva_orden
    except Exception as e:
        print(f"Error detallado: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar la orden")

# --- READ ---
@router.get("/worklist", response_model=List[RISOrdenResponse])
def get_worklist(db: Session = Depends(get_db)):
    """Obtiene la lista de pacientes que no han terminado su proceso."""
    return db.query(RISOrden).filter(RISOrden.estado_ris != "Finalizado").all()

# --- UPDATE (MODIFICAR DATOS) ---
@router.put("/order/{order_id}", response_model=RISOrdenResponse)
def modificar_orden(order_id: int, updated_data: RISOrdenCreate, db: Session = Depends(get_db)):
    """Actualiza datos demográficos o del estudio de una orden."""
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    for key, value in updated_data.model_dump().items():
        setattr(db_order, key, value)
    
    db.commit()
    db.refresh(db_order)
    return db_order

# --- UPDATE (INICIAR FLUJO DICOM) - ESTO ES LO QUE NECESITA LA AGFA ---
@router.put("/order/start/{order_id}")
def iniciar_orden(order_id: int, db: Session = Depends(get_db)):
    """
    Cambia el estado a 'Iniciado'. 
    A partir de este momento, el servidor DICOM Worklist la expondrá a la AGFA NX.
    """
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    db_order.estado_ris = "Iniciado"
    db.commit()
    return {"status": "success", "message": f"Orden {db_order.accession_number} lista en Worklist"}

# --- DELETE ---
@router.delete("/order/{order_id}")
def eliminar_orden(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Solo permitimos eliminar si aún no se ha iniciado el proceso en el equipo
    if db_order.estado_ris == "Iniciado":
        raise HTTPException(status_code=400, detail="No se puede eliminar una orden que ya fue enviada al equipo")

    db.delete(db_order)
    db.commit()
    return {"message": "Orden eliminada correctamente"}