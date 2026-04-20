from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

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
    """Registra una nueva orden en el RIS"""
    try:
        nueva_orden = crear_orden_ris(db=db, orden=orden)
        # Opcional: Si quieres que nazca ya como 'Iniciado' descomenta la línea de abajo
        # nueva_orden.estado_ris = "Iniciado"
        # db.commit()
        return nueva_orden
    except Exception as e:
        print(f"Error detallado: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar la orden")

# --- READ (MEJORADO PARA RECEPCIÓN Y TECNÓLOGO) ---
@router.get("/worklist", response_model=List[RISOrdenResponse])
def get_worklist(all_active: Optional[bool] = False, db: Session = Depends(get_db)):
    """
    Si all_active es True (Recepcion), muestra Iniciados y Pendientes.
    Si es False (Tecnólogo), solo muestra Iniciados.
    """
    if all_active:
        # La secretaria ve lo que está en espera y lo que ya se inició
        return db.query(RISOrden).filter(
            RISOrden.estado_ris.in_(["Iniciado", "En Espera", "Pendiente"])
        ).all()
    else:
        # El tecnólogo SOLO ve lo que debe atender (esto evita que 'resuciten')
        return db.query(RISOrden).filter(RISOrden.estado_ris == "Iniciado").all()

# --- UPDATE (MODIFICAR DATOS) ---
@router.put("/order/{order_id}", response_model=RISOrdenResponse)
def modificar_orden(order_id: int, updated_data: RISOrdenCreate, db: Session = Depends(get_db)):
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    for key, value in updated_data.model_dump().items():
        setattr(db_order, key, value)
    db.commit()
    db.refresh(db_order)
    return db_order

# --- UPDATE (INICIAR FLUJO DICOM) ---
@router.put("/order/start/{order_id}")
def iniciar_orden(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    db_order.estado_ris = "Iniciado"
    db.commit()
    return {"status": "success", "message": f"Orden {db_order.accession_number} enviada al Worklist"}

# --- UPDATE (ATENDER / LIMPIAR WORKLIST) ---
@router.put("/order/atender/{order_id}")
def atender_orden(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    db_order.estado_ris = "Atendido"
    db.commit()
    return {"status": "success", "message": f"Paciente {db_order.apellido} marcado como atendido"}

# --- DELETE ---
@router.delete("/order/{order_id}")
def eliminar_orden(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if db_order.estado_ris == "Iniciado":
        raise HTTPException(status_code=400, detail="No se puede eliminar una orden activa")
    db.delete(db_order)
    db.commit()
    return {"message": "Orden eliminada correctamente"}