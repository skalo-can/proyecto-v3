"""
dicom_modalities_api.py
-----------------------
Endpoint clínico para consultar las modalidades DICOM registradas
en la base de datos.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.crud.crud_modality import get_modalities

router = APIRouter(prefix="/api/dicom", tags=["DICOM"])

@router.get("/connected-modalities")
def connected_modalities(db: Session = Depends(get_db)):
    modalidades = get_modalities(db)

    return {
        "modalities": [
            {
                "ae_title": m.ae_title,
                "ip": m.ip,
                "port": m.port,
                "last_connection": m.last_connection,
                "studies_sent": m.studies_sent,
            }
            for m in modalidades
        ]
    }