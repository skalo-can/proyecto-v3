"""
firma_api.py — MI_PACS
---------------------------------------------------------
Firma digital del reporte y generación de PDF clínico.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.models.estudio import Estudio
from app.models.paciente import Paciente


router = APIRouter(prefix="/estudios", tags=["Firma y PDF"])


# ---------------------------------------------------------
# RUTA BASE PARA PDF CLÍNICOS
# ---------------------------------------------------------
PDF_BASE_PATH = Path("reportes")
PDF_BASE_PATH.mkdir(exist_ok=True)


# ---------------------------------------------------------
# 1) FIRMAR REPORTE (solo médico)
# ---------------------------------------------------------
@router.post("/{estudio_id}/firmar")
def firmar_reporte_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    El médico firma digitalmente el reporte clínico.
    Cambia el estado a 'firmado' y registra fecha/hora.
    """

    requiere_rol(usuario, ["medico"])

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if not estudio.reporte_texto:
        raise HTTPException(status_code=400, detail="No hay reporte para firmar.")

    fecha_firma = datetime.utcnow()

    estudio.reporte_estado = "firmado"
    estudio.firmado_por = usuario.id
    estudio.firmado_en = fecha_firma

    db.commit()
    db.refresh(estudio)

    return {
        "message": "Reporte firmado correctamente.",
        "firmado_en": fecha_firma
    }


# ---------------------------------------------------------
# 2) GENERAR PDF DEL REPORTE (solo médico)
# ---------------------------------------------------------
@router.post("/{estudio_id}/generar_pdf")
def generar_pdf_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Genera un PDF clínico con:
    - Datos del paciente
    - Datos del estudio
    - Texto del reporte
    - Firma del médico
    """

    requiere_rol(usuario, ["medico"])

    estudio = (
        db.query(Estudio)
        .filter(Estudio.id == estudio_id)
        .first()
    )

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if not estudio.reporte_texto:
        raise HTTPException(status_code=400, detail="No hay reporte para generar PDF.")

    paciente = db.query(Paciente).filter(Paciente.id == estudio.paciente_id).first()

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")

    # Crear ruta del PDF
    pdf_path = PDF_BASE_PATH / f"reporte_estudio_{estudio_id}.pdf"

    # Crear PDF clínico
    c = canvas.Canvas(str(pdf_path), pagesize=letter)
    c.setFont("Helvetica", 12)

    y = 750
    c.drawString(50, y, "REPORTE RADIOLÓGICO")
    y -= 40

    c.drawString(50, y, f"Paciente: {paciente.primer_nombre} {paciente.primer_apellido}")
    y -= 20
    c.drawString(50, y, f"Identificación: {paciente.identificacion}")
    y -= 20
    c.drawString(50, y, f"Fecha de nacimiento: {paciente.fecha_nacimiento}")
    y -= 40

    c.drawString(50, y, "REPORTE:")
    y -= 20

    # Texto multilínea
    for linea in estudio.reporte_texto.split("\n"):
        c.drawString(50, y, linea)
        y -= 15

    y -= 30
    c.drawString(50, y, f"Firmado por (ID médico): {estudio.firmado_por}")
    y -= 20
    c.drawString(50, y, f"Fecha de firma: {estudio.firmado_en}")

    c.save()

    # Guardar ruta en BD
    estudio.reporte_pdf_path = str(pdf_path)
    db.commit()
    db.refresh(estudio)

    return {
        "message": "PDF generado correctamente.",
        "pdf_path": str(pdf_path)
    }


# ---------------------------------------------------------
# 3) DESCARGAR PDF (médico o paciente dueño del estudio)
# ---------------------------------------------------------
@router.get("/{estudio_id}/pdf")
def descargar_pdf_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Devuelve el PDF clínico generado.

    Permisos:
    - médico
    - paciente (solo si es su estudio)
    """

    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    # Validación de acceso
    if usuario.rol == "paciente" and usuario.id != estudio.paciente_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    if not estudio.reporte_pdf_path:
        raise HTTPException(status_code=404, detail="No hay PDF generado.")

    pdf_path = Path(estudio.reporte_pdf_path)

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="El archivo PDF no existe.")

    return FileResponse(str(pdf_path), media_type="application/pdf")