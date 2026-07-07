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
from fastapi.security import OAuth2PasswordBearer

from app.core.database import get_db
from app.models.usuario import Usuario


# ---------------------------------------------------------
# CONFIGURACIÓN JWT CLÍNICA
# ---------------------------------------------------------
SECRET_KEY = "MI_PACS_SUPER_SECRETO_2024"  # Cambiar en producción
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login-usuario")


# ---------------------------------------------------------
# HASH DE CONTRASEÑAS
# ---------------------------------------------------------
def hash_password(password: str) -> str:
    """
    Genera un hash seguro para almacenar contraseñas clínicas.

    Responsabilidades:
    - Convertir la contraseña en texto plano en un hash irreversible
    - Utilizar bcrypt con configuración segura
    - Evitar almacenamiento inseguro de contraseñas

    Flujo clínico:
    - Se usa al crear usuarios (admin, médico, técnico)
    - Garantiza seguridad y cumplimiento normativo
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si la contraseña ingresada coincide con el hash almacenado.

    Responsabilidades:
    - Comparar contraseña ingresada vs hash guardado
    - Prevenir accesos no autorizados

    Flujo clínico:
    - Se usa en login de usuarios clínicos
    """
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------
# AUTENTICACIÓN DE USUARIO CLÍNICO
# ---------------------------------------------------------
def autenticar_usuario(db: Session, email: str, password: str) -> Optional[Usuario]:
    """
    Autentica a un usuario clínico mediante email y contraseña.

    Responsabilidades:
    - Buscar usuario por email
    - Validar contraseña
    - Retornar el usuario autenticado o None

    Flujo clínico:
    - Utilizado por /auth/login-usuario
    - Permite acceso a funciones clínicas protegidas
    """
    usuario = db.query(Usuario).filter(Usuario.email == email).first()

    if not usuario:
        return None

    # Corregido: Llamar a usuario.password en lugar de usuario.password_hash
    if not verify_password(password, usuario.password):
        return None

    return usuario


# ---------------------------------------------------------
# GENERACIÓN DE TOKEN JWT
# ---------------------------------------------------------
def crear_token(usuario: Usuario) -> str:
    """
    Genera un token JWT válido para sesiones clínicas.

    Responsabilidades:
    - Incluir ID del usuario (sub)
    - Incluir rol clínico (admin, médico, técnico)
    - Establecer expiración segura
    - Firmar el token con clave secreta

    Flujo clínico:
    - Se usa en login de usuarios clínicos
    - Permite acceso autenticado a endpoints protegidos
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
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Dependencia clínica que valida el token JWT y obtiene el usuario autenticado.

    Responsabilidades:
    - Decodificar el token JWT enviado por el frontend
    - Verificar expiración, integridad y firma del token
    - Extraer el ID del usuario clínico desde el campo `sub`
    - Consultar el usuario en la base de datos
    - Validar que el usuario exista y esté activo
    - Retornar el usuario autenticado para su uso en endpoints protegidos

    Flujo clínico MI_PACS:
    - Se utiliza en endpoints que requieren autenticación (médico, admin, técnico)
    - Permite controlar permisos y trazabilidad clínica
    - Garantiza que solo usuarios válidos accedan a estudios, reportes y funciones críticas

    Errores clínicos:
    - 401: Token inválido, expirado o manipulado
    - 403: Usuario deshabilitado por administración

    Esta función actúa como capa de seguridad central del sistema MI_PACS.
    """

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