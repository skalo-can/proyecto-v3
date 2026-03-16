"""
test_model.py
-------------
Modelo SQLAlchemy utilizado para pruebas internas dentro del sistema MI_PACS.

Responsabilidades:
- Proveer una tabla mínima para validación de migraciones, conexión a BD
  y pruebas de infraestructura.
- Permitir verificar que el ORM, la base de datos y los servicios
  funcionan correctamente antes de cargar modelos clínicos reales.

Este modelo actúa como capa intermedia entre:
- Scripts de prueba y validación
- Motor SQLAlchemy
- Base de datos (tabla test)

Notas clínicas:
- No forma parte del flujo clínico real.
- Se utiliza únicamente para pruebas técnicas y de desarrollo.
"""

from sqlalchemy import Column, Integer, String
from app.core.database import Base


class Test(Base):
    __tablename__ = "test"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        doc="Identificador interno del registro de prueba"
    )

    name = Column(
        String,
        index=True,
        doc="Campo de texto utilizado para pruebas básicas"
    )