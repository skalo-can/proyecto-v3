from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.paciente import Paciente
from app.models.estudio import Estudio


def busqueda_global(db: Session, texto: str, limit: int, offset: int):
    texto_like = f"%{texto}%"

    # Buscar en pacientes
    pacientes_query = (
        db.query(Paciente)
        .filter(
            or_(
                Paciente.nombre.ilike(texto_like),
                Paciente.apellido.ilike(texto_like),
                Paciente.documento.ilike(texto_like),
            )
        )
    )

    # Buscar en estudios
    estudios_query = (
        db.query(Estudio)
        .filter(
            or_(
                Estudio.modality.ilike(texto_like),
                Estudio.descripcion.ilike(texto_like),
            )
        )
    )

    pacientes_total = pacientes_query.count()
    estudios_total = estudios_query.count()

    pacientes = pacientes_query.offset(offset).limit(limit).all()
    estudios = estudios_query.offset(offset).limit(limit).all()

    return {
        "pacientes_total": pacientes_total,
        "estudios_total": estudios_total,
        "pacientes": pacientes,
        "estudios": estudios,
    }