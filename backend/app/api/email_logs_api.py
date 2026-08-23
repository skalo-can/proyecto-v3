from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud import email_log_crud
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

router = APIRouter(tags=["Email logs"], prefix="/email-logs")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/listar", response_model=list[dict])
def listar(
    limit: int = 100, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["admin", "recepcion", "superadmin"])
    
    resultados = email_log_crud.listar(db, limit=limit)
    output = []
    
    for l, pac in resultados:
        if pac:
            n_p = getattr(pac, 'primer_nombre', getattr(pac, 'nombre', getattr(pac, 'nombres', '')))
            a_p = getattr(pac, 'primer_apellido', getattr(pac, 'apellido', getattr(pac, 'apellidos', '')))
            paciente_nombre = f"{n_p} {a_p}".strip() or "Sin nombre"
        else:
            paciente_nombre = "Sin Asignar"

        output.append({
            "id": l.id,
            "estudio_id": l.estudio_id,
            "email": l.destino,
            "fecha": l.creado_en,
            "formato": l.formato,
            "asunto": l.asunto,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "tamano_bytes": l.tamano_bytes,
            "token_link": l.token_link,
            "paciente_nombre": paciente_nombre
        })
        
    return output


@router.get("/estudio/{estudio_id}", response_model=list[dict])
def listar_por_estudio(
    estudio_id: int, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])
    
    resultados = email_log_crud.listar_por_estudio(db, estudio_id)
    output = []
    
    for l, pac in resultados:
        if pac:
            n_p = getattr(pac, 'primer_nombre', getattr(pac, 'nombre', getattr(pac, 'nombres', '')))
            a_p = getattr(pac, 'primer_apellido', getattr(pac, 'apellido', getattr(pac, 'apellidos', '')))
            paciente_nombre = f"{n_p} {a_p}".strip() or "Sin nombre"
        else:
            paciente_nombre = "Sin Asignar"

        output.append({
            "id": l.id,
            "estudio_id": l.estudio_id,
            "email": l.destino,
            "fecha": l.creado_en,
            "formato": l.formato,
            "asunto": l.asunto,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "tamano_bytes": l.tamano_bytes,
            "token_link": l.token_link,
            "paciente_nombre": paciente_nombre
        })
        
    return output


@router.get("/email/{email}", response_model=list[dict])
def listar_por_email(
    email: str, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)
):
    requiere_rol(usuario, ["admin", "medico", "recepcion"])
    
    resultados = email_log_crud.listar_por_email(db, email)
    output = []
    
    for l, pac in resultados:
        if pac:
            n_p = getattr(pac, 'primer_nombre', getattr(pac, 'nombre', getattr(pac, 'nombres', '')))
            a_p = getattr(pac, 'primer_apellido', getattr(pac, 'apellido', getattr(pac, 'apellidos', '')))
            paciente_nombre = f"{n_p} {a_p}".strip() or "Sin nombre"
        else:
            paciente_nombre = "Sin Asignar"

        output.append({
            "id": l.id,
            "estudio_id": l.estudio_id,
            "email": l.destino,
            "fecha": l.creado_en,
            "formato": l.formato,
            "asunto": l.asunto,
            "estado": l.estado,
            "detalle_error": l.detalle_error,
            "tamano_bytes": l.tamano_bytes,
            "token_link": l.token_link,
            "paciente_nombre": paciente_nombre
        })
        
    return output