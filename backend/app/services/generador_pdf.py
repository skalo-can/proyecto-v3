import os
import sys

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

# =====================================================================
# 3. AHORA SÍ, IMPORTACIONES COMPLEMENTARIAS Y WEASYPRINT
# =====================================================================
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def construir_reporte_pdf(datos_estudio, ruta_salida):
    """
    Recibe un diccionario con los datos del paciente y el diagnóstico,
    los inyecta en la plantilla HTML y genera un archivo PDF físico.
    """
    try:
        # Localizar la carpeta 'templates' que está dentro de app/services
        directorio_actual = os.path.dirname(os.path.abspath(__file__))
        carpeta_templates = os.path.join(directorio_actual, 'templates')
        
        # Configurar Jinja2 para que apunte exactamente a esa subcarpeta
        entorno = Environment(loader=FileSystemLoader(carpeta_templates))
        plantilla = entorno.get_template('plantilla_reporte.html')

        # Añadir metadatos automáticos al diccionario de datos
        datos_estudio['fecha_generacion'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Combinar (renderizar) la plantilla con los datos
        html_renderizado = plantilla.render(datos_estudio)

        # --- CORRECCIÓN INYECTADA AQUÍ ---
        # Extraer el directorio final de ruta_salida y asegurar su creación
        directorio_salida = os.path.dirname(ruta_salida)
        if not os.path.exists(directorio_salida):
            os.makedirs(directorio_salida, exist_ok=True)
        # ---------------------------------

        # Generar el PDF y guardarlo en la ruta indicada
        HTML(string=html_renderizado).write_pdf(ruta_salida)

        print(f"Éxito: PDF generado correctamente en '{ruta_salida}'")
        return True

    except Exception as e:
        print(f"Error al generar el PDF: {e}")
        return False

# =====================================================================
# BLOQUE DE PRUEBA INDEPENDIENTE (ACTUALIZADO CON REGISTRO MÉDICO)
# =====================================================================
if __name__ == "__main__":
    datos_prueba = {
        "nombre_paciente": "FRANKLYN GONGORA ARIAS",
        "id_paciente": "93377886",
        "fecha_estudio": "2026-04-04 00:00",
        "modalidad": "CT",
        "texto_diagnostico": "Se realiza Tomografía Computarizada sin hallazgos patológicos agudos.\n\nEstructuras óseas conservadas. No se observan colecciones ni masas evidentes en los cortes analizados.\n\nConclusión: Estudio dentro de límites normales.",
        "nombre_medico": "Carlos Mendoza",
        "registro_medico": "RM-99452"  # Agregado para pruebas locales
    }

    # CALCULAMOS LA RUTA REAL HACIA TU CARPETA DE ESTÁTICOS
    directorio_actual = os.path.dirname(os.path.abspath(__file__))
    ruta_reportes_sistema = os.path.abspath(os.path.join(directorio_actual, "..", "..", "static", "pdf_reports"))
    
    # Definimos el nombre y destino final del archivo de prueba
    nombre_archivo_salida = os.path.join(ruta_reportes_sistema, f"Reporte_{datos_prueba['id_paciente']}.pdf")

    # Llamamos a la función constructora
    construir_reporte_pdf(datos_prueba, nombre_archivo_salida)