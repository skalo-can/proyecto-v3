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

# --- ENDPOINT CLÍNICO (ACTUALIZADO A WEASYPRINT Y PLANTILLA HTML) ---
@router.get("/estudio/{estudio_id}")
def generar_pdf_estudio(
    estudio_id: int, 
    usuario=Depends(obtener_usuario_actual), 
    db: Session=Depends(get_db)
):
    est = _get_estudio(estudio_id, db)
    paciente: Paciente = est.paciente

    # 1. Preparar las variables para la plantilla HTML (plantilla_reporte.html)
    nombre_completo = f"{getattr(paciente, 'primer_nombre', getattr(paciente, 'nombre', ''))} {getattr(paciente, 'primer_apellido', getattr(paciente, 'apellidos', ''))}".strip()
    
    nombre_medico = f"{getattr(usuario, 'primer_nombre', '')} {getattr(usuario, 'primer_apellido', '')}".strip()
    if not nombre_medico:
        nombre_medico = getattr(usuario, 'username', 'Usuario Autorizado')

    # Extraer el diagnóstico (ajusta 'texto_diagnostico' o 'hallazgos' si tu modelo en la BD se llama diferente)
    texto_diag = getattr(est, 'texto_diagnostico', getattr(est, 'hallazgos', 'Estudio radiológico sin hallazgos registrados.'))

    datos_estudio = {
        "nombre_paciente": nombre_completo,
        "id_paciente": getattr(paciente, 'documento', getattr(paciente, 'id', '')),
        "fecha_estudio": getattr(est, 'fecha_estudio', ''),
        "modalidad": getattr(est, 'modalidad', ''),
        "texto_diagnostico": texto_diag,
        "nombre_medico": nombre_medico,
        "registro_medico": getattr(usuario, 'registro_medico', getattr(usuario, 'licencia', '')),
    }

    # 2. Buscar e inyectar la ruta física de la firma del radiólogo 🔥
    firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario.id).first()
    if firma_db:
        ruta_firma_fisica = os.path.join(CARPETA_FIRMAS, firma_db.nombre_archivo)
        datos_estudio["ruta_firma"] = ruta_firma_fisica
    else:
        datos_estudio["ruta_firma"] = None

    # 3. Definir la ruta donde se guardará el PDF temporal o final
    pdf_path = PDF_REPORTS_DIR / f"estudio_{estudio_id}.pdf"
    os.makedirs(PDF_REPORTS_DIR, exist_ok=True)

    # 4. Compilar el PDF usando tu motor WeasyPrint y la plantilla clínica
    exito = construir_reporte_pdf(datos_estudio, str(pdf_path), "plantilla_reporte.html")

    if not exito:
        raise HTTPException(status_code=500, detail="Error al generar el reporte radiológico con WeasyPrint")

    return FileResponse(path=str(pdf_path), filename=pdf_path.name, media_type="application/pdf")


# --- ENDPOINT FACTURACIÓN (INTACTO Y PERFECTO) ---
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

        # 🔥 AQUÍ USA LA PLANTILLA DE FACTURA
        exito = construir_reporte_pdf(datos_factura, ruta_pdf_factura, "plantilla_factura.html")

        if not exito:
            raise HTTPException(status_code=500, detail="Error al compilar la factura con WeasyPrint")

        return FileResponse(path=ruta_pdf_factura, filename=nombre_archivo, media_type="application/pdf")
        
    except Exception as e:
        print(f"❌ Error al archivar factura: {e}")
        raise HTTPException(status_code=500, detail=str(e))