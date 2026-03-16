"""
env.py — Alembic / MI_PACS
--------------------------

Archivo de configuración principal para Alembic.

Responsabilidades:
- Cargar la configuración desde alembic.ini
- Registrar el metadata global del sistema MI_PACS
- Ejecutar migraciones en modo offline u online
- Integrarse con SQLAlchemy y la estructura modular del backend

Notas clínicas:
- Este archivo es fundamental para mantener la integridad del esquema
  de la base de datos a medida que MI_PACS evoluciona.
- Todas las migraciones automáticas dependen de target_metadata.
"""

import sys
import os

# Asegurar que el backend esté en el path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# ---------------------------------------------------------
# Cargar configuración desde alembic.ini
# ---------------------------------------------------------
config = context.config

# Configurar logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------
# Registrar metadata de MI_PACS
# ---------------------------------------------------------
from app.core.database import Base
target_metadata = Base.metadata


# ---------------------------------------------------------
# Modo OFFLINE
# ---------------------------------------------------------
def run_migrations_offline() -> None:
    """
    Ejecuta migraciones en modo offline.

    - No requiere conexión a la base de datos.
    - Genera SQL puro basado en el metadata.
    """
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------
# Modo ONLINE
# ---------------------------------------------------------
def run_migrations_online() -> None:
    """
    Ejecuta migraciones en modo online.

    - Crea un engine real
    - Ejecuta migraciones directamente sobre la base de datos
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


# ---------------------------------------------------------
# Selección automática del modo
# ---------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()