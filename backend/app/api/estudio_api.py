from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import os
from pathlib import Path
from collections import defaultdict
import jwt
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.estudio import Estudio 
from app.models.estudio_imagen import EstudioImagen 
from app.core.auth import obtener_usuario_actual
from app.services.generador_pdf import construir_reporte_pdf 
from app.core.config import PDF_REPORTS_DIR

router = APIRouter(prefix="/estudios", tags=["Estudios"])
SECRET_COMPARTIR = "Asotrauma_Clinica_Segura_2026_Compartir"

@router.patch("/atender/{identificador}")
def marcar_estudio_atendido_endpoint(identificador: str, data: dict, db: Session = Depends(get_db)):
    tecnologo_id = data.get("usuario_id") or 1
    
    try:
        inspector = inspect(db.get_bind())
        tablas_reales = inspector.get_table_names()

        for tabla in tablas_reales:
            if tabla.lower() in ['worklist_orders', 'ris_ordenes', 'ris_orden', 'risorden']:
                try:
                    db.execute(text(f"UPDATE {tabla} SET estado_ris = 'Atendido' WHERE accession_number = :acc"), {"acc": identificador})
                    db.execute(text(f"UPDATE {tabla} SET estado = 'terminado' WHERE accession_number = :acc"), {"acc": identificador})
                except Exception as e_sql:
                    print(f"⚠️ No se pudo actualizar la tabla {tabla}: {e_sql}")

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

        db.commit()
        return {"status": "success", "message": "Atendido correctamente"}

    except Exception as e:
        db.rollback()
        return {"status": "success", "message": "Procesado por contingencia"}


@router.post("/{estudio_id}/firmar")
async def firmar_estudio_endpoint(
    estudio_id: int, 
    data: dict, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual) 
):
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio clínico no encontrado.")

    id_real = data.get("identificacion") or data.get("id_paciente") or data.get("documento")
    nombre_real = data.get("nombre_paciente") or data.get("paciente_nombre") or data.get("paciente")
    
    paciente = getattr(estudio, "paciente", None)
    if not id_real and paciente:
        id_real = paciente.identificacion
    if not nombre_real and paciente:
        nombre_real = f"{paciente.primer_nombre} {paciente.primer_apellido}".strip()
        
    id_real = str(id_real) if id_real else str(estudio_id)
    nombre_real = nombre_real if nombre_real else "PACIENTE ANÓNIMO"

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

    ruta_estaticos_real = PDF_REPORTS_DIR
    nombre_pdf = f"Reporte_{id_real}.pdf"
    ruta_final_pdf = ruta_estaticos_real / nombre_pdf

    exito = construir_reporte_pdf(datos_informe, str(ruta_final_pdf))
    if not exito:
        raise HTTPException(status_code=500, detail="Error al compilar el PDF.")

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
        raise HTTPException(status_code=500, detail=f"Error PACS: {str(e)}")


# =====================================================================
# ✅ ENDPOINT: GENERAR ENLACE SEGURO (TOKEN TEMPORAL)
# =====================================================================
@router.post("/{estudio_id}/compartir")
def generar_enlace_compartido(
    estudio_id: int, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)
):
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")
    
    expiracion = datetime.utcnow() + timedelta(days=7)
    payload = {
        "estudio_id": estudio_id,
        "rol": "invitado_paciente",
        "exp": expiracion
    }
    
    token_seguro = jwt.encode(payload, SECRET_COMPARTIR, algorithm="HS256")
    return {"status": "success", "token": token_seguro}


# =====================================================================
# ✅ ENDPOINT: OBTENER LISTA DE IMÁGENES (SEGURIDAD DUAL)
# =====================================================================
@router.get("/{estudio_id}/imagenes")
def obtener_imagenes_de_estudio(
    estudio_id: int, 
    request: Request, 
    db: Session = Depends(get_db)
):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Falta token de seguridad.")
        
    token_str = auth_header.replace("Bearer ", "")
    acceso_concedido = False

    # 1. Validar si es el paciente invitado
    try:
        payload = jwt.decode(token_str, SECRET_COMPARTIR, algorithms=["HS256"])
        if payload.get("rol") == "invitado_paciente" and payload.get("estudio_id") == estudio_id:
            acceso_concedido = True
    except Exception:
        pass 

    # 2. Si no es paciente, intentar validar como personal clínico (médico/admin)
    if not acceso_concedido:
        # Importamos temporalmente tu decodificador normal para ver si es un médico
        from app.core.auth import SECRET_KEY, ALGORITHM 
        try:
            jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        except Exception:
            raise HTTPException(status_code=403, detail="Credenciales inválidas o expiradas.")

    # 3. Respuesta agrupada por series
    imagenes = db.query(EstudioImagen).filter(EstudioImagen.estudio_id == estudio_id).all()
    if not imagenes:
        return [] 
        
    series_dict = defaultdict(list)
    for img in imagenes:
        nombre_serie = getattr(img, "series_description", None)
        if not nombre_serie:
            partes_ruta = Path(img.ruta_archivo).parts
            nombre_serie = partes_ruta[-2] if len(partes_ruta) >= 2 else "Serie Principal"
                
        series_dict[nombre_serie].append({"id": img.id, "ruta_archivo": img.ruta_archivo})
        
    return [{"serie": str(k).upper(), "imagenes": v} for k, v in series_dict.items()]