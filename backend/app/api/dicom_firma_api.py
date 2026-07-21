from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime
import os

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol
from app.models.estudio import Estudio
from app.models.paciente import Paciente
from app.services.generador_pdf import construir_reporte_pdf

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA (FANTASMA ELIMINADO)
from app.core.config import PDF_REPORTS_DIR

router = APIRouter(prefix="/estudios", tags=["Firma y PDF"])
STATIC_PDF_PATH = PDF_REPORTS_DIR

class DatosFirma(BaseModel):
    medico_firma: str = ""
    registro_medico: str = ""

@router.post("/{estudio_id}/firmar")
def firmar_reporte_endpoint(
    estudio_id: int,
    payload: DatosFirma = DatosFirma(), # 🚀 Evita errores si el frontend no lo envía
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    requiere_rol(usuario, ["medico"])
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    paciente = db.query(Paciente).filter(Paciente.id == estudio.paciente_id).first()
    texto_reporte = estudio.informe_final or getattr(estudio, 'reporte_texto', "")

    # 🚀 SI LLEGA VACÍO, FORZAMOS UN TEXTO PARA SABER QUÉ FALLA
    rm_final = payload.registro_medico or getattr(estudio, 'registro_medico', "")
    if not rm_final or rm_final.strip() == "":
        rm_final = "SIN REGISTRO MÉDICO (No llegó desde React)"

    datos_para_pdf = {
        "nombre_paciente": f"{paciente.primer_nombre} {paciente.primer_apellido}",
        "id_paciente": paciente.identificacion,
        "fecha_estudio": estudio.fecha_estudio.strftime("%Y-%m-%d") if estudio.fecha_estudio else "S/F",
        "modalidad": estudio.modalidad or "CR",
        "texto_diagnostico": texto_reporte,
        "nombre_medico": payload.medico_firma or f"{usuario.primer_nombre} {usuario.primer_apellido}",
        "registro_medico": rm_final 
    }

    nombre_archivo = f"Reporte_{paciente.identificacion}.pdf"
    ruta_fisica_salida = os.path.join(str(STATIC_PDF_PATH), nombre_archivo)

    construir_reporte_pdf(datos_para_pdf, ruta_fisica_salida)

    estudio.reporte_estado = "firmado"
    estudio.estado_pacs = "Firmado"
    estudio.firmado_por = usuario.id
    estudio.firmado_en = datetime.utcnow()
    estudio.reporte_pdf_path = f"/static/pdf_reports/{nombre_archivo}"

    db.commit()
    return {"status": "success", "pdf_path": estudio.reporte_pdf_path}

@router.get("/{estudio_id}/pdf")
def descargar_pdf_endpoint(estudio_id: int, usuario=Depends(obtener_usuario_actual), db: Session=Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    ruta_limpia = estudio.reporte_pdf_path.lstrip("/")
    return FileResponse(str(Path(ruta_limpia)), media_type="application/pdf")