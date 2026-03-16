"""
security.py
-----------
Dependencias clínicas para control de acceso basado en roles.
"""

from fastapi import Depends, HTTPException
from app.core.auth import obtener_usuario_actual
from app.models.usuario import Usuario


def requiere_rol(roles_requeridos):
    """
    Dependencia clínica para proteger endpoints según rol.

    Permite:
    - Un solo rol:  requiere_rol("admin")
    - Múltiples roles: requiere_rol(["admin", "medico"])

    Validaciones:
    ✔ Usuario autenticado
    ✔ Usuario activo
    ✔ Rol permitido
    """

    # Normalizar a lista
    if isinstance(roles_requeridos, str):
        roles_requeridos = [roles_requeridos]

    def wrapper(usuario: Usuario = Depends(obtener_usuario_actual)):

        # Validar estado del usuario
        if hasattr(usuario, "activo") and usuario.activo is False:
            raise HTTPException(
                status_code=403,
                detail="Acceso denegado: el usuario está deshabilitado."
            )

        # Validar rol
        if usuario.rol not in roles_requeridos:
            raise HTTPException(
                status_code=403,
                detail=f"Acceso denegado: se requiere uno de los roles {roles_requeridos}."
            )

        return usuario

    return wrapper