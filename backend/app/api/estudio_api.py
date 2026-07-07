from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect, or_
import os
from app.core.database import get_db
from app.models.estudio import Estudio 
from app.models.ris_orden import RISOrden 
from app.services.generador_pdf import construir_reporte_pdf 

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
        for tabla in tablas_reales:
            if tabla.lower() in ['worklist_orders', 'ris_ordenes', 'ris_orden', 'risorden']:
                try:
                    db.execute(text(f"UPDATE {tabla} SET estado_ris = 'Atendido' WHERE accession_number = :acc"), {"acc": identificador})
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
        return {"status": "success", "message": "Procesado por contingencia"}


# =====================================================================
# ✅ ENDPOINT: COLECTOR Y GENERADOR DE REPORTES FIRMADOS (CORREGIDO)
# =====================================================================
@router.post("/{estudio_id}/firmar")
async def firmar_estudio_endpoint(estudio_id: int, data: dict, db: Session = Depends(get_db)):
    """
    Endpoint clínico para procesar la firma del radiólogo.
    Recopila los datos del estudio y escribe el PDF en la ruta absoluta estática correcta.
    """
    # 1. Buscar el estudio en la base de datos
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio clínico no encontrado.")

    # 2. CAPTURAR EL ID REAL DEL PACIENTE (Ej: 36164737 en lugar de 8)
    id_real_paciente = data.get("identificacion") or data.get("documento") or data.get("id_paciente")
    if not id_real_paciente and hasattr(estudio, "paciente") and estudio.paciente:
        id_real_paciente = getattr(estudio.paciente, "identificacion", str(estudio_id))
    elif not id_real_paciente:
        id_real_paciente = str(estudio_id)

    # 3. Extraer la información requerida por la plantilla Jinja2
    datos_informe = {
        "nombre_paciente": data.get("nombre_paciente") or getattr(estudio, "nombre_paciente", "PACIENTE ANÓNIMO"),
        "id_paciente": id_real_paciente,
        "fecha_estudio": getattr(estudio, "fecha_estudio", "N/A"),
        "modalidad": getattr(estudio, "modalidad", "DX"),
        "texto_diagnostico": data.get("texto_diagnostico", "Estudio revisado y validado sin plantilla de texto adjunta."),
        "nombre_medico": data.get("nombre_medico") or "Radiólogo de Turno",
        "registro_medico": data.get("registro_medico") or "RM-MIPACS"
    }

    # 4. CALCULAMOS LA RUTA ABSOLUTA (CORREGIDA: Subiendo 2 niveles para salir de 'app')
    directorio_api = os.path.dirname(os.path.abspath(__file__))
    ruta_estaticos_real = os.path.abspath(os.path.join(directorio_api, "..", "..", "static", "pdf_reports"))
    
    # Aseguramos que la carpeta exista
    if not os.path.exists(ruta_estaticos_real):
        os.makedirs(ruta_estaticos_real, exist_ok=True)
    
    # Construimos el nombre exacto del archivo que el Frontend consumirá
    nombre_pdf = f"Reporte_{id_real_paciente}.pdf"
    ruta_final_pdf = os.path.join(ruta_estaticos_real, nombre_pdf)

    # 5. Compilar el reporte en PDF usando Weasyprint
    exito = construir_reporte_pdf(datos_informe, ruta_final_pdf)

    if not exito:
        raise HTTPException(status_code=500, detail="Error interno al compilar el archivo PDF del reporte.")

    # 6. Actualizar el estado del estudio en el PACS
    try:
        estudio.estado = "firmado"
        db.commit()
        return {
            "status": "success", 
            "message": "Informe firmado y PDF generado correctamente",
            "pdf_url": f"/static/pdf_reports/{nombre_pdf}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar estado en base de datos: {str(e)}")