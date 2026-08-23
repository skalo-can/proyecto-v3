"""
dicom_service.py
----------------
Servicio clínico para gestionar el ciclo de vida del servidor DICOM
y la transmisión de estudios hacia nodos externos (C-STORE) dentro de MI_PACS.
"""

import threading
import subprocess
from pathlib import Path
from app.dicom_utils.dicom_server import iniciar_dicom_server, detener_dicom_server
from app.core.database import SessionLocal
from app.core.config import STATIC_DIR, BACKEND_DIR
from app.models.estudio import Estudio
from app.models.paciente import Paciente

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


def enviar_estudios_a_nodo(destino_aet: str, estudios_ids: list):
    """
    Envía los estudios especificados a una estación DICOM externa usando storescu.exe
    consultando el modelo Estudio, sus pacientes y sus imágenes relacionadas.
    """
    db = SessionLocal()
    try:
        print(f"🔄 [BACKGROUND] Iniciando transmisión hacia {destino_aet} para IDs recibidos: {estudios_ids}")
        
        ids_enteros = [int(i) for i in estudios_ids]
        
        # 1. Buscamos los estudios vinculados por ID de estudio o ID de paciente
        estudios = db.query(Estudio).join(Paciente).filter(
            (Estudio.id.in_(ids_enteros)) | (Estudio.paciente_id.in_(ids_enteros))
        ).all()
        
        print(f"🔍 [DEBUG] Estudios encontrados mediante lógica de paciente/estudio: {len(estudios)}")
        
        if not estudios:
            print("⚠️ [BACKGROUND] No se encontraron los estudios especificados en la base de datos.")
            return

        # Configuración de red para la estación destino (eFilm / Tomografía)
        ip_destino = "192.168.5.23"
        puerto_destino = 4006
        client_ae = "MIPACS"

        # Ruta absoluta y blindada hacia storescu.exe
        store_scu_path = BACKEND_DIR / "tools" / "dcmtk" / "bin" / "storescu.exe"
        
        print(f"🛠️ [C-STORE] Ruta buscada para storescu: {store_scu_path} (Existe: {store_scu_path.exists()})")

        if not store_scu_path.exists():
            print("❌ [C-STORE] ERROR CRÍTICO: No se encuentra storescu.exe en la ruta especificada.")
            return

        # 2. Iteramos sobre cada estudio y sus imágenes relacionadas
        for estudio in estudios:
            if not estudio.imagenes:
                print(f"⚠️ [BACKGROUND] El estudio ID {estudio.id} no tiene imágenes asociadas.")
                continue

            for img in estudio.imagenes:
                # Limpiamos la ruta utilizando la propiedad 'ruta_archivo' del modelo EstudioImagen
                ruta_limpia = img.ruta_archivo.replace("/static/", "").lstrip("/\\")
                full_path = (STATIC_DIR / ruta_limpia).resolve()
                
                if full_path.exists():
                    cmd = [
                        str(store_scu_path),
                        "-aet", client_ae,
                        "-aec", destino_aet,
                        ip_destino,
                        str(puerto_destino),
                        str(full_path),
                    ]
                    
                    resultado = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                    if resultado.returncode == 0:
                        print(f"✅ [C-STORE] Archivo enviado con éxito: {full_path.name}")
                    else:
                        print(f"❌ [C-STORE] Error al enviar {full_path.name}: {resultado.stderr}")
                else:
                    print(f"⚠️ Archivo físico no encontrado en disco: {full_path}")

    except Exception as e:
        print(f"❌ Error crítico en tarea de fondo C-STORE: {e}")
    finally:
        db.close()