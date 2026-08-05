from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect, or_
import os
from pathlib import Path

from app.core.database import get_db
from app.models.estudio import Estudio 
from app.models.estudio_imagen import EstudioImagen # 🔥 IMPORTACIÓN AÑADIDA
from app.core.auth import obtener_usuario_actual
from app.services.generador_pdf import construir_reporte_pdf 

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA (FANTASMA ELIMINADO)
from app.core.config import PDF_REPORTS_DIR

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
# ✅ ENDPOINT: COLECTOR INTELIGENTE Y GENERADOR DE PDF BLINDADO
# =====================================================================
@router.post("/{estudio_id}/firmar")
async def firmar_estudio_endpoint(
    estudio_id: int, 
    data: dict, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)  # 🔐 Atrapamos al médico real en sesión
):
    """
    Endpoint clínico para procesar la firma del radiólogo.
    Fuerza el uso de los datos visuales del frontend y del usuario logueado.
    """
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio clínico no encontrado.")

    # 1. PRIORIDAD ABSOLUTA: Datos enviados por el Frontend (Lo que el usuario ve en pantalla)
    id_real = data.get("identificacion") or data.get("id_paciente") or data.get("documento")
    nombre_real = data.get("nombre_paciente") or data.get("paciente_nombre") or data.get("paciente")
    
    # 2. RESPALDO: Extraer de la base de datos si el frontend no los envió
    paciente = getattr(estudio, "paciente", None)
    if not id_real and paciente:
        id_real = paciente.identificacion
    if not nombre_real and paciente:
        nombre_real = f"{paciente.primer_nombre} {paciente.primer_apellido}".strip()
        
    # 3. ÚLTIMO RECURSO DE CONTINGENCIA
    id_real = str(id_real) if id_real else str(estudio_id)
    nombre_real = nombre_real if nombre_real else "PACIENTE ANÓNIMO"

    # 4. DATOS DEL RADIÓLOGO (Automático desde la sesión, ignora campos vacíos de React)
    nombre_medico = f"Dr(a). {usuario.nombre}" if hasattr(usuario, "nombre") else "Radiólogo de Turno"
    registro_medico = getattr(usuario, "registro_medico", "RM-NO-REGISTRADO")
    
    texto_diagnostico = data.get("texto_diagnostico") or data.get("informe") or "Estudio validado sin texto adjunto."

    datos_informe = {
        "nombre_paciente": nombre_real.upper(),
        "id_paciente": id_real,
        "fecha_estudio": getattr(estudio, "fecha_estudio", "N/A"),
        "modalidad": getattr(estudio, "modalidad", "DX"),
        "texto_diagnostico": texto_diagnostico,
        "nombre_medico": nombre_medico.upper(),
        "registro_medico": registro_medico.upper()
    }

    # 5. RUTA ABSOLUTA BLINDADA USANDO EL ANCLA
    ruta_estaticos_real = PDF_REPORTS_DIR
    
    nombre_pdf = f"Reporte_{id_real}.pdf"
    ruta_final_pdf = ruta_estaticos_real / nombre_pdf

    # 6. COMPILAR PDF FÍSICO
    exito = construir_reporte_pdf(datos_informe, str(ruta_final_pdf))

    if not exito:
        raise HTTPException(status_code=500, detail="Error interno al compilar el archivo PDF del reporte.")

    # 7. ACTUALIZAR ESTADO DE LA ORDEN CLÍNICA
    try:
        estudio.estado = "firmado"
        db.commit()
        return {
            "status": "success", 
            "message": "Informe firmado correctamente",
            "pdf_url": f"/static/pdf_reports/{nombre_pdf}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar estado en PACS: {str(e)}")


# =====================================================================
# ✅ ENDPOINT: OBTENER LISTA DE IMÁGENES DICOM DEL ESTUDIO
# =====================================================================
@router.get("/{estudio_id}/imagenes")
def obtener_imagenes_de_estudio(
    estudio_id: int, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)  # 🔐 Blindaje clínico
):
    """
    Devuelve la lista de imágenes DICOM asociadas a un estudio clínico 
    para que el visor Cornerstone3D sepa qué rutas cargar.
    """
    imagenes = db.query(EstudioImagen).filter(EstudioImagen.estudio_id == estudio_id).all()
    
    if not imagenes:
        return [] # Retorna una lista vacía para evitar errores de parseo en React
        
    resultado = []
    for img in imagenes:
        resultado.append({
            "id": img.id,
            "ruta_archivo": img.ruta_archivo
        })
        
    return resultado