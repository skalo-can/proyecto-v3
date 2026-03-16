"""
email_service.py
----------------
Servicio clínico para el envío de correos electrónicos dentro del sistema MI_PACS.

Responsabilidades:
- Enviar correos HTML usando SMTP seguro
- Mantener una interfaz simple para otros módulos del sistema

Este servicio actúa como capa intermedia entre:
- Configuración SMTP (email_config.py)
- Módulos que requieren notificaciones por correo
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.email_config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    FROM_EMAIL,
)


# ---------------------------------------------------------
# ENVÍO DE CORREO HTML
# ---------------------------------------------------------
def enviar_correo(destinatario: str, asunto: str, mensaje_html: str) -> None:
    """
    Envía un correo electrónico en formato HTML usando SMTP.

    Parámetros:
    - destinatario: correo del receptor
    - asunto: asunto del mensaje
    - mensaje_html: contenido HTML del correo

    Este servicio se usa para notificaciones clínicas y administrativas.
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

    except Exception as e:
        raise RuntimeError(f"Error enviando correo clínico: {str(e)}")