from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.auth import crear_token
from app.core.security import verify_password
from app.models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login")
def login_endpoint(credenciales: dict, db: Session = Depends(get_db)):
    """
    Autenticación MI_PACS.
    Soporta entrar con Email o con Username (para SKALO).
    """
    # El frontend puede enviar 'email' o 'username', capturamos el valor
    identifier = credenciales.get("email") or credenciales.get("username")
    password = credenciales.get("password")

    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Faltan credenciales")

    # 1. Buscamos al usuario por Email O por Username (CRÍTICO para SKALO)
    usuario = db.query(Usuario).filter(
        or_(Usuario.email == identifier, Usuario.username == identifier)
    ).first()

    # 2. Verificamos contraseña (Cambiado password_hash por password)
    if not usuario or not verify_password(password, usuario.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciales inválidas."
        )

    # 3. Verificamos estado (Cambiado activo por is_active)
    if not usuario.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo o bloqueado.")

    # 4. Generamos el token JWT
    token_str = crear_token(usuario)

    # 5. Respuesta sincronizada con el LocalStorage y AuthContext
    return {
        "access_token": token_str,
        "token_type": "bearer",
        "user": {
            "id": usuario.id,
            "username": usuario.username,
            "nombre": usuario.nombre,
            "rol": usuario.rol,
            "is_active": usuario.is_active,
            "registro_medico": getattr(usuario, "registro_medico", "") or "", 
            # 🔥 EL NUEVO SÚPER PODER EN EL TOKEN DE SESIÓN
            "es_urgenciologo": getattr(usuario, "es_urgenciologo", False),
            "permisos": usuario.permisos # Enviamos la matriz de 25 botones
        }
    }