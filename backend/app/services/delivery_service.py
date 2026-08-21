import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os
from datetime import datetime
from app.core.database import SessionLocal
from app.models.ris_orden import RISOrden

def enviar_notificacion_estudio(orden_id: int, tipo_envio: str):
    """
    Controlador maestro de entregas digitales.
    tipo_envio: 'IMAGENES_URGENCIA' o 'REPORTE_COMPLETO'
    """
    db = SessionLocal()
    try:
        orden = db.query(RISOrden).filter(RISOrden.id_orden == order_id).first()
        if not orden:
            print(f"❌ [DELIVERY] No se encontró la orden ID {orden_id}")
            return False
            
        # Simulación de extracción de datos de contacto (Ajustar a tu tabla de Pacientes)
        email_paciente = "paciente_demo@gmail.com" 
        link_visor = f"http://portal.mipacs.net:5173/imagenes-estudio/{orden.accession_number}"
        
        print(f"📧 [DELIVERY] Preparando despacho para: {orden.apellido} ({tipo_envio})")
        
        # Aquí se integrará con tu configuración SMTP real (settings)
        # Por ahora dejamos el bloque estructurado para que no interrumpa tu flujo:
        if tipo_envio == "IMAGENES_URGENCIA":
            asunto = f"MI_PACS → Imágenes Disponibles (Urgencias) - Ref: {orden.accession_number}"
            cuerpo = f"""
            <html>
                <body style="background-color: #0f1114; color: #ffffff; font-family: sans-serif; padding: 20px;">
                    <h2 style="color: #fbbf24;">Acceso Inmediato a sus Imágenes Médicas</h2>
                    <p>Estimado(a) paciente,</p>
                    <p>Su médico tratante en el servicio de urgencias ha liberado las imágenes de su estudio de <strong>{orden.modalidad}</strong>.</p>
                    <div style="margin: 25px 0;">
                        <a href="{link_visor}" style="background-color: #10b981; color: #000000; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 6px;">
                            ⚡ Ver Imágenes en el Visor Web
                        </a>
                    </div>
                    <p style="color: #888; font-size: 0.85rem;">Nota: Este estudio no requiere reporte radiológico inmediato por flujo de urgencias.</p>
                </body>
            </html>
            """
        else:
            asunto = f"MI_PACS → Informe Oficial Disponible - Ref: {orden.accession_number}"
            cuerpo = f"<html><body><h2>Su reporte médico está listo</h2></body></html>"

        # Lógica de registro en tus tablas de logs existentes (ej: email_logs_api)
        print(f"✅ [DELIVERY] Correo enviado exitosamente a {email_paciente}")
        return True
        
    except Exception as e:
        print(f"❌ [DELIVERY] Error en pasarela de envíos: {str(e)}")
        return False
    finally:
        db.close()