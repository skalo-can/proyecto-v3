"""
services/gestor_firma.py — MI_PACS
Servicio orquestador para el flujo de firma médica y generación automatizada de reportes.
(VERSIÓN BLINDADA - CORRECCIÓN DE DOCUMENTO DE IDENTIDAD)
"""

import os
from sqlalchemy.orm import Session
from app.services.generador_pdf import construir_reporte_pdf
from app.models.estudio import Estudio

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA
from app.core.config import PDF_REPORTS_DIR

def procesar_firma_estudio(db: Session, estudio_id: int) -> bool:
    """
    Orquesta el flujo de firma recuperando datos con extracción segura.
    """
    try:
        # 1. Recuperar el estudio
        estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
        if not estudio:
            print(f"❌ Error: No se encontró el estudio ID {estudio_id} en la base de datos.")
            return False
            
        # ==========================================
        # 🛡️ EXTRACCIÓN SEGURA DE DATOS
        # ==========================================
        
        # A. Nombre del Paciente
        nombre_paciente = "Paciente Desconocido"
        if estudio.paciente:
            if hasattr(estudio.paciente, 'nombre') and getattr(estudio.paciente, 'nombre'):
                nombre_paciente = estudio.paciente.nombre
            else:
                p_nombre = getattr(estudio.paciente, 'primer_nombre', '')
                p_apellido = getattr(estudio.paciente, 'primer_apellido', '')
                nombre_paciente = f"{p_nombre} {p_apellido}".strip() or "Paciente Desconocido"
        
        # B. ID / Documento del Paciente (El real, no el interno de la BD)
        id_paciente = "0000"
        if estudio.paciente:
            # Busca 'identificacion' primero, luego 'documento', y por último cae al 'id'
            id_paciente = str(getattr(estudio.paciente, 'identificacion', getattr(estudio.paciente, 'documento', estudio.paciente.id)))
        
        # C. Fecha del Estudio
        fecha_raw = getattr(estudio, 'fecha_estudio', getattr(estudio, 'fecha', ''))
        fecha_str = fecha_raw.strftime("%Y-%m-%d") if hasattr(fecha_raw, 'strftime') else str(fecha_raw)
        
        # D. Modalidad
        modalidad = getattr(estudio, 'tipo_estudio', getattr(estudio, 'modalidad', 'N/A'))
        
        # E. Texto Diagnóstico y Médico
        texto = getattr(estudio, 'informe_texto', getattr(estudio, 'informe', 'Estudio sin diagnóstico redactado.'))
        medico = getattr(estudio, 'medico_firma', 'Médico Especialista')

        # 2. Estructurar el diccionario
        datos_clinicos = {
            "nombre_paciente": nombre_paciente,
            "id_paciente": id_paciente,
            "fecha_estudio": fecha_str,
            "modalidad": modalidad,
            "texto_diagnostico": texto,
            "nombre_medico": medico
        }
        
        print(f"✅ Datos extraídos listos para PDF: {datos_clinicos}")
        
        # 3. Definir la ruta física usando el Ancla Absoluta (👻 FANTASMA ELIMINADO)
        ruta_almacenamiento = str(PDF_REPORTS_DIR)
        
        # El nombre del archivo ahora usará la identificación real
        nombre_pdf_final = os.path.join(ruta_almacenamiento, f"Reporte_{datos_clinicos['id_paciente']}.pdf")
        
        # 4. Invocar el motor WeasyPrint
        if "SSLKEYLOGFILE" in os.environ:
            del os.environ["SSLKEYLOGFILE"]
            
        exito_renderizado = construir_reporte_pdf(datos_clinicos, nombre_pdf_final)
        
        # 5. Guardar en Base de Datos
        if exito_renderizado:
            from app.crud.reporte import crear_registro_reporte
            crear_registro_reporte(db=db, estudio_id=estudio_id, pdf_path=nombre_pdf_final)
            print(f"✅ Flujo completado: Estudio {estudio_id} firmado y PDF generado exitosamente.")
            return True
            
        return False

    except Exception as e:
        print(f"❌ Error crítico en el servicio de firma: {e}")
        return False 