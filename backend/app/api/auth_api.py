"""
auth_api.py — MI_PACS
---------------------------------------------------------
Endpoints clínicos de autenticación.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import autenticar_usuario, crear_token
from app.core.security import get_password_hash

from app.models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ---------------------------------------------------------
# LOGIN USUARIO CLÍNICO
# ---------------------------------------------------------
@router.post("/login")
def login_endpoint(
    credenciales: dict,
    db: Session = Depends(get_db)
):
    """
    Autenticación clínica general.
    Retorna token JWT y datos del usuario.
    """

    email = credenciales.get("email")
    password = credenciales.get("password")

    usuario = autenticar_usuario(db, email, password)

    if not usuario:
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    # crear_token devuelve un STRING
    token_str = crear_token(usuario)

    # Estructura EXACTA que el frontend espera
    return {
        "token": {
            "access_token": token_str,
            "token_type": "bearer",
            "expires_in": 3600
        },
        "usuario": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "rol": usuario.rol,
            "activo": usuario.activo
        }
    }


# ---------------------------------------------------------
# REGISTRO DE USUARIOS (solo admin)
# ---------------------------------------------------------
@router.post("/registrar")
def registrar_usuario_endpoint(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Registro clínico de usuarios.
    Solo administradores deben usar este endpoint.
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