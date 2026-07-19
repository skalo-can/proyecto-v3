"""
whatsapp_service.py
-------------------
Servicio clínico para el envío de notificaciones por WhatsApp dentro del sistema MI_PACS.
"""

def enviar_mensaje_whatsapp(numero: str, mensaje: str) -> bool:
    """
    Envía un mensaje de WhatsApp utilizando el proveedor configurado.
    Retorna True si el envío fue exitoso, False en caso de error.
    """
    
    # 1. Limpieza básica del número (quitar espacios o guiones)
    numero_limpio = str(numero).replace(" ", "").replace("-", "").strip()

    # 2. Aquí irá la lógica real de tu proveedor de WhatsApp en el futuro
    # Ejemplo con requests:
    # payload = {
    #     "token": "TU_TOKEN_GUARDADO_EN_BD",
    #     "to": numero_limpio,
    #     "body": mensaje
    # }
    # response = requests.post("https://api.tuproveedor.com/messages/chat", json=payload)
    # return response.status_code == 200
    
    # Simulación de éxito en consola del servidor
    print(f"📱 [WHATSAPP SIMULADOR] Enviando a {numero_limpio}...")
    print(f"Contenido:\n{mensaje}\n")
    
    return True  # Retornamos True para que tu tabla de Logs lo marque como "enviado"