"""
crud/reporte.py — MI_PACS
Operaciones de Base de Datos (CRUD) para la gestión de reportes PDF.
"""

from sqlalchemy.orm import Session
from app.models.reporte import Reporte
from app.models.estudio import Estudio

def crear_registro_reporte(db: Session, estudio_id: int, pdf_path: str) -> Reporte:
    """
    Crea un registro en la tabla 'reportes_pdf' con la ruta del archivo generado
    y actualiza el estado del estudio clínico a 'Firmado'.
    """
    # 1. Crear la instancia del nuevo reporte PDF
    nuevo_reporte = Reporte(
        estudio_id=estudio_id,
        pdf_path=pdf_path
    )
    db.add(nuevo_reporte)
    
    # 2. Buscar el estudio asociado para actualizar su flujo clínico
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if estudio:
        estudio.esta_firmado = True
        estudio.estado_pacs = "Firmado"  # Modifica el estado en el PACS
        
    # 3. Confirmar los cambios en la base de datos de forma segura
    db.commit()
    db.refresh(nuevo_reporte)
    
    return nuevo_reporte

def obtener_reporte_por_estudio(db: Session, estudio_id: int) -> Reporte | None:
    """
    Busca si un estudio ya tiene un reporte PDF generado en la base de datos.
    """
    return db.query(Reporte).filter(Reporte.estudio_id == estudio_id).first()