from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.usuario import Usuario
from app.core.security import get_password_hash 
from app.schemas.usuario import UsuarioResponse, UsuarioListItem

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.post("/crear-perfil")
async def crear_perfil(data: dict, db: Session = Depends(get_db)):
    existente = db.query(Usuario).filter(Usuario.username == data.get('username')).first()
    if existente:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe.")

    raw_password = data.get('password', "123456")
    hashed_password = get_password_hash(raw_password)

    nuevo_usuario = Usuario(
        nombre=data.get('nombre'),
        username=data.get('username'),
        email=data.get('email'), 
        rol=data.get('rol'),
        registro_medico=data.get('registro_medico', ""),
        permisos=data.get('permisos', {}),
        password=hashed_password, 
        is_active=True,
        # 🔥 EL OFICINISTA AHORA GUARDA EL SUPERPODER
        es_urgenciologo=data.get('es_urgenciologo', False) 
    )
    
    try:
        db.add(nuevo_usuario)
        db.commit()
        return {"status": "success", "id": nuevo_usuario.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 PARCHE: Acepta la ruta con y sin el slash final para evitar errores 404 en React
@router.get("", response_model=List[UsuarioListItem])
@router.get("/", response_model=List[UsuarioListItem], include_in_schema=False)
def listar_usuarios_endpoint(db: Session = Depends(get_db)):
    return db.query(Usuario).all()

@router.put("/{usuario_id}")
async def actualizar_usuario(usuario_id: int, data: dict, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if usuario.username == "SKALO" and data.get("is_active") is False:
        raise HTTPException(status_code=400, detail="No puedes desactivar al usuario Maestro.")

    usuario.nombre = data.get('nombre', usuario.nombre)
    usuario.username = data.get('username', usuario.username)
    usuario.email = data.get('email', usuario.email)
    usuario.rol = data.get('rol', usuario.rol)
    usuario.registro_medico = data.get('registro_medico', usuario.registro_medico)
    usuario.is_active = data.get('is_active', usuario.is_active)
    usuario.permisos = data.get('permisos', usuario.permisos)
    
    # 🔥 EL OFICINISTA AHORA ACTUALIZA EL SUPERPODER
    usuario.es_urgenciologo = data.get('es_urgenciologo', usuario.es_urgenciologo)

    if data.get('password'):
        usuario.password = get_password_hash(data.get('password'))

    db.commit()
    return {"status": "success", "message": "Usuario actualizado correctamente"}

@router.patch("/{usuario_id}/estado")
def cambiar_estado_usuario(usuario_id: int, activo: bool, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.username == "SKALO":
         raise HTTPException(status_code=400, detail="El estado de SKALO no puede ser alterado.")

    user.is_active = activo
    db.commit()
    return {"status": "success", "activo": activo}

@router.delete("/{usuario_id}")
async def eliminar_usuario(usuario_id: int, db: Session = Depends(get_db)):
    """
    Elimina permanentemente un colaborador de la base de datos.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if usuario.username.upper() == "SKALO":
        raise HTTPException(
            status_code=400, 
            detail="⚠️ El usuario Maestro (SKALO) no puede ser eliminado por seguridad del sistema."
        )

    try:
        db.delete(usuario)
        db.commit()
        return {"status": "success", "message": "Colaborador eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar: {str(e)}")