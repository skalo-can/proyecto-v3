"""
archivo_estudio.py
------------------
Modelo clínico para la gestión de archivos asociados a un estudio dentro
del sistema MI_PACS.

Responsabilidades:
- Registrar archivos clínicos (PDF, audio, texto, imágenes no DICOM)
- Asociar cada archivo a un estudio específico
- Mantener rutas relativas dentro de /static para acceso seguro
- Facilitar la trazabilidad y auditoría de documentos clínicos

Este modelo actúa como capa intermedia entre:
- Servicios de archivos (archivo_estudio_service.py)
- Endpoints FastAPI relacionados con estudios
- Base de datos SQLAlchemy (tabla archivos_estudio)

Notas clínicas:
- Permite almacenar múltiples archivos por estudio
- El campo `tipo` identifica el formato clínico (pdf, audio, txt, etc.)
- Es fundamental para reportes, audios de dictado y documentos adjuntos
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ArchivoEstudio(Base):
    __tablename__ = "archivos_estudio"

    id = Column(Integer, primary_key=True, index=True)
    estudio_id = Column(Integer, ForeignKey("estudios.id"))
    nombre_archivo = Column(String)
    ruta_archivo = Column(String)
    tipo = Column(String, nullable=True)