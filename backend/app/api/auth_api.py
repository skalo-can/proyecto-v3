"""
auth_api.py — MI_PACS (BLINDADO)
---------------------------------------------------------
Autenticación robusta con mitigación de ataques de enumeración.
"""

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
    # 🛡️ NORMALIZACIÓN: Evitamos revelar si el fallo es el usuario o la contraseña
    identifier = credenciales.get("email") or credenciales.get("username")
    password = credenciales.get("password")

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Credenciales incompletas."
        )

    # 1. Búsqueda segura
    usuario = db.query(Usuario).filter(
        or_(Usuario.email == identifier, Usuario.username == identifier)
    ).first()

    # 2. Verificación de contraseña + Verificación de estado 
    # Usamos un mensaje unificado "Credenciales inválidas" para ambos casos
    if not usuario or not verify_password(password, usuario.password) or not usuario.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciales inválidas o cuenta inactiva."
        )

    # 3. Generación de token
    token_str = crear_token(usuario)

    # 4. RESPUESTA BLINDADA: Solo enviamos lo estrictamente necesario
    # Evitamos enviar todo el objeto usuario (como permisos completos) si no es vital.
    return {
        "access_token": token_str,
        "token_type": "bearer",
        "user": {
            "id": usuario.id,
            "username": usuario.username,
            "rol": usuario.rol,
            "es_urgenciologo": getattr(usuario, "es_urgenciologo", False),
            # 'permisos' se debería gestionar mediante roles en el backend, 
            # no enviando la matriz completa al frontend en el login.
        }
    }