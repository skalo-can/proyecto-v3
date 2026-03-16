"""
modality.py
-----------
Modelo clínico para registrar las modalidades DICOM que se conectan a MI_PACS.
"""

from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base


class Modality(Base):
    __tablename__ = "modalities"

    id = Column(Integer, primary_key=True, index=True)

    # AE Title de la modalidad remota
    ae_title = Column(String, index=True)

    # Dirección IP de la modalidad
    ip = Column(String)

    # Puerto remoto
    port = Column(Integer)

    # Última vez que se conectó
    last_connection = Column(DateTime, default=datetime.utcnow)

    # Cantidad de estudios enviados (C-STORE)
    studies_sent = Column(Integer, default=0)