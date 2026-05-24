"""
usuario.py
----------
Modelo SQLAlchemy consolidado para usuarios del sistema MI_PACS.
Corregido para compatibilidad con esquemas de FastAPI y matriz de permisos JSON.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Usuario(Base):
    """
    Modelo de usuario clínico del sistema MI_PACS.
    Representa a médicos, administradores y técnicos con permisos granulares.
    """

    __tablename__ = "usuarios"

    # ---------------------------------------------------------
    # Identificadores y Autenticación
    # ---------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True, doc="ID interno del usuario")
    
    nombre = Column(String(150), nullable=False, doc="Nombre completo del colaborador")
    
    username = Column(String(50), unique=True, nullable=False, index=True, doc="Nombre de usuario para login")
    
    email = Column(String(150), unique=True, nullable=True, index=True, doc="Correo electrónico opcional")

    # Aumentado a 255 para soportar hashes seguros (bcrypt/argon2)
    password = Column(String(255), nullable=False, doc="Contraseña encriptada (Hash)")

    # ---------------------------------------------------------
    # Rol y Matriz de Permisos
    # ---------------------------------------------------------
    # Lo dejamos flexible para aceptar: superadmin, admin, tecnologo, radiologo, etc.
    rol = Column(String(50), nullable=False, doc="Rol institucional del usuario")

    # Almacena la matriz de booleanos de permisos enviada desde el Frontend
    permisos = Column(JSON, default={}, doc="Matriz de permisos específicos por usuario")

    # ---------------------------------------------------------
    # Estado y Auditoría (Sincronizado con esquemas Pydantic)
    # ---------------------------------------------------------
    # IMPORTANTE: Mantener 'is_active' para evitar ResponseValidationError
    is_active = Column(Boolean, default=True, nullable=False, doc="Estado de acceso al sistema")

    creado_en = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        doc="Fecha de registro inicial"
    )

    actualizado_en = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        doc="Fecha de último cambio automático"
    )

    # ---------------------------------------------------------
    # Relaciones
    # ---------------------------------------------------------
    # Asegúrate de que el modelo 'Medico' tenga el back_populates correspondiente
    medico = relationship(
        "Medico", 
        back_populates="usuario", 
        uselist=False, 
        doc="Relación opcional con perfil de especialidad médica"
    )  