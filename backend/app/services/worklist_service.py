from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind
from pydicom.dataset import Dataset
import sqlite3

# 1. Configuración de Conexión
AE_TITLE_RIS = "MI_PACS_RIS"
PUERTO = 11112  # Usamos 11112 para evitar conflictos de permisos en Windows

def handle_find(event):
    """Esta función se ejecuta cuando la AGFA presiona 'Refresh'"""
    query = event.identifier
    
    # Conectar a tu base de datos real
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # BUSCAMOS: Pacientes que la secretaria ya marcó como "Iniciados"
    # y que están esperando ser atendidos hoy
    cursor.execute("""
        SELECT nombre, apellido, id_institucional, modalidad, accession_number 
        FROM worklist_orders 
        WHERE estado_ris = 'Iniciado'
    """)
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        nombre, apellido, patient_id, modality, acc_num = row
        
        # Creamos el paquete de datos que entiende la AGFA
        ds = Dataset()
        ds.PatientName = f"{apellido}^{nombre}"
        ds.PatientID = str(patient_id)
        ds.AccessionNumber = str(acc_num)
        ds.Modality = modality
        
        # Datos requeridos por AGFA para el flujo de trabajo
        # (Scheduled Procedure Step Sequence)
        sps_step = Dataset()
        sps_step.Modality = modality
        sps_step.ScheduledStationAETitle = "AGFA_NX" # Debe coincidir con tu equipo
        sps_step.ScheduledProcedureStepStartDate = "20260409" # Fecha actual
        ds.ScheduledProcedureStepSequence = [sps_step]
        
        ds.QueryRetrieveLevel = "WORKLIST"

        yield (0xFF00, ds) # Enviamos el paciente a la AGFA

# 2. Inicializar el Servidor DICOM
ae = AE(ae_title=AE_TITLE_RIS)
ae.add_supported_context(ModalityWorklistInformationFind)

handlers = [(evt.EVT_C_FIND, handle_find)]

print(f"🚀 Servidor Worklist iniciado en el puerto {PUERTO}...")
print(f"📡 AE Title: {AE_TITLE_RIS}")
ae.start_server(('', PUERTO), evt_handlers=handlers)