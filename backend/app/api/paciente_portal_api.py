"""
paciente_portal_api.py — MI_PACS
---------------------------------------------------------
Portal del paciente: acceso seguro a sus estudios clínicos.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.paciente import Paciente


router = APIRouter(prefix="/portal", tags=["Portal Paciente"])


# ---------------------------------------------------------
# 1) LISTAR ESTUDIOS DEL PACIENTE
# ---------------------------------------------------------
@router.get("/estudios")
def obtener_estudios_endpoint(
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Devuelve la lista de estudios clínicos del paciente autenticado.
    """

    if usuario.rol != "paciente":
        raise HTTPException(status_code=403, detail="Acceso permitido solo a pacientes.")

    estudios = (
        db.query(Estudio)
        .filter(Estudio.paciente_id == usuario.id)
        .order_by(Estudio.fecha.desc())
        .all()
    )

    return estudios


# ---------------------------------------------------------
# 2) DESCARGAR PDF CLÍNICO DEL PACIENTE
# ---------------------------------------------------------
@router.get("/estudios/{estudio_id}/pdf")
def descargar_pdf_paciente_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Devuelve el PDF clínico generado para el estudio.
    """

    if usuario.rol != "paciente":
        raise HTTPException(status_code=403, detail="Acceso permitido solo a pacientes.")

    estudio = (
        db.query(Estudio)
        .filter(Estudio.id == estudio_id, Estudio.paciente_id == usuario.id)
        .first()
    )

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if not estudio.reporte_pdf_path:
        raise HTTPException(status_code=404, detail="PDF no disponible.")

    pdf_path = estudio.reporte_pdf_path

    return FileResponse(pdf_path, media_type="application/pdf")


import pydicom
from pathlib import Path

# ---------------------------------------------------------
# 3) OBTENER IMÁGENES DEL ESTUDIO (AGRUPADAS POR SERIE)
# ---------------------------------------------------------
@router.get("/estudios/{estudio_id}/imagenes")
def obtener_imagenes_paciente_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db)
):
    """
    Devuelve la lista de imágenes del estudio agrupadas por serie para el visor DICOM.
    """

    if usuario.rol != "paciente":
        raise HTTPException(status_code=403, detail="Acceso permitido solo a pacientes.")

    estudio = (
        db.query(Estudio)
        .filter(Estudio.id == estudio_id, Estudio.paciente_id == usuario.id)
        .first()
    )

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    imagenes_bd = (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == estudio_id)
        .order_by(EstudioImagen.id.asc())
        .all()
    )

    if not imagenes_bd:
        return []

    # 🚀 MAGIA PACS: Agrupación física por cabeceras DICOM reales
    series_dict = {}

    for img in imagenes_bd:
        ruta = Path(img.ruta_archivo)
        nombre_serie = "Serie Única"

        if ruta.exists():
            try:
                ds = pydicom.dcmread(str(ruta), stop_before_pixels=True, force=True)
                desc = str(getattr(ds, "SeriesDescription", "Sin Descripción")).strip()
                uid = str(getattr(ds, "SeriesInstanceUID", "Default")).strip()
                nombre_serie = f"{desc} [{uid[-4:]}]"
            except Exception:
                pass

        if nombre_serie not in series_dict:
            series_dict[nombre_serie] = []

        # Estructura que el VisorDICOMWrapper.jsx reconoce y procesa perfectamente
        series_dict[nombre_serie].append({"id": img.id})

    # Formato exacto requerido por el frontend: [ { "serie": "...", "imagenes": [...] } ]
    resultado_agrupado = [
        {
            "serie": nombre,
            "imagenes": lista_imgs
        }
        for nombre, lista_imgs in series_dict.items()
    ]

    return resultado_agrupado