"""
auth.py
-------
Módulo clínico de autenticación del sistema MI_PACS.

Responsabilidades:
- Gestionar el hash y verificación de contraseñas clínicas
- Autenticar usuarios (médicos, técnicos, administradores)
- Generar tokens JWT seguros para sesiones clínicas
- Validar tokens y obtener el usuario autenticado
- Integrarse con FastAPI como dependencia de seguridad

Este módulo actúa como capa central de seguridad del sistema MI_PACS.
"""

from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.database import get_db
from app.models.usuario import Usuario


# ---------------------------------------------------------
# CONFIGURACIÓN JWT CLÍNICA
# ---------------------------------------------------------
SECRET_KEY = "MI_PACS_SUPER_SECRETO_2024"  # Cambiar en producción
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 🔥 Esquema correcto para Swagger y JWT
oauth2_scheme = HTTPBearer()


# ---------------------------------------------------------
# HASH DE CONTRASEÑAS
# ---------------------------------------------------------
def hash_password(password: str) -> str:
    """
    Genera un hash seguro para almacenar contraseñas clínicas.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si la contraseña ingresada coincide con el hash almacenado.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------
# AUTENTICACIÓN DE USUARIO CLÍNICO
# ---------------------------------------------------------
def autenticar_usuario(db: Session, email: str, password: str) -> Optional[Usuario]:
    """
    Autentica a un usuario clínico mediante email y contraseña.
    """
    usuario = db.query(Usuario).filter(Usuario.email == email).first()

    if not usuario:
        return None

    if not verify_password(password, usuario.password_hash):
        return None

    return usuario


# ---------------------------------------------------------
# GENERACIÓN DE TOKEN JWT
# ---------------------------------------------------------
def crear_token(usuario: Usuario) -> str:
    """
    Genera un token JWT válido para sesiones clínicas.
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(usuario.id),
        "rol": usuario.rol,
        "exp": expire
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


# ---------------------------------------------------------
# OBTENER USUARIO ACTUAL (JWT)
# ---------------------------------------------------------
def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Valida el token JWT y obtiene el usuario autenticado.

    Flujo clínico:
    - Extrae el token desde Authorization: Bearer <token>
    - Decodifica el JWT
    - Verifica expiración e integridad
    - Obtiene el usuario desde la BD
    """

    token = credentials.credentials  # 🔥 Extraemos el token real

    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario_id: str = payload.get("sub")

        if usuario_id is None:
            raise credenciales_invalidas

    except JWTError:
        raise credenciales_invalidas

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()

    if usuario is None:
        raise credenciales_invalidas

    if usuario.activo is False:
        raise HTTPException(
            status_code=403,
            detail="Usuario deshabilitado. Contacte al administrador."
        )

    return usuario