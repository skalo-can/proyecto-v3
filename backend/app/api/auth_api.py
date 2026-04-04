"""
auth_api.py — MI_PACS
---------------------------------------------------------
Endpoints clínicos de autenticación actualizados para SKALO.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import autenticar_usuario, crear_token
from app.core.security import get_password_hash, verify_password

from app.models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ---------------------------------------------------------
# LOGIN USUARIO CLÍNICO (Soporta Email o Nombre de Usuario)
# ---------------------------------------------------------
@router.post("/login")
def login_endpoint(
    credenciales: dict,
    db: Session = Depends(get_db)
):
    """
    Autenticación clínica general.
    Permite entrar con 'admin@mipacs.com' o con 'SKALO'.
    """

    identifier = credenciales.get("email") # El frontend suele enviar el campo como "email"
    password = credenciales.get("password")

    # 1. Buscamos al usuario por Email o por Nombre (para soportar a SKALO)
    usuario = db.query(Usuario).filter(
        (Usuario.email == identifier) | (Usuario.nombre == identifier)
    ).first()

    # 2. Verificamos contraseña usando la lógica de seguridad del core
    if not usuario or not verify_password(password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciales inválidas."
        )

    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo.")

    # 3. Generamos el token JWT
    token_str = crear_token(usuario)

    # 4. Estructura de respuesta plana para sincronizar con AuthContext.jsx
    return {
        "access_token": token_str,
        "token_type": "bearer",
        "user": {
            "id": usuario.id,
            "username": usuario.email if "@" in usuario.email else usuario.nombre,
            "nombre": usuario.nombre,
            "rol": usuario.rol, # Aquí viajará 'superadmin' o 'admin'
            "activo": usuario.activo
        }
    }


# ---------------------------------------------------------
# REGISTRO DE USUARIOS (Solo Admin o Superadmin)
# ---------------------------------------------------------
@router.post("/registrar")
def registrar_usuario_endpoint(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Registro clínico de usuarios.
    """

    existente = db.query(Usuario).filter(Usuario.email == data["email"]).first()
    if existente:
        raise HTTPException(status_code=400, detail="El email ya está registrado.")

    nuevo = Usuario(
        nombre=data["nombre"],
        email=data["email"],
        password_hash=get_password_hash(data["password"]),
        rol=data["rol"],
        activo=True,
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "id": nuevo.id,
        "nombre": nuevo.nombre,
        "email": nuevo.email,
        "rol": nuevo.rol,
        "activo": nuevo.activo
    }