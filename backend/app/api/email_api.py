from typing import Optional
import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.paciente import Paciente
from app.services.email_service import procesar_envio_email

router = APIRouter(prefix="/email", tags=["Envío de Correos Automatizados"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
class EmailPayload(BaseModel):
    email: str
    enlace_visor: Optional[str] = None  # 🔥 Ahora FastAPI sabe que es 100% legal recibir esto

@router.post("/enviar-estudio/{estudio_id}")
def enviar_estudio_pdf(
    estudio_id: int, 
    payload: EmailPayload, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # 1. Buscar el estudio
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    # 2. Buscar al paciente
    paciente = db.query(Paciente).filter(Paciente.id == estudio.paciente_id).first()
    cedula_real = paciente.identificacion if paciente and paciente.identificacion else str(estudio.paciente_id)

    # 3. Determinar la fecha para buscar en las carpetas (Año/Mes/Día)
    # Usamos la fecha del estudio, o la fecha actual si no tiene
    fecha_ref = estudio.fecha_estudio if estudio.fecha_estudio else datetime.now()
    año = str(fecha_ref.year)
    mes = f"{fecha_ref.month:02d}"
    dia = f"{fecha_ref.day:02d}"

    # 4. Construir la ruta base exacta según tu arquitectura
    # Apunta a: backend/static/pdf_reports/Año/Mes/Dia/
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    directorio_pdfs = os.path.join(base_dir, "static", "pdf_reports", año, mes, dia)

    # 5. Formatos de nombre posibles (basados en tu imagen 27)
    nombre_formato_1 = f"Reporte_{cedula_real}_est_{estudio_id}.pdf"  # Ej: Reporte_14243232_est_21.pdf
    nombre_formato_2 = f"Reporte_{cedula_real}.pdf"                   # Ej: Reporte_9728484.pdf

    ruta_pdf_1 = os.path.join(directorio_pdfs, nombre_formato_1)
    ruta_pdf_2 = os.path.join(directorio_pdfs, nombre_formato_2)

    # Revisamos cuál de los dos existe físicamente
    ruta_exacta_pdf = None
    if os.path.exists(ruta_pdf_1):
        ruta_exacta_pdf = ruta_pdf_1
    elif os.path.exists(ruta_pdf_2):
        ruta_exacta_pdf = ruta_pdf_2

    if not ruta_exacta_pdf:
        raise HTTPException(
            status_code=404, 
            detail=f"No se encontró el PDF físicamente en: {directorio_pdfs}. Nombres buscados: {nombre_formato_1} o {nombre_formato_2}"
        )

    # 6. Despachamos el correo
    background_tasks.add_task(
        procesar_envio_email, 
        paciente_id=str(cedula_real), 
        correo_destino=payload.email, 
        ruta_exacta_pdf=ruta_exacta_pdf,
        enlace_visor=payload.enlace_visor  # 🔥 ESTA ES LA MAGIA QUE FALTABA
    )

    return {"status": "success", "detail": "El correo se está enviando en segundo plano."}