"""
auth.py
-------
Módulo clínico de autenticación del sistema MI_PACS corregido para SKALO (BLINDADO).
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.database import get_db
from app.models.usuario import Usuario

# =========================================================
# 🛡️ CONFIGURACIÓN JWT DE ALTA SEGURIDAD
# =========================================================
# Se extrae de variables de entorno (archivo .env). 
# NUNCA compartas ni subas tu .env a un repositorio.
SECRET_KEY = os.getenv(
    "SECRET_KEY", 
    "6f3b7d8e2a1c94508b4d3e2f1a9c8b7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b" # Fallback temporal ultraseguro
)
ALGORITHM = "HS256"

# 60 minutos de inactividad es el estándar máximo recomendado en entornos de salud.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# --- FUNCIÓN CORREGIDA Y SINCRONIZADA ---
def autenticar_usuario(db: Session, identifier: str, password: str) -> Optional[Usuario]:
    """
    Autentica a un usuario buscando por EMAIL o por USERNAME.
    """
    usuario = db.query(Usuario).filter(
        (Usuario.email == identifier) | (Usuario.username == identifier)
    ).first()

    if not usuario:
        return None

    if not verify_password(password, usuario.password):
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
        
    if getattr(usuario, 'is_active', True) is False:
        raise HTTPException(status_code=403, detail="Usuario deshabilitado por el administrador.")
        
    return usuario