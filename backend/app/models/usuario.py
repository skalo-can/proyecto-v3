"""
usuario.py — MI_PACS (Versión de Producción Unificada y Segura con JWT)
--------------------------------------------------------------------------------
Modelo SQLAlchemy consolidado para usuarios del sistema MI_PACS.
Corregido para compatibilidad con esquemas de FastAPI y matriz de permisos JSON.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
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
    
    nombre = Column(String(150), nullable=False, doc="Nombre completo y apellidos del colaborador")
    
    username = Column(String(50), unique=True, nullable=False, index=True, doc="Nombre de usuario para login")
    
    email = Column(String(150), unique=True, nullable=True, index=True, doc="Correo electrónico opcional")

    password = Column(String(255), nullable=False, doc="Contraseña encriptada (Hash)")

    # ---------------------------------------------------------
    # Rol, Registro Médico y Matriz de Permisos
    # ---------------------------------------------------------
    rol = Column(String(50), nullable=False, doc="Rol institucional del usuario")

    # 🆕 NUEVA COLUMNA: Almacena el Registro Médico del profesional (solo radiólogos/médicos)
    registro_medico = Column(String(50), nullable=True, default="", doc="Registro Médico / Cédula Profesional")

    permisos = Column(JSON, default={}, doc="Matriz de permisos específicos por usuario")

    # ---------------------------------------------------------
    # Estado y Auditoría (Sincronizado con esquemas Pydantic)
    # ---------------------------------------------------------
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
    medico = relationship(
        "Medico", 
        back_populates="usuario", 
        uselist=False, 
        doc="Relación opcional con perfil de especialidad médica"
    )  

    # ---------------------------------------------------------
    # Puentes de Compatibilidad
    # ---------------------------------------------------------
    @hybrid_property
    def activo(self) -> bool:
        """Mapea dinámicamente 'activo' a 'is_active' sin alterar la base de datos física."""
        return self.is_active

    @activo.setter
    def activo(self, value: bool):
        self.is_active = value