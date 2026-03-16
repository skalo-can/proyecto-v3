from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class DicomModalidad(Base):
    __tablename__ = "dicom_modalidades"

    id = Column(Integer, primary_key=True, index=True)
    ae_title = Column(String, index=True)
    ip = Column(String)
    port = Column(Integer)
    last_connection = Column(DateTime, default=datetime.utcnow)
    studies_sent = Column(Integer, default=0)