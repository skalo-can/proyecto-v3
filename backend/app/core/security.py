"""
security.py — Seguridad clínica MI_PACS (BLINDADO)
---------------------------------------
- Hash de contraseñas (bcrypt)
- Verificación de contraseñas
- Creación de tokens JWT de corta duración
- Obtención del usuario actual autenticado
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.usuario import Usuario

# ---------------------------------------------------------
# CONFIGURACIÓN DE HASH
# ---------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Genera hash seguro para almacenar en BD."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica contraseña ingresada vs hash almacenado."""
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------
# JWT
# ---------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def crear_token_acceso(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea un token JWT firmado clínicamente con expiración estricta."""
    to_encode = data.copy()

    # 🛡️ BLINDAJE: Reducimos la exposición. Si no se especifica tiempo, expira en 60 minutos máximo.
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=60))
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


# ---------------------------------------------------------
# OBTENER USUARIO ACTUAL
# ---------------------------------------------------------
def obtener_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Valida token y devuelve el usuario autenticado."""
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credenciales_invalidas

    except JWTError:
        raise credenciales_invalidas

    usuario = db.query(Usuario).filter(Usuario.email == email).first()

    if usuario is None or not usuario.activo:
        raise credenciales_invalidas

    return usuario