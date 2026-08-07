"""
acceso_paciente.py
------------------
Modelo clínico para AUDITORÍA de accesos de pacientes dentro del
sistema MI_PACS.

Responsabilidades:
- Mantener trazabilidad y seguridad hospitalaria (Logs).
- Registrar intentos exitosos, fallidos y bloqueos por fuerza bruta.
- Capturar IP, dispositivo y fecha exacta del intento.
"""

from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class AccesoPaciente(Base):
    __tablename__ = "auditoria_accesos_paciente"

    id = Column(Integer, primary_key=True, index=True)
    token_usado = Column(String, index=True)    # El token que intentaron usar
    ip_cliente = Column(String)                 # 🕵️ IP desde donde se conectan
    user_agent = Column(String)                 # 📱 Navegador o modelo del celular
    estado = Column(String)                     # 🟢 ÉXITO, 🔴 FALLIDO, ⛔ BLOQUEADO
    detalle = Column(String)                    # Motivo exacto (Ej: "PIN incorrecto")
    fecha_intento = Column(DateTime, default=datetime.utcnow) # Cuándo ocurrió