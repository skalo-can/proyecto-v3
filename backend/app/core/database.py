"""
database.py
-----------
Módulo central de configuración de la base de datos para MI_PACS.

Responsabilidades:
- Definir la ruta absoluta del archivo SQLite.
- Crear el engine SQLAlchemy.
- Crear la sesión de base de datos (SessionLocal).
- Proveer la función get_db() para FastAPI.
- Definir la Base declarativa para los modelos.

Este archivo es utilizado por:
- reset_db_service.py
- Todos los modelos SQLAlchemy
- Todos los endpoints FastAPI que requieren acceso a la base
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# ---------------------------------------------------------
# RUTA ABSOLUTA A LA BASE DE DATOS
# ---------------------------------------------------------
# Esto garantiza que FastAPI siempre use la misma base,
# sin importar desde qué directorio se ejecute la aplicación.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "database.db"))

# SQLAlchemy requiere el prefijo sqlite:/// para rutas relativas
# y sqlite://// para rutas absolutas.
DATABASE_URL = f"sqlite:///{DB_FILE_PATH}"


# ---------------------------------------------------------
# ENGINE (motor de conexión)
# ---------------------------------------------------------
# check_same_thread=False permite que SQLite funcione con FastAPI
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)


# ---------------------------------------------------------
# SESIÓN DE BASE DE DATOS
# ---------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ---------------------------------------------------------
# BASE DECLARATIVA
# ---------------------------------------------------------
# Todos los modelos SQLAlchemy deben heredar de Base
Base = declarative_base()


# ---------------------------------------------------------
# DEPENDENCIA PARA FASTAPI
# ---------------------------------------------------------
def get_db():
    """
    Provee una sesión de base de datos para cada request FastAPI.

    Uso:
        db: Session = Depends(get_db)

    Garantiza:
    - Apertura de sesión por request
    - Cierre automático al finalizar
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()