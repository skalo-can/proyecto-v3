"""
dicom_service.py
----------------
Servicio clínico para gestionar el ciclo de vida del servidor DICOM
dentro de MI_PACS.

Responsabilidades:
- Iniciar el servidor DICOM en un hilo separado.
- Detener el servidor cuando cambie la configuración.
- Reiniciar dinámicamente el servidor sin reiniciar MI_PACS.
"""

import threading
from app.dicom_utils.dicom_server import iniciar_dicom_server, detener_dicom_server

dicom_thread = None


def iniciar_servidor_dicom(ae_title: str, port: int):
    """
    Inicia el servidor DICOM en un hilo separado.
    """
    global dicom_thread

    dicom_thread = threading.Thread(
        target=iniciar_dicom_server,
        kwargs={"ae_title": ae_title, "port": port},
        daemon=True
    )
    dicom_thread.start()


def reiniciar_servidor_dicom(ae_title: str, port: int):
    """
    Reinicia el servidor DICOM con nueva configuración.
    """
    global dicom_thread

    try:
        detener_dicom_server()
    except Exception as e:
        print(f"⚠️ Advertencia al detener servidor DICOM: {e}")

    iniciar_servidor_dicom(ae_title, port)

    print(f"🔄 Servidor DICOM reiniciado clínicamente en puerto {port} (AE={ae_title})")