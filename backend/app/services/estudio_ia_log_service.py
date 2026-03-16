"""
estudio_ia_log_service.py
-------------------------
Servicio clínico para registrar solicitudes de análisis IA realizadas por médicos
dentro del sistema MI_PACS.

Cada registro permite trazabilidad completa:
- Estudio analizado
- Médico solicitante
- Fecha/hora
- Resultado IA serializado
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.estudio_ia_log import EstudioIALog


# ---------------------------------------------------------
# REGISTRAR SOLICITUD IA
# ---------------------------------------------------------
def registrar_solicitud_ia(db: Session, estudio_id: int, medico_id: int, resultado: dict):
    """
    Registra una solicitud de análisis IA realizada por un médico.

    Parámetros:
    - estudio_id: ID del estudio clínico analizado
    - medico_id: ID del médico solicitante
    - resultado: dict con el resultado IA serializado

    Retorna:
    - Objeto EstudioIALog recién creado
    """

    try:
        log = EstudioIALog(
            estudio_id=estudio_id,
            medico_id=medico_id,
            resultado_ia=resultado
        )

        db.add(log)
        db.commit()
        db.refresh(log)

        return log

    except SQLAlchemyError as e:
        db.rollback()
        raise RuntimeError(f"Error al registrar la solicitud IA: {str(e)}")