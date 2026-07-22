# app/services/efilm_migration_service.py
import os
import pyodbc
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.ris_orden import RISOrden

def ejecutar_migracion_efilm(db: Session, config_sql: dict):
    """
    Se conecta a la base de datos de Efilm (SQL Server), extrae los estudios 
    y los mapea a la estructura de MI_PACS.
    """
    print(f"🚀 Iniciando conexión a Efilm SQL Server en {config_sql['host']}...")
    
    # Cadena de conexión estándar para SQL Server
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={config_sql['host']};"
        f"DATABASE={config_sql['database']};"
        f"UID={config_sql['usuario']};"
        f"PWD={config_sql['password']};"
    )
    
    try:
        # 1. Conectar a Efilm
        efilm_conn = pyodbc.connect(conn_str)
        cursor = efilm_conn.cursor()
        
        # 2. Consultar la tabla principal de Efilm (Generalmente 'Study' y 'Patient')
        # NOTA: Los nombres de las tablas de Efilm pueden variar ligeramente según la versión.
        query = """
            SELECT 
                p.PatientID, p.PatientName, p.PatientBirthDate, p.PatientSex,
                s.StudyInstanceUID, s.StudyDate, s.AccessionNumber, s.StudyDescription, s.ModalitiesInStudy
            FROM Patient p
            INNER JOIN Study s ON p.GUID = s.PatientGUID
        """
        cursor.execute(query)
        filas = cursor.fetchall()
        
        registros_importados = 0
        
        for fila in filas:
            cedula = str(fila.PatientID).strip()
            
            # 3. Crear o buscar el paciente en MI_PACS
            paciente = db.query(Paciente).filter(Paciente.identificacion == cedula).first()
            if not paciente:
                paciente = Paciente(
                    identificacion=cedula,
                    primer_nombre=str(fila.PatientName).replace("^", " "), # Efilm usa ^ para separar nombres
                    sexo=fila.PatientSex,
                    fecha_nacimiento=fila.PatientBirthDate,
                    estado_pacs="Importado"
                )
                db.add(paciente)
                db.commit()
                db.refresh(paciente)
            
            # 4. Registrar la orden/estudio heredado
            # Verificamos que no exista para no duplicar
            accession = str(fila.AccessionNumber) if fila.AccessionNumber else str(fila.StudyInstanceUID)[:15]
            estudio_existente = db.query(RISOrden).filter(RISOrden.accession_number == accession).first()
            
            if not estudio_existente:
                nueva_orden = RISOrden(
                    paciente_id=paciente.id,
                    accession_number=accession,
                    modalidad=str(fila.ModalitiesInStudy),
                    descripcion=str(fila.StudyDescription),
                    fecha_creacion=fila.StudyDate if fila.StudyDate else datetime.now(),
                    estado_ris="Importado", # 👈 ESTADO CLAVE PARA EL BACKUP
                    origen="EFILM_LEGACY"
                )
                db.add(nueva_orden)
                registros_importados += 1
                
        db.commit()
        print(f"✅ Migración de Metadatos Efilm completada: {registros_importados} estudios heredados registrados.")
        
        # 5. Aquí lanzaríamos el escaneo de la carpeta física de DICOMs de Efilm
        # para que se asocien a las carpetas de MI_PACS
        from app.dicom_utils.dicom_importer import importar_desde_directorio_externo
        ruta_dicoms_efilm = config_sql['ruta_archivos']
        if os.path.exists(ruta_dicoms_efilm):
            print(f"📂 Escaneando imágenes físicas en {ruta_dicoms_efilm}...")
            importar_desde_directorio_externo(ruta_dicoms_efilm)
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error crítico importando desde Efilm: {e}")
    finally:
        if 'efilm_conn' in locals():
            efilm_conn.close()