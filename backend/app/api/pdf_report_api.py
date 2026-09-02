import os
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel

# 🛡️ IMPORTACIÓN PARA RATE LIMITING (DOS Protection)
from slowapi import Limiter
from slowapi.util import get_remote_address

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import obtener_usuario_actual

from app.models.estudio import Estudio
from app.models.paciente import Paciente
from app.models.firma import FirmaRadiologo

from app.core.config import PDF_REPORTS_DIR
from app.services.generador_pdf import construir_reporte_pdf

# 🛡️ Configuración del Limitador (Ej: Máximo 10 peticiones por minuto por IP para evitar DoS)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Reportes PDF"], prefix="/pdf")

CARPETA_FIRMAS = "backend/storage/firmas_seguras"

class DatosFacturaSchema(BaseModel):
    nombre_medico: str
    monto_total: float
    descripcion_servicios: str

def _get_estudio_seguro(estudio_id: int, db: Session, usuario_actual) -> Estudio:
    est = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not est:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    
    if hasattr(est, 'medico_id') and est.medico_id != usuario_actual.id:
        raise HTTPException(status_code=403, detail="No tienes autorización para ver los resultados de este paciente.")
    
    return est


# --- ENDPOINT CLÍNICO BLINDADO CONTRA DOS ---
@router.get("/estudio/{estudio_id}")
@limiter.limit("10/minute")  # 🛡️ Límite estricto: Máximo 10 PDFs de estudios por minuto por usuario/IP
def generar_pdf_estudio(
    request: Request, # ⚠️ Obligatorio incluir 'request' para que slowapi lea la IP
    estudio_id: int, 
    lang: str = "es", # 🔥 Parámetro de idioma inyectado desde el frontend
    usuario=Depends(obtener_usuario_actual), 
    db: Session=Depends(get_db)
):
    est = _get_estudio_seguro(estudio_id, db, usuario)
    paciente: Paciente = est.paciente

    nombre_completo = f"{getattr(paciente, 'primer_nombre', getattr(paciente, 'nombre', ''))} {getattr(paciente, 'primer_apellido', getattr(paciente, 'apellidos', ''))}".strip()
    
    nombre_medico = f"{getattr(usuario, 'primer_nombre', '')} {getattr(usuario, 'primer_apellido', '')}".strip()
    if not nombre_medico:
        nombre_medico = getattr(usuario, 'username', 'Usuario Autorizado')

    import re
    texto_diag_bruto = getattr(est, 'texto_diagnostico', getattr(est, 'hallazgos', 'Estudio radiológico sin hallazgos registrados.'))
    texto_diag_limpio = re.sub(r'<script.*?>.*?</script>', '', texto_diag_bruto, flags=re.IGNORECASE)
    texto_diag_limpio = re.sub(r'<iframe.*?>.*?</iframe>', '', texto_diag_limpio, flags=re.IGNORECASE)

    datos_estudio = {
        "nombre_paciente": nombre_completo,
        "id_paciente": getattr(paciente, 'documento', getattr(paciente, 'id', '')),
        "fecha_estudio": getattr(est, 'fecha_estudio', ''),
        "modalidad": getattr(est, 'modalidad', ''),
        "texto_diagnostico": texto_diag_limpio,
        "nombre_medico": nombre_medico,
        "registro_medico": getattr(usuario, 'registro_medico', getattr(usuario, 'licencia', '')),
        "lang": lang # 🔥 Pasamos el idioma para que la plantilla HTML se adapte si lo requiere
    }

    firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario.id).first()
    if firma_db:
        ruta_firma_fisica = os.path.join(CARPETA_FIRMAS, firma_db.nombre_archivo)
        datos_estudio["ruta_firma"] = ruta_firma_fisica
    else:
        datos_estudio["ruta_firma"] = None

    pdf_path = PDF_REPORTS_DIR / f"estudio_{estudio_id}_{lang}.pdf" # 🔥 Sufijo opcional para separar PDFs por idioma
    os.makedirs(PDF_REPORTS_DIR, exist_ok=True)

    exito = construir_reporte_pdf(datos_estudio, str(pdf_path), "plantilla_reporte.html")

    if not exito:
        raise HTTPException(status_code=500, detail="Error al generar el reporte radiológico con WeasyPrint")

    return FileResponse(path=str(pdf_path), filename=pdf_path.name, media_type="application/pdf")


# --- ENDPOINT FACTURACIÓN BLINDADO CONTRA DOS ---
@router.post("/facturacion/archivar")
@limiter.limit("5/minute")  # 🛡️ Límite estricto: Máximo 5 facturas por minuto para evitar abusos
def archivar_cuenta_cobro(
    request: Request, # ⚠️ Obligatorio incluir 'request'
    datos_factura: DatosFacturaSchema,
    lang: str = "es", # 🔥 Parámetro opcional de idioma
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
        datos_limpios = datos_factura.dict()
        datos_limpios["lang"] = lang # 🔥 Inyectamos el idioma al diccionario de la factura

        if firma_db:
            ruta_firma_fisica = os.path.join(CARPETA_FIRMAS, firma_db.nombre_archivo)
            datos_limpios["ruta_firma"] = ruta_firma_fisica
        else:
            datos_limpios["ruta_firma"] = None

        exito = construir_reporte_pdf(datos_limpios, ruta_pdf_factura, "plantilla_factura.html")

        if not exito:
            raise HTTPException(status_code=500, detail="Error al compilar la factura con WeasyPrint")

        return FileResponse(path=ruta_pdf_factura, filename=nombre_archivo, media_type="application/pdf")
        
    except Exception as e:
        print(f"❌ Error al archivar factura: {e}")
        raise HTTPException(status_code=500, detail=str(e))