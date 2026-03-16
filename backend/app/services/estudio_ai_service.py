"""
estudio_ai_service.py
----------------------
Servicio de integración con modelos de IA clínica para MI_PACS.

Responsabilidades:
- Cargar las imágenes DICOM asociadas a un estudio
- Construir un volumen o stack en memoria (NumPy)
- Seleccionar el modelo IA adecuado según el tipo de estudio
- Ejecutar inferencia IA (local o remota)
- Normalizar la salida al formato estándar MI_PACS

Este servicio NO realiza diagnóstico. Solo actúa como ayuda visual
bajo supervisión del médico.
"""

import os
import numpy as np
import pydicom

from sqlalchemy.orm import Session

from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen

# Router IA que selecciona el modelo adecuado
from app.ia.ia_router import seleccionar_modelo


# ---------------------------------------------------------
# CARGA DEL STACK DICOM
# ---------------------------------------------------------
def _cargar_stack_dicom(estudio_id: int, db: Session) -> np.ndarray:
    """
    Carga todas las imágenes DICOM de un estudio y construye
    un stack 3D (Z, Y, X) en NumPy.

    Este stack es la entrada estándar para los modelos de IA.
    """

    # Filtrar imágenes cuyo archivo termina en .dcm
    imagenes = (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == estudio_id)
        .all()
    )

    dicoms = [img for img in imagenes if img.ruta_archivo.lower().endswith(".dcm")]

    if not dicoms:
        raise ValueError("El estudio no tiene imágenes DICOM para análisis IA.")

    slices = []

    for img in dicoms:
        ruta = img.ruta_archivo  # Ej: static/dicoms/xxxx.dcm

        if not os.path.exists(ruta):
            raise FileNotFoundError(f"Archivo DICOM no encontrado: {ruta}")

        ds = pydicom.dcmread(ruta)
        pixel_array = ds.pixel_array.astype("float32")
        slices.append(pixel_array)

    volumen = np.stack(slices, axis=0)  # (Z, Y, X)
    return volumen


# ---------------------------------------------------------
# ANÁLISIS IA PRINCIPAL
# ---------------------------------------------------------
def analizar_estudio_con_ia(db: Session, estudio_id: int) -> dict:
    """
    Ejecuta el flujo completo de análisis IA para un estudio:

    - Carga stack DICOM (Z, Y, X)
    - Selecciona el modelo IA adecuado según el tipo de estudio
    - Ejecuta inferencia IA
    - Devuelve hallazgos y segmentación en formato estándar MI_PACS
    """

    estudio = (
        db.query(Estudio)
        .filter(Estudio.id == estudio_id)
        .first()
    )

    if not estudio:
        raise ValueError("Estudio no encontrado para análisis IA.")

    # Cargar volumen DICOM
    volumen = _cargar_stack_dicom(estudio_id, db)

    # Seleccionar modelo IA según tipo de estudio
    tipo_estudio = estudio.tipo or ""
    modelo_ia = seleccionar_modelo(tipo_estudio)

    # Ejecutar inferencia IA
    resultado_modelo = modelo_ia(volumen)

    # Normalizar salida para MI_PACS
    resultado = {
        "estudio_id": estudio_id,
        "modelo": resultado_modelo.get("modelo", "modelo_ia_desconocido"),
        "hallazgos": resultado_modelo.get("hallazgos", []),
        "segmentacion": resultado_modelo.get("segmentacion"),
    }

    return resultado


# ---------------------------------------------------------
# ALIAS PARA COMPATIBILIDAD CON EL API
# ---------------------------------------------------------
ejecutar_analisis_ia = analizar_estudio_con_ia