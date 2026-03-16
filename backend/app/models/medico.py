"""
models/medico.py
----------------
Modelo SQLAlchemy para médicos registrados en MI_PACS.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Medico(Base):
    __tablename__ = "medicos"

    id = Column(Integer, primary_key=True, index=True)

    # ForeignKey REAL hacia usuarios.id
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    especialidad = Column(String(100), nullable=True)
    numero_licencia = Column(String(100), nullable=True)

    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    # Relación inversa con Usuario
    usuario = relationship("Usuario", back_populates="medico")

    # Relación inversa con EstudioIALog (uno a muchos)
    ia_logs = relationship(
        "EstudioIALog",
        back_populates="medico",
        passive_deletes=True
    )