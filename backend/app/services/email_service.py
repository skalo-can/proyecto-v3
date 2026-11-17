"""
email_service.py
----------------
Servicio clínico para el envío de correos electrónicos dentro del sistema MI_PACS.

Responsabilidades:
- Enviar correos HTML usando SMTP seguro
- Enviar resultados médicos (PDF) como adjuntos
- Mantener una interfaz simple para otros módulos del sistema
- Formato Bilingüe Automático
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

from app.core.email_config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    FROM_EMAIL,
)


# ---------------------------------------------------------
# ENVÍO DE CORREO HTML (PARA ENLACES PUROS)
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
# 🚀 MOTOR PARA EL ENVÍO DE RESULTADOS PDF (FORMATO BILINGÜE)
# ---------------------------------------------------------
def procesar_envio_email(paciente_id: str, correo_destino: str, ruta_exacta_pdf: str, enlace_visor: str = None) -> str:
    """
    Función diseñada para BackgroundTasks.
    Busca el PDF y lo envía por correo junto con el link del portal.
    Ahora utiliza un formato HTML bilingüe profesional.
    """
    msg = MIMEMultipart()
    # Asunto bilingüe
    msg["Subject"] = f"Medical Study Results / Resultados del Estudio - ID: {paciente_id}"
    msg["From"] = FROM_EMAIL
    msg["To"] = correo_destino

    # Construcción dinámica del enlace si se proporciona
    bloque_enlace_en = ""
    bloque_enlace_es = ""
    
    if enlace_visor:
        bloque_enlace_en = f"""
        <p>Additionally, you can view your radiological images by accessing the following secure link:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="{enlace_visor}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Radiology Viewer</a>
        </div>
        <p style="font-size: 13px; color: #64748b;"><i>(Note: For your security, the link is valid for 48 hours and requires your date of birth as a PIN).</i></p>
        """
        
        bloque_enlace_es = f"""
        <p>Adicionalmente, puede visualizar sus imágenes radiológicas accediendo al siguiente enlace seguro:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="{enlace_visor}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Acceder al Visor Radiológico</a>
        </div>
        <p style="font-size: 13px; color: #64748b;"><i>(Nota: Por su seguridad, el enlace es válido por 48 horas y requerirá su fecha de nacimiento como PIN).</i></p>
        """

    # 📄 Plantilla HTML Bilingüe
    cuerpo_html = f"""
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">MI_PACS Radiology Center</h1>
        </div>
        
        <div style="padding: 20px;">
            <!-- INGLÉS -->
            <h2 style="color: #1e293b;">Dear Patient,</h2>
            <p>Attached you will find the PDF report of your radiological study, properly validated and digitally signed by the specialist physician.</p>
            {bloque_enlace_en}
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <!-- ESPAÑOL -->
            <h2 style="color: #1e293b;">Estimado Paciente,</h2>
            <p>Adjunto encontrará el informe en formato PDF de su estudio radiológico, debidamente validado y firmado por el médico especialista.</p>
            {bloque_enlace_es}
            
            <br>
            <p style="margin-top: 20px;">Sincerely / Atentamente,<br><strong>MI_PACS Medical Team</strong></p>
        </div>
    </div>
    """

    msg.attach(MIMEText(cuerpo_html, "html"))

    # 🔥 Adjuntar el PDF si existe
    if os.path.exists(ruta_exacta_pdf):
        with open(ruta_exacta_pdf, "rb") as f:
            adjunto = MIMEApplication(f.read(), _subtype="pdf")
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
        
        print(f"✅ Correo bilingüe con PDF enviado exitosamente a {correo_destino}")
        return "Correo bilingüe con PDF enviado correctamente"
        
    except Exception as e:
        print(f"❌ Error crítico en el motor de correo PDF: {e}")
        raise RuntimeError(f"Error enviando resultado PDF: {str(e)}")