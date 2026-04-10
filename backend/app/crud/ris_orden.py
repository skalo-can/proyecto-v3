from sqlalchemy.orm import Session
from app.models.ris_orden import RISOrden
from app.schemas.ris_orden import RISOrdenCreate
import time

def crear_orden_ris(db: Session, orden: RISOrdenCreate):
    # Generar Accession Number único basado en tiempo
    acc_number = f"ACC-{int(time.time())}"
    
    db_orden = RISOrden(
        **orden.model_dump(),
        accession_number=acc_number
    )
    db.add(db_orden)
    db.commit()
    db.refresh(db_orden)
    return db_orden