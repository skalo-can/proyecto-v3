"""
mi_modelo_abdomen.py
--------------------

Módulo de integración con un modelo de IA para análisis de abdomen
(TC/RM abdominal).

Responsabilidades:
- Cargar el modelo IA (PyTorch / ONNX / TensorFlow).
- Preprocesar el volumen DICOM (Z, Y, X).
- Ejecutar inferencia sin bloquear el servidor.
- Postprocesar hallazgos y segmentación.
- Devolver resultados en formato estándar MI_PACS.

Este módulo actúa como capa de inferencia independiente.
"""

from typing import Dict, Any
import numpy as np

# TODO: importar PyTorch u ONNX si se usa un modelo real
# import torch

_modelo = None  # cache global


# ---------------------------------------------------------
# CARGA DEL MODELO
# ---------------------------------------------------------

def _cargar_modelo():
    """
    Carga el modelo IA de abdomen solo una vez.

    NOTA:
    - Cuando tengas el modelo real, reemplaza esta función.
    """
    global _modelo

    if _modelo is None:
        # TODO: reemplazar por la ruta real del modelo
        _modelo = "modelo_abdomen_demo"
        print("Modelo IA de abdomen cargado (demo).")

    return _modelo


# ---------------------------------------------------------
# PREPROCESAMIENTO
# ---------------------------------------------------------

def _preprocesar_volumen(volumen: np.ndarray) -> np.ndarray:
    """
    Normaliza el volumen DICOM para inferencia IA.
    """
    if volumen is None or volumen.size == 0:
        raise ValueError("El volumen recibido está vacío o es inválido.")

    v = volumen.astype("float32")

    minimo = np.min(v)
    maximo = np.max(v)
    rango = maximo - minimo

    if rango < 1e-5:
        v = np.zeros_like(v)
    else:
        v = (v - minimo) / (rango + 1e-5)

    return v


# ---------------------------------------------------------
# POSTPROCESAMIENTO
# ---------------------------------------------------------

def _postprocesar_salida(volumen: np.ndarray) -> Dict[str, Any]:
    """
    Convierte la salida IA al formato estándar MI_PACS.
    """
    Z, Y, X = volumen.shape
    z = Z // 2

    # Bounding box de ejemplo
    bbox = [X // 5, Y // 5, 4 * X // 5, 4 * Y // 5]

    # Máscara de ejemplo
    mask = _generar_mascara_demo(Y, X)

    return {
        "modelo": "mi_modelo_abdomen_demo_v1",
        "hallazgos": [
            {
                "tipo": "lesion_abdominal",
                "probabilidad": 0.67,
                "slice_index": int(z),
                "bounding_box": bbox,
            }
        ],
        "segmentacion": {
            "slice_index": int(z),
            "color": [0, 255, 0],  # verde
            "mask": mask,
        },
    }


# ---------------------------------------------------------
# INFERENCIA PRINCIPAL
# ---------------------------------------------------------

def inferir_volumen_abdomen(volumen: np.ndarray) -> Dict[str, Any]:
    """
    Ejecuta inferencia IA sobre un estudio abdominal.
    """
    _cargar_modelo()
    v = _preprocesar_volumen(volumen)
    return _postprocesar_salida(v)


# ---------------------------------------------------------
# MÁSCARA DEMO
# ---------------------------------------------------------

def _generar_mascara_demo(height: int, width: int) -> list[list[int]]:
    """
    Máscara binaria de ejemplo.
    """
    mask = [[0 for _ in range(width)] for _ in range(height)]

    for y in range(height // 5, 4 * height // 5):
        for x in range(width // 5, 4 * width // 5):
            mask[y][x] = 1

    return mask