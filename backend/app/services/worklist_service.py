from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind
from pydicom.dataset import Dataset
from datetime import datetime
import sqlite3

# 1. Configuración de Conexión
AE_TITLE_RIS = "MI_PACS_RIS"
PUERTO = 11112 

def handle_find(event):
    """Esta función responde a las peticiones C-FIND (Worklist)"""
    # Intentamos conectar a la base de datos
    try:
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        # Filtro crítico: Solo enviamos lo que la secretaria inició
        # y que el tecnólogo NO ha marcado como 'Atendido' todavía.
        cursor.execute("""
            SELECT nombre, apellido, id_institucional, modalidad, accession_number 
            FROM worklist_orders 
            WHERE estado_ris = 'Iniciado'
        """)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        print(f"❌ Error al consultar base de datos: {e}")
        return

    for row in rows:
        nombre, apellido, patient_id, modality, acc_num = row
        
        # Crear Dataset DICOM
        ds = Dataset()
        ds.PatientName = f"{apellido}^{nombre}"
        ds.PatientID = str(patient_id)
        ds.AccessionNumber = str(acc_num)
        ds.Modality = modality
        
        # --- Scheduled Procedure Step Sequence (Obligatorio para AGFA/PACS) ---
        sps_step = Dataset()
        sps_step.Modality = modality
        sps_step.ScheduledStationAETitle = "AGFA_NX"
        sps_step.ScheduledProcedureStepStartDate = datetime.now().strftime('%Y%m%d')
        sps_step.ScheduledProcedureStepStartTime = datetime.now().strftime('%H%M%S')
        sps_step.ScheduledProcedureStepDescription = f"Estudio {modality}"
        sps_step.ScheduledProcedureStepID = str(acc_num)
        
        ds.ScheduledProcedureStepSequence = [sps_step]
        ds.QueryRetrieveLevel = "WORKLIST"

        # Notificar en consola que estamos enviando el paciente
        print(f"📦 Enviando a Worklist: {ds.PatientName} [Acc: {acc_num}]")
        
        yield (0xFF00, ds)

# 2. Inicializar el Servidor DICOM
ae = AE(ae_title=AE_TITLE_RIS)
ae.add_supported_context(ModalityWorklistInformationFind)

handlers = [(evt.EVT_C_FIND, handle_find)]

print("--------------------------------------------------")
print(f"🚀 Servidor Worklist MI_PACS activo")
print(f"📡 AE Title: {AE_TITLE_RIS} | Puerto: {PUERTO}")
print("--------------------------------------------------")

# Iniciar el servidor (Bloqueante)
ae.start_server(('', PUERTO), evt_handlers=handlers)