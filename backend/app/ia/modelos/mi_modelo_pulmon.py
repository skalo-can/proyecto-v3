"""
mi_modelo_pulmon.py
-------------------

Módulo de integración con un modelo de IA para análisis de tórax/pulmón.

Responsabilidades:
- Cargar el modelo PyTorch (solo una vez).
- Preprocesar el volumen DICOM (Z, Y, X) → tensor normalizado.
- Ejecutar inferencia sin bloquear el servidor.
- Postprocesar resultados (detección + segmentación).
- Devolver hallazgos y segmentación en formato estándar MI_PACS.

Este módulo NO conoce detalles de DICOM ni de la base de datos.
Solo recibe un volumen NumPy y devuelve resultados clínicos.
"""

from typing import Dict, Any
import numpy as np
import torch
import torch.nn.functional as F

# ---------------------------------------------------------
# CARGA DEL MODELO (singleton)
# ---------------------------------------------------------

_modelo = None  # cache global


def _cargar_modelo():
    """
    Carga el modelo PyTorch solo una vez.
    """
    global _modelo
    if _modelo is None:
        ruta = "backend/app/ia/modelos/modelo_pulmon.pt"  # TODO: reemplazar por tu ruta real
        _modelo = torch.jit.load(ruta, map_location="cpu")
        _modelo.eval()
        print("Modelo IA pulmonar cargado correctamente.")
    return _modelo


# ---------------------------------------------------------
# PREPROCESAMIENTO
# ---------------------------------------------------------

def _preprocesar_volumen(volumen: np.ndarray) -> torch.Tensor:
    """
    Preprocesa el volumen DICOM para el modelo IA.

    Entrada:
    - volumen: np.ndarray con forma (Z, Y, X)

    Salida:
    - tensor con forma (1, 1, Z, Y, X)
    """
    # Normalización básica (puedes ajustarla según tu modelo)
    v = volumen.astype("float32")
    v = (v - np.min(v)) / (np.max(v) - np.min(v) + 1e-5)

    tensor = torch.from_numpy(v).unsqueeze(0).unsqueeze(0)  # (1,1,Z,Y,X)
    return tensor


# ---------------------------------------------------------
# POSTPROCESAMIENTO
# ---------------------------------------------------------

def _postprocesar_salida(salida: Dict[str, Any], volumen: np.ndarray) -> Dict[str, Any]:
    """
    Convierte la salida del modelo IA al formato estándar MI_PACS.

    Se espera que el modelo devuelva:
    - "logits_det": detección por slice
    - "logits_seg": máscara segmentada (Z,Y,X)
    """
    logits_det = salida.get("logits_det")  # tensor (Z,)
    logits_seg = salida.get("logits_seg")  # tensor (Z,Y,X)

    Z, Y, X = volumen.shape
    z_centro = int(Z // 2)

    # Ejemplo de detección: tomar el slice con mayor score
    if logits_det is not None:
        slice_index = int(torch.argmax(logits_det).item())
        prob = float(torch.max(torch.sigmoid(logits_det)).item())
    else:
        slice_index = z_centro
        prob = 0.5

    # Bounding box DEMO (puedes reemplazarlo por tu postprocesamiento real)
    bbox = [X // 3, Y // 3, 2 * X // 3, 2 * Y // 3]

    # Segmentación DEMO
    if logits_seg is not None:
        seg_slice = logits_seg[slice_index]
        mask_binaria = (torch.sigmoid(seg_slice) > 0.5).cpu().numpy().astype(int)
    else:
        mask_binaria = _generar_mascara_demo(Y, X)

    return {
        "modelo": "mi_modelo_pulmon_pytorch_v1",
        "hallazgos": [
            {
                "tipo": "lesion_pulmonar",
                "probabilidad": prob,
                "slice_index": slice_index,
                "bounding_box": bbox,
            }
        ],
        "segmentacion": {
            "slice_index": slice_index,
            "color": [255, 0, 0],
            "mask": mask_binaria.tolist(),
        },
    }


# ---------------------------------------------------------
# INFERENCIA PRINCIPAL
# ---------------------------------------------------------

def inferir_volumen_pulmon(volumen: np.ndarray) -> Dict[str, Any]:
    """
    Ejecuta inferencia sobre un volumen de tórax.

    Flujo:
    - Preprocesar volumen
    - Ejecutar modelo PyTorch
    - Postprocesar resultados
    """
    modelo = _cargar_modelo()
    tensor = _preprocesar_volumen(volumen)

    with torch.no_grad():
        salida = modelo(tensor)

    # salida debe ser un dict con tensores
    return _postprocesar_salida(salida, volumen)


# ---------------------------------------------------------
# MÁSCARA DEMO (fallback)
# ---------------------------------------------------------

def _generar_mascara_demo(height: int, width: int):
    """
    Genera una máscara binaria de ejemplo (solo para pruebas de overlay).
    """
    mask = [[0 for _ in range(width)] for _ in range(height)]
    for y in range(height // 3, 2 * height // 3):
        for x in range(width // 3, 2 * width // 3):
            mask[y][x] = 1
    return mask