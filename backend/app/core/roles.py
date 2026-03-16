"""
roles.py
--------
Middleware clínico para validar permisos según el rol del usuario
dentro del sistema MI_PACS.

Este módulo se utiliza para:
- Restringir acceso a endpoints según rol clínico
- Garantizar que solo personal autorizado ejecute acciones críticas
- Mantener trazabilidad y seguridad hospitalaria

Roles soportados:
- admin
- medico
- tecnico
- transcriptora
- paciente
"""

from fastapi import HTTPException
from app.models.usuario import Usuario


def requiere_rol(usuario: Usuario, roles_permitidos: list[str]) -> bool:
    """
    Valida que el usuario autenticado posea uno de los roles permitidos.

    Parámetros:
        usuario (Usuario):
            Usuario autenticado obtenido desde el token JWT.
        roles_permitidos (list[str]):
            Lista de roles autorizados para acceder al endpoint.

    Excepciones:
        HTTPException 401:
            Si no existe un usuario autenticado.
        HTTPException 403:
            Si el usuario no posee un rol autorizado.
    """

    # ---------------------------------------------------------
    # Validación clínica: usuario no autenticado
    # ---------------------------------------------------------
    if usuario is None or not hasattr(usuario, "rol"):
        raise HTTPException(
            status_code=401,
            detail="No autenticado. Se requiere un usuario válido."
        )

    # ---------------------------------------------------------
    # Validación clínica: rol no autorizado
    # ---------------------------------------------------------
    if usuario.rol not in roles_permitidos:
        raise HTTPException(
            status_code=403,
            detail=f"Acceso denegado. Rol requerido: {roles_permitidos}"
        )

    # Validación superada
    return True