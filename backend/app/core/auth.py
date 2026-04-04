"""
auth.py
-------
Módulo clínico de autenticación del sistema MI_PACS corregido para SKALO.
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

# CONFIGURACIÓN JWT
SECRET_KEY = "MI_PACS_SUPER_SECRETO_2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# --- FUNCIÓN CORREGIDA ---
def autenticar_usuario(db: Session, identifier: str, password: str) -> Optional[Usuario]:
    """
    Autentica a un usuario buscando por EMAIL o por NOMBRE (para SKALO).
    """
    # Buscamos en ambas columnas para permitir identificadores sin @
    usuario = db.query(Usuario).filter(
        (Usuario.email == identifier) | (Usuario.nombre == identifier)
    ).first()

    if not usuario:
        return None

    if not verify_password(password, usuario.password_hash):
        return None

    return usuario

def crear_token(usuario: Usuario) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(usuario.id), "rol": usuario.rol, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Usuario:
    token = credentials.credentials
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
        raise HTTPException(status_code=403, detail="Usuario deshabilitado.")
    return usuario