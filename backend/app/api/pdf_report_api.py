import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime
from typing import Dict 

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import obtener_usuario_actual

from app.models.estudio import Estudio
from app.models.paciente import Paciente
from app.models.firma import FirmaRadiologo

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from app.core.config import PDF_REPORTS_DIR
from app.services.generador_pdf import construir_reporte_pdf

router = APIRouter(tags=["Reportes PDF"], prefix="/pdf")

CARPETA_FIRMAS = "backend/storage/firmas_seguras"

def _get_estudio(estudio_id: int, db: Session) -> Estudio:
    est = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not est:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    _ = est.paciente
    return est

# --- ENDPOINT CLÍNICO (INTACTO) ---
@router.get("/estudio/{estudio_id}")
def generar_pdf_estudio(
    estudio_id: int, 
    usuario=Depends(obtener_usuario_actual), 
    db: Session=Depends(get_db)
):
    est = _get_estudio(estudio_id, db)
    paciente: Paciente = est.paciente

    pdf_path = PDF_REPORTS_DIR / f"estudio_{estudio_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "Reporte de Estudio")

    c.setFont("Helvetica", 12)
    y = height - 100
    
    nombre_completo = f"{getattr(paciente, 'primer_nombre', getattr(paciente, 'nombre', ''))} {getattr(paciente, 'primer_apellido', getattr(paciente, 'apellidos', ''))}".strip()
    
    c.drawString(50, y, f"Paciente: {nombre_completo}")
    y -= 20
    c.drawString(50, y, f"ID Paciente: {paciente.id}")
    y -= 20
    c.drawString(50, y, f"Estudio ID: {est.id}")
    y -= 20
    c.drawString(50, y, f"Modalidad: {getattr(est, 'modalidad', '')}")
    y -= 20
    c.drawString(50, y, f"Fecha: {getattr(est, 'fecha_estudio', '')}")
    y -= 40
    c.drawString(50, y, f"Generado en: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    y -= 100 
    firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario.id).first()
    
    if firma_db:
        ruta_firma = os.path.join(CARPETA_FIRMAS, firma_db.nombre_archivo)
        if os.path.exists(ruta_firma):
            try:
                c.drawImage(ruta_firma, 50, y, width=150, height=50, preserveAspectRatio=True, mask='auto')
            except Exception as e:
                print(f"Advertencia: No se pudo incrustar la imagen de la firma. Error: {e}")

    c.setLineWidth(1)
    c.line(50, y - 5, 250, y - 5)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y - 20, "Firma Autorizada")
    c.setFont("Helvetica", 10)
    nombre_medico = f"{getattr(usuario, 'primer_nombre', '')} {getattr(usuario, 'primer_apellido', '')}".strip()
    if not nombre_medico:
        nombre_medico = getattr(usuario, 'username', 'Usuario Autorizado')
    c.drawString(50, y - 35, nombre_medico)

    c.showPage()
    c.save()

    return FileResponse(path=str(pdf_path), filename=pdf_path.name, media_type="application/pdf")

# --- ENDPOINT FACTURACIÓN (NUEVO) ---
@router.post("/facturacion/archivar")
def archivar_cuenta_cobro(
    datos_factura: Dict,
    usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    try:
        BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
        CARPETA_FACTURAS = BASE_DIR / "facturas_archivadas"
        os.makedirs(CARPETA_FACTURAS, exist_ok=True)

        fecha_actual = datetime.now()
        nombre_archivo = f"Cuenta_Cobro_{fecha_actual.strftime('%Y_%m_%d_%H%M%S')}.pdf"
        ruta_pdf_factura = str(CARPETA_FACTURAS / nombre_archivo)

        firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario.id).first()
        if firma_db:
            ruta_firma_fisica = os.path.join(CARPETA_FIRMAS, firma_db.nombre_archivo)
            datos_factura["ruta_firma"] = ruta_firma_fisica
        else:
            datos_factura["ruta_firma"] = None

        # 🔥 AQUÍ LE DECIMOS QUE USE LA PLANTILLA DE FACTURA
        exito = construir_reporte_pdf(datos_factura, ruta_pdf_factura, "plantilla_factura.html")

        if not exito:
            raise HTTPException(status_code=500, detail="Error al compilar la factura con WeasyPrint")

        return FileResponse(path=ruta_pdf_factura, filename=nombre_archivo, media_type="application/pdf")
        
    except Exception as e:
        print(f"❌ Error al archivar factura: {e}")
        raise HTTPException(status_code=500, detail=str(e))