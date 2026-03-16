from sqlalchemy.orm import Session
from app.models.medico import Medico

def crear_medico_por_defecto(db: Session):
    """
    Crea un médico clínico por defecto si no existe.
    """

    medico_email = "medico@mipacs.com"

    medico = db.query(Medico).filter(Medico.email == medico_email).first()
    if medico:
        return medico

    nuevo_medico = Medico(
        nombre="sadat karim luna osorio",
        email=medico_email,
        especialidad="Radiología",
        activo=True,
    )

    db.add(nuevo_medico)
    db.commit()
    db.refresh(nuevo_medico)

    return nuevo_medico