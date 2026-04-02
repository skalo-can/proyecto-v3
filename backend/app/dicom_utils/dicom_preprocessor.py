import os
from pathlib import Path
from pydicom import dcmread

def is_dicom_file(path: Path) -> bool:
    """Detecta si un archivo es DICOM aunque no tenga extensión."""
    try:
        with open(path, "rb") as f:
            preamble = f.read(132)
            return preamble[128:132] == b"DICM"
    except:
        return False


def import_from_folder(folder_path: str, inbox_path: str):
    """
    Importa archivos desde CD/USB/carpeta y los convierte a .dcm
    para que el procesador clínico los maneje.
    """
    folder = Path(folder_path)
    inbox = Path(inbox_path)
    inbox.mkdir(parents=True, exist_ok=True)

    imported = 0

    for root, dirs, files in os.walk(folder):
        for file in files:
            full_path = Path(root) / file

            if is_dicom_file(full_path):
                try:
                    ds = dcmread(full_path, force=True)
                except:
                    continue

                sop_uid = getattr(ds, "SOPInstanceUID", None)
                if not sop_uid:
                    continue

                out_file = inbox / f"{sop_uid}.dcm"
                ds.save_as(out_file, write_like_original=False)
                imported += 1

    return imported