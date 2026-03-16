"""
utils.py — MI_PACS
---------------------------------------------------------
Módulo clínico de utilidades para extracción segura de metadata DICOM.

Rol dentro de MI_PACS:
----------------------
Este módulo actúa como una capa de normalización entre:
- Archivos DICOM provenientes del importador clínico
- El modelo EstudioImagen
- El visor DICOM del frontend
- El motor pydicom

Objetivo clínico:
-----------------
Garantizar que MI_PACS pueda extraer metadata relevante de forma:
✔ Segura (sin cargar pixeles)
✔ Rápida (stop_before_pixels=True)
✔ Normalizada (strings limpios, sin objetos DICOM crudos)
✔ Compatible con la base de datos y el frontend

Este módulo NO:
---------------
✘ Crea carpetas  
✘ Escribe archivos  
✘ Modifica rutas  
✘ Interactúa con static/  
✘ Genera thumbnails  

Por lo tanto, es completamente seguro en términos de estructura de archivos.
"""

import pydicom


def extract_dicom_metadata(file_path: str) -> dict:
    """
    Extrae metadata clínica relevante desde un archivo DICOM.

    Parámetros:
    -----------
    file_path : str
        Ruta absoluta del archivo DICOM en el sistema de archivos clínico.

    Comportamiento clínico:
    -----------------------
    - Se lee únicamente el encabezado DICOM (sin pixeles) para mejorar rendimiento.
    - Se normalizan todos los valores a strings seguros.
    - Se manejan MultiValue, listas, tuplas y objetos DICOM.
    - Ante cualquier error, se retorna un diccionario vacío para no interrumpir
      el flujo PACS.

    Retorna:
    --------
    dict
        Diccionario con metadata normalizada y lista para ser almacenada en
        EstudioImagen.dicom_metadata.
    """
    try:
        # Lectura clínica del archivo sin cargar pixeles
        ds = pydicom.dcmread(file_path, stop_before_pixels=True)

        def safe_get(tag, default=""):
            """
            Obtiene un atributo DICOM de forma segura y lo normaliza.

            Normalización aplicada:
            -----------------------
            ✔ MultiValue → "val1, val2, val3"
            ✔ listas/tuplas → "val1, val2"
            ✔ objetos DICOM con .value → str(value)
            ✔ valores None → default
            ✔ cualquier excepción → default

            Esto garantiza que MI_PACS nunca reciba objetos crudos de pydicom.
            """
            try:
                value = ds.get(tag, default)

                # MultiValue o listas
                if isinstance(value, (list, tuple)):
                    return ", ".join(str(v) for v in value)

                # Objetos DICOM (DataElement)
                if hasattr(value, "value"):
                    return str(value.value)

                return str(value)

            except Exception:
                return default

        # Diccionario clínico estandarizado
        metadata = {
            "PatientName": safe_get("PatientName"),
            "PatientID": safe_get("PatientID"),
            "StudyDate": safe_get("StudyDate"),
            "Modality": safe_get("Modality"),
            "Manufacturer": safe_get("Manufacturer"),
            "Rows": safe_get("Rows"),
            "Columns": safe_get("Columns"),
            "BitsStored": safe_get("BitsStored"),
            "WindowCenter": safe_get("WindowCenter"),
            "WindowWidth": safe_get("WindowWidth"),
            "NumberOfFrames": safe_get("NumberOfFrames", "1"),
        }

        return metadata

    except Exception as e:
        # Error clínico controlado: nunca interrumpir el flujo PACS
        print(f"[MI_PACS] Error extrayendo metadata DICOM: {e}")
        return {}