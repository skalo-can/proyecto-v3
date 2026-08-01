import os
import sys
import base64

# =====================================================================
# 1. LIMPIEZA INMEDIATA DE LA VARIABLE SSL ANTES DE CARGAR LIBRERÍAS
# =====================================================================
if "SSLKEYLOGFILE" in os.environ:
    del os.environ["SSLKEYLOGFILE"]

# =====================================================================
# 2. ENLACE PARA ENCONTRAR GTK3 EN MSYS2 (WINDOWS)
# =====================================================================
ruta_msys = r"C:\msys64\mingw64\bin"
if os.path.exists(ruta_msys) and ruta_msys not in os.environ["PATH"]:
    os.environ["PATH"] = ruta_msys + os.path.pathsep + os.environ["PATH"]
    if hasattr(os, "add_dll_directory"):
        try:
            os.add_dll_directory(ruta_msys)
        except Exception:
            pass

from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def construir_reporte_pdf(datos_estudio, ruta_salida, nombre_plantilla='plantilla_reporte.html'):
    try:
        directorio_actual = os.path.dirname(os.path.abspath(__file__))
        carpeta_templates = os.path.join(directorio_actual, 'templates')
        entorno = Environment(loader=FileSystemLoader(carpeta_templates))
        
        plantilla = entorno.get_template(nombre_plantilla)
        datos_estudio['fecha_generacion'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Asegurar que la variable de la gráfica exista para Jinja2
        if "grafica_base64" not in datos_estudio:
            datos_estudio["grafica_base64"] = None

        # 🔥 INYECCIÓN DE LA FIRMA DIGITAL EN BASE64
        if "ruta_firma" in datos_estudio and datos_estudio["ruta_firma"]:
            if os.path.exists(datos_estudio["ruta_firma"]):
                try:
                    with open(datos_estudio["ruta_firma"], "rb") as image_file:
                        datos_estudio["firma_base64"] = base64.b64encode(image_file.read()).decode('utf-8')
                except Exception as e:
                    print(f"Advertencia: No se pudo codificar la firma. {e}")
                    datos_estudio["firma_base64"] = None
            else:
                datos_estudio["firma_base64"] = None

        html_renderizado = plantilla.render(datos_estudio)

        directorio_salida = os.path.dirname(ruta_salida)
        if not os.path.exists(directorio_salida):
            os.makedirs(directorio_salida, exist_ok=True)

        HTML(string=html_renderizado).write_pdf(ruta_salida)
        print(f"Éxito: PDF generado correctamente en '{ruta_salida}'")
        return True

    except Exception as e:
        print(f"Error al generar el PDF: {e}")
        return False