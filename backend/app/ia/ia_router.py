"""
ia_router.py
------------
Router central de modelos IA para MI_PACS.

Responsabilidades:
- Seleccionar dinámicamente el modelo IA adecuado según el tipo de estudio.
- Mantener un registro claro, escalable y desacoplado de los modelos disponibles.
- Evitar cargar PyTorch u otros frameworks pesados durante el arranque del backend.
- Permitir agregar nuevos modelos IA sin modificar el resto del sistema.

Este módulo NO ejecuta inferencia.
Solo decide qué modelo usar y devuelve la función correspondiente.
"""

from typing import Callable, Dict, Any
import numpy as np


# ---------------------------------------------------------
# IMPORTACIÓN DIFERIDA (LAZY IMPORT)
# ---------------------------------------------------------
# Los modelos IA se importan dinámicamente SOLO cuando se necesitan.
# Esto evita cargar PyTorch al iniciar el backend.
# ---------------------------------------------------------
def _importar_modelo(nombre: str) -> Callable:
    """
    Importa dinámicamente el modelo IA solicitado.

    Parámetros:
    - nombre: nombre interno del modelo IA (pulmon, cerebro, mama, etc.)

    Retorna:
    - Función de inferencia correspondiente al modelo IA.
    """

    if nombre == "pulmon":
        from app.ia.modelos.mi_modelo_pulmon import inferir_volumen_pulmon
        return inferir_volumen_pulmon

    if nombre == "cerebro":
        from app.ia.modelos.mi_modelo_cerebro import inferir_volumen_cerebro
        return inferir_volumen_cerebro

    if nombre == "mama":
        from app.ia.modelos.mi_modelo_mama import inferir_volumen_mama
        return inferir_volumen_mama

    if nombre == "fracturas":
        from app.ia.modelos.mi_modelo_fracturas import inferir_volumen_fracturas
        return inferir_volumen_fracturas

    if nombre == "abdomen":
        from app.ia.modelos.mi_modelo_abdomen import inferir_volumen_abdomen
        return inferir_volumen_abdomen

    raise ValueError(f"Modelo IA desconocido: {nombre}")


# ---------------------------------------------------------
# SELECCIÓN DEL MODELO IA
# ---------------------------------------------------------
def seleccionar_modelo(tipo_estudio: str) -> Callable[[np.ndarray], Dict[str, Any]]:
    """
    Devuelve la función de inferencia IA adecuada según el tipo de estudio.

    Parámetros:
    - tipo_estudio: texto libre que describe el estudio (RX tórax, TAC abdomen, etc.)

    Retorna:
    - Función de inferencia IA correspondiente al modelo clínico.

    Notas clínicas:
    - Las reglas son simples y extensibles.
    - Se pueden agregar nuevos modelos sin modificar la lógica principal.
    """

    tipo = (tipo_estudio or "").lower()

    # -------------------------
    # REGLAS CLÍNICAS ACTIVAS
    # -------------------------

    # Tórax / Pulmón / RX torácico
    if any(p in tipo for p in ["torax", "pulmon", "rx", "pecho", "chest"]):
        return _importar_modelo("pulmon")

    # Cerebro / Cráneo / Neuro
    if any(p in tipo for p in ["cerebro", "craneo", "neuro", "cabeza", "brain"]):
        return _importar_modelo("cerebro")

    # Mama / Mamografía
    if any(p in tipo for p in ["mama", "mamografia", "breast"]):
        return _importar_modelo("mama")

    # Fracturas / Trauma / Hueso
    if any(p in tipo for p in ["fractura", "trauma", "hueso", "bone"]):
        return _importar_modelo("fracturas")

    # Abdomen
    if any(p in tipo for p in ["abdomen", "abdominal"]):
        return _importar_modelo("abdomen")

    # -------------------------
    # MODELO POR DEFECTO
    # -------------------------
    return _importar_modelo("pulmon")