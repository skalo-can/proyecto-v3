"""
archivo_estudio_service.py
--------------------------
Servicio clínico para la gestión de archivos asociados a un estudio
dentro del sistema MI_PACS.

Incluye:
- Registrar archivo (PDF, audio, texto, etc.)
- Consultar archivos por estudio

Este servicio actúa como capa intermedia entre:
- Endpoints FastAPI
- Modelos SQLAlchemy (ArchivoEstudio)
- Base de datos
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.archivo_estudio import ArchivoEstudio


# ---------------------------------------------------------
# GUARDAR ARCHIVO ASOCIADO A UN ESTUDIO
# ---------------------------------------------------------
def guardar_archivo(
    db: Session,
    estudio_id: int,
    nombre_archivo: str,
    ruta_archivo: str,
    tipo: str | None = None
) -> ArchivoEstudio:
    """
    Registra un archivo clínico asociado a un estudio.

    Parámetros:
    - estudio_id: ID del estudio
    - nombre_archivo: nombre físico del archivo
    - ruta_archivo: ruta relativa dentro de /static
    - tipo: tipo de archivo (pdf, audio, txt, etc.)

    Retorna:
    - Objeto ArchivoEstudio recién creado
    """
    try:
        archivo = ArchivoEstudio(
            estudio_id=estudio_id,
            nombre_archivo=nombre_archivo,
            ruta_archivo=ruta_archivo,
            tipo=tipo
        )

        db.add(archivo)
        db.commit()
        db.refresh(archivo)

        return archivo

    except SQLAlchemyError as e:
        db.rollback()
        raise RuntimeError(f"Error al registrar archivo del estudio: {str(e)}")


# ---------------------------------------------------------
# OBTENER ARCHIVOS POR ESTUDIO
# ---------------------------------------------------------
def obtener_archivos_por_estudio(db: Session, estudio_id: int) -> list[ArchivoEstudio]:
    """
    Devuelve todos los archivos asociados a un estudio clínico.
    """
    return (
        db.query(ArchivoEstudio)
        .filter(ArchivoEstudio.estudio_id == estudio_id)
        .order_by(ArchivoEstudio.id.asc())
        .all()
    )