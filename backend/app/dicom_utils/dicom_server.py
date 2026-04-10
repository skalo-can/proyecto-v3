from pathlib import Path
from pynetdicom import AE, evt, AllStoragePresentationContexts
from pynetdicom.sop_class import Verification, ModalityWorklistInformationFind
from pydicom.dataset import Dataset
from datetime import datetime

from app.core.database import SessionLocal
from app.crud.crud_modality import register_modality
from app.models.ris_orden import RISOrden

# Instancia global y configuración
dicom_server_instance = None
stop_flag = False
INBOX_PATH = Path("backend/dicom_inbox")

# Estado del servidor para el Dashboard
server_state = {
    "running": False,
    "ae_title": None,
    "port": None,
    "last_event": None,
    "logs": []
}

def _log(event: str):
    """Registrar eventos clínicos en memoria y consola."""
    server_state["last_event"] = event
    server_state["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] {event}")
    if len(server_state["logs"]) > 100: server_state["logs"].pop(0) # Limitar historial
    print(event)

# ---------------------------------------------------------
# HANDLERS DICOM (LOS MOTORES)
# ---------------------------------------------------------

def handle_echo(event):
    """Responder a C-ECHO (Verification)."""
    _log("📡 C-ECHO recibido y respondido correctamente.")
    return 0x0000

def handle_association(event):
    """Registro automático de modalidades al conectar."""
    calling_ae = event.assoc.requestor.ae_title.decode().strip()
    calling_ip = event.assoc.requestor.address
    calling_port = event.assoc.requestor.port
    _log(f"📡 Asociación iniciada → AE={calling_ae}, IP={calling_ip}")
    
    db = SessionLocal()
    register_modality(db, calling_ae, calling_ip, calling_port)
    db.close()

def handle_find(event):
    """Manejador de Worklist para AGFA NX."""
    _log("🔍 Consulta de Worklist (C-FIND) recibida.")
    db = SessionLocal()
    try:
        # Buscamos pacientes en estado 'Iniciado'
        ordenes_activas = db.query(RISOrden).filter(RISOrden.estado_ris == "Iniciado").all()
        _log(f"📋 Enviando {len(ordenes_activas)} órdenes a la modalidad.")

        for orden in ordenes_activas:
            ds = Dataset()
            ds.PatientName = f"{orden.apellido}^{orden.nombre}"
            ds.PatientID = str(orden.id_institucional)
            ds.PatientSex = orden.sexo if orden.sexo else 'O'
            ds.AccessionNumber = str(orden.accession_number)
            
            # Bloque obligatorio para estaciones de adquisición
            sps_step = Dataset()
            sps_step.Modality = orden.modalidad
            sps_step.ScheduledStationAETitle = "AGFA_NX" 
            sps_step.ScheduledProcedureStepStartDate = datetime.now().strftime('%Y%m%d')
            sps_step.ScheduledProcedureStepDescription = f"Estudio de {orden.modalidad}"
            
            ds.ScheduledProcedureStepSequence = [sps_step]
            ds.QueryRetrieveLevel = "WORKLIST"
            yield (0xFF00, ds)

    except Exception as e:
        _log(f"❌ Error en Worklist: {e}")
    finally:
        db.close()

def handle_store(event):
    """Procesar recepción de imágenes DICOM."""
    ds = event.dataset
    ds.file_meta = event.file_meta
    INBOX_PATH.mkdir(parents=True, exist_ok=True)

    filename = INBOX_PATH / f"{ds.SOPInstanceUID}.dcm"
    ds.save_as(str(filename), write_like_original=False)
    _log(f"💾 Imagen recibida y guardada: {ds.SOPInstanceUID[-8:]}.dcm")
    return 0x0000

# ---------------------------------------------------------
# CONTROL DEL CICLO DE VIDA
# ---------------------------------------------------------

def iniciar_dicom_server(ae_title: str, port: int):
    global dicom_server_instance, server_state
    ae = AE(ae_title=ae_title)
    
    ae.add_supported_context(Verification)
    ae.add_supported_context(ModalityWorklistInformationFind)
    ae.supported_contexts.extend(AllStoragePresentationContexts)

    handlers = [
        (evt.EVT_C_STORE, handle_store),
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_C_FIND, handle_find),
        (evt.EVT_ACCEPTED, handle_association),
    ]

    try:
        dicom_server_instance = ae.start_server(("", port), block=False, evt_handlers=handlers)
        server_state.update({"running": True, "ae_title": ae_title, "port": port})
        _log(f"🚀 Servidor DICOM+WORKLIST en línea (Puerto {port})")
    except Exception as e:
        server_state["running"] = False
        _log(f"❌ Error al iniciar: {e}")

def detener_dicom_server():
    global dicom_server_instance
    if dicom_server_instance:
        dicom_server_instance.shutdown()
        _log("🛑 Servidor DICOM detenido.")
    server_state["running"] = False