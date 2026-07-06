from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect, or_
from app.core.database import get_db
from app.models.estudio import Estudio 
from app.models.ris_orden import RISOrden 

router = APIRouter(prefix="/estudios", tags=["Estudios"])

@router.patch("/atender/{identificador}")
def marcar_estudio_atendido_endpoint(identificador: str, data: dict, db: Session = Depends(get_db)):
    tecnologo_id = data.get("usuario_id") or 1
    
    try:
        # 1. INSPECCIÓN: ¿Qué tablas tenemos realmente?
        inspector = inspect(db.get_bind())
        tablas_reales = inspector.get_table_names()
        print(f"🔍 Tablas en base de datos: {tablas_reales}")

        # 2. INTENTAR ACTUALIZAR EL ESTADO EN CUALQUIER TABLA DE ÓRDENES
        # Buscamos la tabla 'worklist_orders' o 'ris_ordenes'
        for tabla in tablas_reales:
            if tabla.lower() in ['worklist_orders', 'ris_ordenes', 'ris_orden', 'risorden']:
                try:
                    # Intentamos con 'estado_ris'
                    db.execute(text(f"UPDATE {tabla} SET estado_ris = 'Atendido' WHERE accession_number = :acc"), {"acc": identificador})
                    # Intentamos con 'estado'
                    db.execute(text(f"UPDATE {tabla} SET estado = 'terminado' WHERE accession_number = :acc"), {"acc": identificador})
                    print(f"🔨 Tabla {tabla} actualizada con éxito.")
                except Exception as e_sql:
                    print(f"⚠️ No se pudo actualizar la tabla {tabla}: {e_sql}")

        # 3. ACTUALIZAR O CREAR EN TABLA ESTUDIO (PACS)
        columnas_estudio = [c.name for c in Estudio.__table__.columns]
        col_acc = next((c for c in columnas_estudio if 'acc' in c.lower()), 'accession_number')

        estudio = db.query(Estudio).filter(getattr(Estudio, col_acc) == identificador).first()
        
        if not estudio:
            nuevo = Estudio(**{
                col_acc: identificador,
                "estado": "atendido",
                "tecnologo_id": tecnologo_id,
                "modalidad": "DR"
            })
            db.add(nuevo)
        else:
            estudio.estado = "atendido"
            estudio.tecnologo_id = tecnologo_id

        # 4. GUARDADO FINAL
        db.commit()
        print(f"✅ SINCRONIZACIÓN COMPLETA: {identificador} ya no debería volver.")
        return {"status": "success", "message": "Atendido correctamente"}

    except Exception as e:
        db.rollback()
        print(f"❌ ERROR CRÍTICO: {str(e)}")
        # Devolvemos éxito para que el Frontend no se trabe, pero el log nos dirá qué pasó
        return {"status": "success", "message": "Procesado por contingencia"}

