import os
from pathlib import Path
from pydicom import dcmread
from app.models.estudio import Estudio
from sqlalchemy.orm import Session

def is_dicom_file(path: Path) -> bool:
    """Detecta si un archivo es DICOM real (lee el preámbulo 'DICM')."""
    try:
        with open(path, "rb") as f:
            preamble = f.read(132)
            return preamble[128:132] == b"DICM"
    except:
        return False

def process_dicom_import(folder_path: str, storage_path: str, db: Session, user_id: int = None):
    """
    Escanea la carpeta del CD/USB, extrae metadatos y registra en la DB.
    """
    folder = Path(folder_path)
    storage = Path(storage_path)
    storage.mkdir(parents=True, exist_ok=True)
    imported_count = 0

    for root, dirs, files in os.walk(folder):
        for file in files:
            full_path = Path(root) / file
            
            if is_dicom_file(full_path):
                try:
                    # 'force=True' es vital para archivos de CD sin meta-header estándar
                    ds = dcmread(full_path, force=True)
                    
                    # Usamos StudyInstanceUID para agrupar las imágenes del estudio
                    study_uid = str(getattr(ds, "StudyInstanceUID", ""))
                    sop_uid = str(getattr(ds, "SOPInstanceUID", ""))
                    
                    if not study_uid: continue

                    # Guardar el archivo físicamente en tu almacenamiento local (D:\...)
                    final_path = storage / f"{sop_uid or 'img'}.dcm"
                    ds.save_as(final_path, write_like_original=False)

                    # Evitar duplicados: Si el UID ya existe, no lo volvemos a insertar
                    existente = db.query(Estudio).filter(Estudio.uid == study_uid).first()
                    
                    if not existente:
                        nuevo = Estudio(
                            paciente_id=1, # TODO: Vincular con búsqueda de Paciente por PatientID
                            tipo_estudio=str(getattr(ds, "Modality", "OT")),
                            fecha_estudio=getattr(ds, "StudyDate", "20260414"),
                            uid=study_uid,
                            estado="procesado",
                            usuario_id=user_id # Esto alimenta tus gráficas de Productividad
                        )
                        db.add(nuevo)
                        imported_count += 1
                except Exception as e:
                    print(f"⚠️ Saltando archivo corrupto {file}: {e}")
                    continue
    
    db.commit()
    return imported_count