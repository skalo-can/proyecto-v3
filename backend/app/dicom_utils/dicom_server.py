from pathlib import Path
from pynetdicom import AE, evt, AllStoragePresentationContexts
from pynetdicom.sop_class import (
    Verification, 
    ModalityWorklistInformationFind,
    StudyRootQueryRetrieveInformationModelFind,
    PatientRootQueryRetrieveInformationModelFind 
)
from pydicom.dataset import Dataset
from datetime import datetime
import json

from app.core.database import SessionLocal
from app.crud.crud_modality import register_modality
from app.models.ris_orden import RISOrden

from pydicom.uid import generate_uid  # 🔥 AGREGAR ESTA LÍNEA AL INICIO DEL ARCHIVO

# 🔥 INYECTAMOS EL ANCLA ABSOLUTA (FANTASMA ELIMINADO)
from app.core.config import BACKEND_DIR

# Instancia global y configuración
dicom_server_instance = None
INBOX_PATH = BACKEND_DIR / "dicom_inbox"

server_state = {
    "running": False,
    "ae_title": None,
    "port": None,
    "last_event": None,
    "logs": []
}

def _log(event: str):
    server_state["last_event"] = event
    server_state["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] {event}")
    if len(server_state["logs"]) > 100: server_state["logs"].pop(0) 
    print(event)

# ---------------------------------------------------------
# HANDLERS DICOM
# ---------------------------------------------------------

def handle_echo(event):
    _log("📡 C-ECHO recibido y respondido correctamente.")
    return 0x0000

def handle_association(event):
    try:
        calling_ae_raw = event.assoc.requestor.ae_title
        calling_ae = calling_ae_raw.decode().strip() if isinstance(calling_ae_raw, bytes) else str(calling_ae_raw).strip()
        calling_ip = event.assoc.requestor.address
        calling_port = event.assoc.requestor.port
        _log(f"📡 Asociación iniciada → AE={calling_ae}, IP={calling_ip}")
        
        db = SessionLocal()
        register_modality(db, calling_ae, calling_ip, calling_port)
        db.close()
    except Exception as e:
        _log(f"⚠️ Error en registro de asociación: {e}")

def handle_find(event):
    """Manejador de consultas. Expone órdenes activas para la Worklist."""
    _log("🔍 Consulta DICOM (C-FIND) recibida.")
    identifier = event.identifier
    db = SessionLocal()
    
    # Obtenemos el nombre de la estación que nos está llamando (Ej: RADGEN)
    calling_ae_raw = event.assoc.requestor.ae_title
    calling_ae = calling_ae_raw.decode().strip() if isinstance(calling_ae_raw, bytes) else str(calling_ae_raw).strip()

    try:
        # 🔥 SOLUCIÓN 1: Ampliamos el filtro para incluir "En Espera"
        ordenes_activas = db.query(RISOrden).filter(
            RISOrden.estado_ris.in_(["En Espera", "Iniciado", "Programado"])
        ).all()
        
        _log(f"📋 Enviando {len(ordenes_activas)} órdenes activas a la modalidad.")

        for orden in ordenes_activas:
            ds = Dataset()
            ds.PatientName = f"{orden.apellido}^{orden.nombre}"
            ds.PatientID = str(orden.id_institucional)
            ds.AccessionNumber = str(orden.accession_number)
            
            # 🔥 SOLUCIÓN 2: Generamos el Study Instance UID obligatorio
            # (Si tu base de datos ya lo tiene, cámbialo por orden.study_uid)
            ds.StudyInstanceUID = generate_uid() 
            ds.RequestedProcedureID = str(orden.id_orden)
            
            sex_val = str(orden.sexo).upper() if orden.sexo else 'O'
            ds.PatientSex = sex_val[0] if sex_val[0] in ['M', 'F', 'O'] else 'O'
            
            metadata = getattr(orden, 'metadata_extra', None)
            
            if metadata:
                try:
                    campos_extras = json.loads(metadata)
                    for tag_key, valor in campos_extras.items():
                        if valor:
                            val_str = str(valor)
                            tag_lower = tag_key.lower()
                            
                            if tag_lower in ["patientbirthdate", "birthdate", "fechanacimiento", "fecha_nacimiento", "00100030"]:
                                clean_date = "".join(filter(str.isdigit, val_str))
                                if len(clean_date) == 8:
                                    ds.add_new((0x0010, 0x0030), 'DA', clean_date)
                            else:
                                try:
                                    setattr(ds, tag_key, val_str)
                                except:
                                    pass
                except Exception as e:
                    print(f"❌ Error al procesar JSON de metadata: {e}")

            sps_step = Dataset()
            sps_step.Modality = orden.modalidad
            
            # 🔥 SOLUCIÓN 3: Le respondemos a la estación con su propio AE Title
            sps_step.ScheduledStationAETitle = calling_ae 
            sps_step.ScheduledProcedureStepStartDate = datetime.now().strftime('%Y%m%d')
            sps_step.ScheduledProcedureStepStartTime = datetime.now().strftime('%H%M%S')
            sps_step.ScheduledProcedureStepDescription = f"Estudio de {orden.modalidad}"
            
            ds.ScheduledProcedureStepSequence = [sps_step]
            ds.QueryRetrieveLevel = "WORKLIST"

            # Completar los tags vacíos solicitados por el equipo
            for elem in identifier:
                if elem.tag not in ds:
                    ds.add(elem)

            yield (0xFF00, ds)
    except Exception as e:
        _log(f"❌ Error en C-FIND: {e}")
    finally:
        db.close()

def handle_store(event):
    try:
        ds = event.dataset
        ds.file_meta = event.file_meta
        INBOX_PATH.mkdir(parents=True, exist_ok=True)
        filename = INBOX_PATH / f"{ds.SOPInstanceUID}.dcm"
        ds.save_as(str(filename), write_like_original=False)
        _log(f"💾 Imagen recibida: {ds.SOPInstanceUID[-8:]}.dcm")
        return 0x0000
    except: return 0xC000

# ---------------------------------------------------------
# INICIO DEL SERVIDOR
# ---------------------------------------------------------

def iniciar_dicom_server(ae_title: str, port: int):
    global dicom_server_instance, server_state
    ae = AE(ae_title=ae_title)
    ae.add_supported_context(Verification)
    ae.add_supported_context(ModalityWorklistInformationFind)
    ae.add_supported_context(StudyRootQueryRetrieveInformationModelFind)
    ae.add_supported_context(PatientRootQueryRetrieveInformationModelFind)
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
        _log(f"🚀 Servidor DICOM Universal iniciado (Puerto {port})")
    except Exception as e:
        server_state["running"] = False
        _log(f"❌ Error al iniciar: {e}")

def detener_dicom_server():
    global dicom_server_instance
    if dicom_server_instance:
        dicom_server_instance.shutdown()
    server_state["running"] = False