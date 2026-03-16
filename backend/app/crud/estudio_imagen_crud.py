"""
estudio_imagen_crud.py
----------------------
Operaciones CRUD para manejar imágenes asociadas a un estudio clínico
dentro del sistema MI_PACS.
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException

from app.models.estudio_imagen import EstudioImagen
from app.schemas.estudio_imagen import EstudioImagenCreate


def create_estudio_imagen(db: Session, data: EstudioImagenCreate):
    """
    Crea un registro de imagen asociada a un estudio clínico.

    Flujo clínico MI_PACS:
    - Convierte el schema Pydantic en un objeto SQLAlchemy
    - Maneja errores de base de datos con rollback seguro
    - Devuelve el objeto persistido para uso inmediato en el visor
    """
    try:
        # Crear objeto SQLAlchemy desde el schema
        db_obj = EstudioImagen(
            estudio_id=data.estudio_id,
            ruta_archivo=data.ruta_archivo,
            dicom_metadata=data.dicom_metadata,
            thumbnail=data.thumbnail
        )

        # Guardar en DB
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        return db_obj

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al registrar la imagen en la base de datos: {str(e)}"
        )