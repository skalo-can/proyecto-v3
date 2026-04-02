"""
dicom_server.py
---------------
Servidor DICOM clínico para MI_PACS.

- Acepta C‑ECHO (Verification)
- Acepta TODOS los SOP Class de almacenamiento (C‑STORE)
- Registra modalidades reales (AE Title, IP, Puerto)
- Guarda las imágenes DICOM en disco (INBOX)
- Expone estado y logs para el frontend
"""

from pathlib import Path

from pynetdicom import AE, evt, AllStoragePresentationContexts
from pynetdicom.sop_class import Verification

from app.core.database import SessionLocal
from app.crud.crud_modality import register_modality

dicom_server_instance = None
stop_flag = False

# Carpeta donde se guardan las imágenes entrantes
INBOX_PATH = Path("backend/dicom_inbox")

# ---------------------------------------------------------
# ESTADO GLOBAL DEL SERVIDOR (para /status y /logs)
# ---------------------------------------------------------
server_state = {
    "running": False,
    "ae_title": None,
    "port": None,
    "last_event": None,
    "logs": []
}


def _log(event: str):
    """Registrar eventos clínicos en memoria."""
    server_state["last_event"] = event
    server_state["logs"].append(event)
    print(event)


# ---------------------------------------------------------
# INICIAR SERVIDOR DICOM
# ---------------------------------------------------------
def iniciar_dicom_server(ae_title: str, port: int):
    global dicom_server_instance, stop_flag, server_state

    stop_flag = False

    ae = AE(ae_title=ae_title)

    # SOP Class para C‑ECHO
    ae.add_supported_context(Verification)

    # Aceptar TODOS los SOP Class de almacenamiento (C‑STORE)
    # usando los contextos completos (abstract + transfer syntaxes)
    ae.supported_contexts.extend(AllStoragePresentationContexts)

    handlers = [
        (evt.EVT_C_STORE, handle_store),
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_ACCEPTED, handle_association),
    ]

    print(f"🔄 Intentando iniciar servidor DICOM en puerto {port} (AE={ae_title})...")

    try:
        dicom_server_instance = ae.start_server(
            ("", port),
            block=False,
            evt_handlers=handlers
        )

        server_state["running"] = True
        server_state["ae_title"] = ae_title
        server_state["port"] = port

        _log(f"🚀 Servidor DICOM INICIADO correctamente en puerto {port} (AE={ae_title})")

    except Exception as e:
        server_state["running"] = False
        _log(f"❌ ERROR al iniciar servidor DICOM en puerto {port}: {e}")
        dicom_server_instance = None


# ---------------------------------------------------------
# DETENER SERVIDOR DICOM
# ---------------------------------------------------------
def detener_dicom_server():
    global dicom_server_instance, stop_flag

    stop_flag = True

    if dicom_server_instance:
        try:
            dicom_server_instance.shutdown()
            _log("🛑 Servidor DICOM detenido clínicamente.")
        except Exception as e:
            _log(f"⚠️ Error al detener servidor DICOM: {e}")

    dicom_server_instance = None
    server_state["running"] = False


# ---------------------------------------------------------
# HANDLERS DICOM
# ---------------------------------------------------------
def handle_association(event):
    """Se ejecuta cuando una modalidad inicia una asociación DICOM."""
    calling_ae = event.assoc.requestor.ae_title.decode()
    calling_ip = event.assoc.requestor.address
    calling_port = event.assoc.requestor.port

    _log(f"📡 Asociación iniciada → AE={calling_ae}, IP={calling_ip}, Puerto={calling_port}")

    db = SessionLocal()
    register_modality(db, calling_ae, calling_ip, calling_port)
    db.close()


def handle_echo(event):
    """Responder a C‑ECHO."""
    _log("📡 C‑ECHO recibido y respondido correctamente.")
    return 0x0000


def handle_store(event):
    """Procesar C‑STORE (almacenamiento de imágenes)."""
    calling_ae = event.assoc.requestor.ae_title.decode()
    calling_ip = event.assoc.requestor.address
    calling_port = event.assoc.requestor.port

    _log(f"📥 C‑STORE recibido de AE={calling_ae} ({calling_ip}:{calling_port})")

    # Dataset DICOM recibido
    ds = event.dataset
    ds.file_meta = event.file_meta

    # Asegurar carpeta INBOX
    INBOX_PATH.mkdir(parents=True, exist_ok=True)

    # Nombre de archivo basado en SOPInstanceUID
    sop_uid = getattr(ds, "SOPInstanceUID", None)
    if not sop_uid:
        # Fallback por si acaso
        from uuid import uuid4
        sop_uid = str(uuid4())

    filename = INBOX_PATH / f"{sop_uid}.dcm"

    # Guardar en disco
    ds.save_as(str(filename), write_like_original=False)

    _log(f"💾 Imagen almacenada en INBOX: {filename}")

    # Registrar modalidad en BD
    db = SessionLocal()
    register_modality(db, calling_ae, calling_ip, calling_port)
    db.close()

    # Responder éxito DICOM
    return 0x0000