from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime

from app.core.database import SessionLocal
from app.models.estudio import Estudio
from app.models.paciente import Paciente

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


router = APIRouter(tags=["Reportes PDF"], prefix="/pdf")

BASE_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BASE_DIR / "static"
PDF_DIR = STATIC_DIR / "pdf_reports"
PDF_DIR.mkdir(parents=True, exist_ok=True)


def _get_estudio(estudio_id: int) -> Estudio:
    db = SessionLocal()
    try:
        est = db.query(Estudio).filter(Estudio.id == estudio_id).first()
        if not est:
            raise HTTPException(status_code=404, detail="Estudio no encontrado")
        _ = est.paciente  # fuerza carga
        return est
    finally:
        db.close()


@router.get("/estudio/{estudio_id}")
def generar_pdf_estudio(estudio_id: int):
    est = _get_estudio(estudio_id)
    paciente: Paciente = est.paciente

    pdf_path = PDF_DIR / f"estudio_{estudio_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "Reporte de Estudio")

    c.setFont("Helvetica", 12)
    y = height - 100
    c.drawString(50, y, f"Paciente: {paciente.nombre} {paciente.apellidos if hasattr(paciente, 'apellidos') else ''}")
    y -= 20
    c.drawString(50, y, f"ID Paciente: {paciente.id}")
    y -= 20
    c.drawString(50, y, f"Estudio ID: {est.id}")
    y -= 20
    c.drawString(50, y, f"Modalidad: {est.modalidad if hasattr(est, 'modalidad') else ''}")
    y -= 20
    c.drawString(50, y, f"Fecha: {est.fecha_estudio if hasattr(est, 'fecha_estudio') else ''}")
    y -= 40
    c.drawString(50, y, f"Generado en: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    c.showPage()
    c.save()

    return FileResponse(
        path=pdf_path,
        filename=pdf_path.name,
        media_type="application/pdf",
    )