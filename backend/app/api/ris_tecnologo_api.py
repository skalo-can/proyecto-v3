from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.models.estudio import Estudio
from pydantic import BaseModel

router = APIRouter()

class AtencionSchema(BaseModel):
    usuario_id: int

@router.patch("/atender/{estudio_id}")
async def atender_paciente(estudio_id: int, data: AtencionSchema, db: Session = Depends(get_db)):
    # 1. Buscamos el estudio en la tabla de resultados (PACS)
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    try:
        # 2. Marcamos como terminado en la tabla Estudio
        estudio.estado = "terminado"
        estudio.usuario_id = data.usuario_id 
        
        # 3. 🔥 EL CLAVO FINAL: Borramos o actualizamos en la tabla de la lista (Worklist)
        # Esto evita que el refresco de cada 5 segundos lo vuelva a traer
        if hasattr(estudio, 'accession_number') or hasattr(estudio, 'acc_number'):
            acc = getattr(estudio, 'accession_number', None) or getattr(estudio, 'acc_number', None)
            if acc:
                db.execute(
                    text("UPDATE worklist_orders SET estado_ris = 'Atendido' WHERE accession_number = :acc"),
                    {"acc": acc}
                )

        db.commit()
        print(f"✅ Paciente {estudio_id} finalizado y eliminado de la lista técnica.")
        return {"status": "success"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al atender: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usuarios/tecnologos")
async def obtener_tecnologos(db: Session = Depends(get_db)):
    from app.models.usuario import Usuario
    return db.query(Usuario).filter(Usuario.rol == "tecnologo").all()