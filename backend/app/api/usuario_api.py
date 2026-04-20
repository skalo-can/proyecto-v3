from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.usuario import Usuario
from app.core.security import get_password_hash # ¡IMPORTANTE!
from app.schemas.usuario import UsuarioResponse, UsuarioListItem

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.post("/crear-perfil")
async def crear_perfil(data: dict, db: Session = Depends(get_db)):
    # 1. Verificación de duplicados
    existente = db.query(Usuario).filter(Usuario.username == data.get('username')).first()
    if existente:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe.")

    # 2. Encriptación de contraseña (Vital para que el Login funcione)
    raw_password = data.get('password', "123456")
    hashed_password = get_password_hash(raw_password)

    nuevo_usuario = Usuario(
        nombre=data.get('nombre'),
        username=data.get('username'),
        email=data.get('email'), # Agregamos email que faltaba
        rol=data.get('rol'),
        permisos=data.get('permisos', {}),
        password=hashed_password, # Guardamos el Hash, no el texto plano
        is_active=True
    )
    
    try:
        db.add(nuevo_usuario)
        db.commit()
        return {"status": "success", "id": nuevo_usuario.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[UsuarioListItem])
def listar_usuarios_endpoint(db: Session = Depends(get_db)):
    # Traemos todos los usuarios para la tabla administrativa
    return db.query(Usuario).all()

# --- NUEVO: ENDPOINT PARA EDITAR Y RECUPERAR CONTRASEÑAS ---
@router.put("/{usuario_id}")
async def actualizar_usuario(usuario_id: int, data: dict, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Impedir que se bloquee accidentalmente a SKALO (Seguridad Maestro)
    if usuario.username == "SKALO" and data.get("is_active") is False:
        raise HTTPException(status_code=400, detail="No puedes desactivar al usuario Maestro.")

    # Actualizar campos básicos
    usuario.nombre = data.get('nombre', usuario.nombre)
    usuario.username = data.get('username', usuario.username)
    usuario.email = data.get('email', usuario.email)
    usuario.rol = data.get('rol', usuario.rol)
    usuario.is_active = data.get('is_active', usuario.is_active)
    usuario.permisos = data.get('permisos', usuario.permisos)

    # Si el administrador (SKALO) envía una nueva contraseña
    if data.get('password'):
        usuario.password = get_password_hash(data.get('password'))

    db.commit()
    return {"status": "success", "message": "Usuario actualizado correctamente"}

@router.patch("/{usuario_id}/estado")
def cambiar_estado_usuario(usuario_id: int, activo: bool, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Protección para SKALO
    if user.username == "SKALO":
         raise HTTPException(status_code=400, detail="El estado de SKALO no puede ser alterado.")

    user.is_active = activo
    db.commit()
    return {"status": "success", "activo": activo}