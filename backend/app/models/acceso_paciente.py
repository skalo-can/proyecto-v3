"""
acceso_paciente.py
------------------
Modelo clínico para gestionar accesos temporales de pacientes dentro del
sistema MI_PACS.

Responsabilidades:
- Registrar tokens temporales para acceso seguro del paciente
- Asociar cada token a un estudio clínico específico
- Controlar expiración automática del enlace
- Mantener trazabilidad y seguridad hospitalaria

Este modelo actúa como capa intermedia entre:
- Servicios de enlaces seguros (email, portal del paciente)
- Endpoints de acceso público controlado
- Base de datos SQLAlchemy (tabla accesos_paciente)

Notas clínicas:
- Cada token permite acceso temporal a un estudio sin requerir login
- El campo `expira_en` garantiza que el enlace caduque automáticamente
- Es fundamental para flujos de entrega de resultados a pacientes
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timedelta
from app.core.database import Base


class AccesoPaciente(Base):
    __tablename__ = "accesos_paciente"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id"))
    estudio_id = Column(Integer, ForeignKey("estudios.id"))
    expira_en = Column(DateTime)