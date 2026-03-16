"""
reset_db_moderno.py
-----------------------------------------
Reset externo del sistema MI_PACS.
Se ejecuta desde la carpeta /backend y NO depende
de los routers internos. Usa email como identificador.
-----------------------------------------
"""

import os
import sys
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------
# 📌 Ajustar rutas para importar correctamente app/*
# ---------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))   # .../backend

# Añadir backend/ al sys.path
sys.path.append(BASE_DIR)

# ---------------------------------------------------------
# 📌 Importaciones del backend moderno
# ---------------------------------------------------------
from app.core.config import settings
from app.models.base import Base
from app.models.usuario import Usuario


# ---------------------------------------------------------
# 🔧 Crear motor y sesión
# ---------------------------------------------------------
DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------
# 🔐 Función para generar hash seguro
# ---------------------------------------------------------
def generar_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ---------------------------------------------------------
# 🚀 Reset clínico moderno
# ---------------------------------------------------------
def resetear_sistema():
    print("🚀 Ejecutando reset clínico moderno desde terminal...")

    # 1. Eliminar todas las tablas
    print("🧨 Eliminando todas las tablas antiguas...")
    Base.metadata.drop_all(bind=engine)

    # 2. Crear tablas modernas
    print("🧱 Creando tablas modernas...")
    Base.metadata.create_all(bind=engine)

    # 3. Crear usuario administrador moderno
    print("👨‍⚕️ Creando usuario administrador clínico...")

    hashed_password = generar_hash("admin123")

    admin_user = Usuario(
        nombre="Administrador",
        email="admin@admin.com",
        hashed_password=hashed_password,
        rol="admin",
        activo=True,
    )

    db = SessionLocal()
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    print("✅ Usuario administrador creado correctamente:")
    print(f"   ID: {admin_user.id}")
    print(f"   Email: {admin_user.email}")
    print(f"   Rol: {admin_user.rol}")

    print("\n🎉 Reset clínico moderno completado con éxito.\n")


# ---------------------------------------------------------
# 🏁 Ejecutar si se llama desde terminal
# ---------------------------------------------------------
if __name__ == "__main__":
    resetear_sistema()