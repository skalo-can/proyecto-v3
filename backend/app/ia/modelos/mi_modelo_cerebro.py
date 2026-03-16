"""
mi_modelo_cerebro.py
--------------------

Módulo de integración con un modelo de IA para análisis de cerebro (RM/TC).

Responsabilidades:
- Cargar el modelo IA (PyTorch / ONNX / TensorFlow).
- Preprocesar el volumen DICOM (Z, Y, X) según requerimientos del modelo.
- Ejecutar inferencia sin bloquear el servidor.
- Postprocesar resultados (detección + segmentación).
- Devolver hallazgos y segmentación en formato estándar MI_PACS.

Este módulo actúa como capa de inferencia independiente.
No conoce detalles de DICOM ni de la base de datos.
"""

from typing import Dict, Any
import numpy as np

# TODO: importar PyTorch o ONNX si se usa un modelo real
# import torch


# ---------------------------------------------------------
# CARGA DEL MODELO (placeholder)
# ---------------------------------------------------------

_modelo = None  # cache global


def _cargar_modelo():
    """
    Carga el modelo IA de cerebro solo una vez.

    NOTA:
    - Cuando tengas el modelo real, reemplaza esta función.
    - Puedes usar torch.jit.load(), onnxruntime.InferenceSession(), etc.
    """
    global _modelo

    if _modelo is None:
        # TODO: reemplazar por la ruta real del modelo
        # _modelo = torch.jit.load("backend/app/ia/modelos/modelo_cerebro.pt")
        # _modelo.eval()
        _modelo = "modelo_cerebro_demo"  # placeholder
        print("Modelo IA de cerebro cargado (demo).")

    return _modelo


# ---------------------------------------------------------
# PREPROCESAMIENTO
# ---------------------------------------------------------

def _preprocesar_volumen(volumen: np.ndarray) -> np.ndarray:
    """
    Preprocesa el volumen DICOM para el modelo IA.

    Entrada:
    - volumen: np.ndarray con forma (Z, Y, X)

    Salida:
    - volumen normalizado listo para inferencia
    """
    if volumen is None or volumen.size == 0:
        raise ValueError("El volumen recibido está vacío o es inválido.")

    v = volumen.astype("float32")

    # Normalización robusta
    minimo = np.min(v)
    maximo = np.max(v)
    rango = maximo - minimo

    if rango < 1e-5:
        # Evita división por cero en estudios homogéneos
        v = np.zeros_like(v, dtype="float32")
    else:
        v = (v - minimo) / (rango + 1e-5)

    # En un modelo real, convertirías a tensor:
    # v_tensor = torch.from_numpy(v).unsqueeze(0).unsqueeze(0)

    return v


# ---------------------------------------------------------
# POSTPROCESAMIENTO
# ---------------------------------------------------------

def _postprocesar_salida(volumen: np.ndarray) -> Dict[str, Any]:
    """
    Convierte la salida del modelo IA al formato estándar MI_PACS.

    Esta versión es un placeholder para pruebas de integración.
    """
    Z, Y, X = volumen.shape
    z_centro = Z // 2

    # Bounding box de ejemplo (centrado)
    bbox = [
        X // 4,
        Y // 4,
        3 * X // 4,
        3 * Y // 4,
    ]

    # Máscara de ejemplo
    mask = _generar_mascara_demo(Y, X)

    return {
        "modelo": "mi_modelo_cerebro_demo_v1",
        "hallazgos": [
            {
                "tipo": "lesion_cerebral",
                "probabilidad": 0.72,
                "slice_index": int(z_centro),
                "bounding_box": bbox,
            }
        ],
        "segmentacion": {
            "slice_index": int(z_centro),
            "color": [0, 128, 255],  # azul
            "mask": mask,
        },
    }


# ---------------------------------------------------------
# INFERENCIA PRINCIPAL
# ---------------------------------------------------------

def inferir_volumen_cerebro(volumen: np.ndarray) -> Dict[str, Any]:
    """
    Ejecuta inferencia IA sobre un volumen de cerebro.

    Flujo:
    - Validar volumen
    - Cargar modelo IA (si no está cargado)
    - Preprocesar volumen
    - Ejecutar inferencia (demo por ahora)
    - Postprocesar resultados
    """
    if volumen is None or volumen.size == 0:
        raise ValueError("No se puede ejecutar IA: el volumen está vacío.")

    _cargar_modelo()

    # Preprocesamiento
    v = _preprocesar_volumen(volumen)

    # TODO: cuando tengas el modelo real, reemplaza esta sección:
    # with torch.no_grad():
    #     salida = _modelo(v_tensor)
    # return _postprocesar_salida(salida)

    # Por ahora devolvemos un resultado de ejemplo
    return _postprocesar_salida(v)


# ---------------------------------------------------------
# MÁSCARA DEMO
# ---------------------------------------------------------

def _generar_mascara_demo(height: int, width: int) -> list[list[int]]:
    """
    Genera una máscara binaria de ejemplo (solo para pruebas de overlay).
    """
    mask = [[0 for _ in range(width)] for _ in range(height)]

    for y in range(height // 4, 3 * height // 4):
        for x in range(width // 4, 3 * width // 4):
            mask[y][x] = 1

    return mask