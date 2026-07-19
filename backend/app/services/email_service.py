"""
email_service.py
----------------
Servicio clínico para el envío de correos electrónicos dentro del sistema MI_PACS.

Responsabilidades:
- Enviar correos HTML usando SMTP seguro
- Enviar resultados médicos (PDF) como adjuntos
- Mantener una interfaz simple para otros módulos del sistema
"""

import smtplib
import os # 🔥 Agregado para buscar el archivo PDF
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication # 🔥 Agregado para adjuntar archivos

from app.core.email_config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    FROM_EMAIL,
)


# ---------------------------------------------------------
# ENVÍO DE CORREO HTML (TU VERSIÓN ORIGINAL)
# ---------------------------------------------------------
def enviar_correo(destinatario: str, asunto: str, mensaje_html: str) -> str:
    """
    Envía un correo electrónico en formato HTML usando SMTP.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"] = FROM_EMAIL
    msg["To"] = destinatario

    parte_html = MIMEText(mensaje_html, "html")
    msg.attach(parte_html)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, destinatario, msg.as_string())

        return "Correo enviado correctamente"

    except Exception as e:
        raise RuntimeError(f"Error enviando correo clínico: {str(e)}")


# ---------------------------------------------------------
# 🚀 MOTOR PARA EL ENVÍO DE RESULTADOS (PDF) CORREGIDO
# ---------------------------------------------------------
def procesar_envio_email(paciente_id: str, correo_destino: str, ruta_exacta_pdf: str) -> str:
    """
    Función diseñada para BackgroundTasks.
    Busca el PDF en la ruta estructurada (Año/Mes/Día) y lo envía por correo.
    """
    msg = MIMEMultipart()
    msg["Subject"] = f"Resultados de su Estudio Médico - ID: {paciente_id}"
    msg["From"] = FROM_EMAIL
    msg["To"] = correo_destino

    cuerpo_mensaje = (
        "Estimado paciente,\n\n"
        "Adjunto encontrará el informe en formato PDF de su estudio radiológico, "
        "debidamente validado y firmado por el médico especialista.\n\n"
        "Atentamente,\n"
        "Centro Radiológico MI_PACS"
    )
    msg.attach(MIMEText(cuerpo_mensaje, "plain"))

    # 🔥 Usamos la ruta estructurada que nos manda la API
    if os.path.exists(ruta_exacta_pdf):
        with open(ruta_exacta_pdf, "rb") as f:
            adjunto = MIMEApplication(f.read(), _subtype="pdf")
            # Extraemos el nombre real del archivo (ej. Reporte_28799769.pdf) para el adjunto
            nombre_archivo = os.path.basename(ruta_exacta_pdf)
            adjunto.add_header("Content-Disposition", "attachment", filename=nombre_archivo)
            msg.attach(adjunto)
    else:
        print(f"⚠️ Alerta: No se encontró el PDF en la ruta {ruta_exacta_pdf}. Abortando envío.")
        return "Error: PDF no encontrado"

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, correo_destino, msg.as_string())
        
        print(f"✅ Correo con resultado PDF enviado exitosamente a {correo_destino}")
        return "Correo con PDF enviado correctamente"
        
    except Exception as e:
        print(f"❌ Error crítico en el motor de correo PDF: {e}")
        raise RuntimeError(f"Error enviando resultado PDF: {str(e)}")