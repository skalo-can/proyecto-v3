import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# ==========================================
# ⚓ ANCLA ABSOLUTA DE RUTAS Y CARGA FORZADA .ENV
# ==========================================

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent

# 🔥 FORZAMOS LA CARGA DEL .ENV DESDE LA RAÍZ EXPLÍCITAMENTE
env_path = ROOT_DIR / ".env"
load_dotenv(dotenv_path=env_path)

# (Opcional por si acaso está en backend)
load_dotenv(dotenv_path=BACKEND_DIR / ".env")

# 3. Definimos los directorios maestros a partir del ancla
STATIC_DIR = BACKEND_DIR / "static"
DICOM_ARCHIVADOS_DIR = BACKEND_DIR / "dicom_archivados"

AUDIOS_DIR = STATIC_DIR / "audios_dictado"
DICOMS_DIR = STATIC_DIR / "dicoms"
EXPORTS_DIR = STATIC_DIR / "exports"
PDF_REPORTS_DIR = STATIC_DIR / "pdf_reports"
THUMBNAILS_DIR = STATIC_DIR / "thumbnails"

for directory in [AUDIOS_DIR, DICOMS_DIR, EXPORTS_DIR, PDF_REPORTS_DIR, THUMBNAILS_DIR, DICOM_ARCHIVADOS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# ==========================================
# ⚙️ CONFIGURACIÓN DEL SISTEMA Y VARIABLES
# ==========================================
class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Clínico"
    API_VERSION: str = "v1"
    
    # 🔥 Forzamos a que tome el valor directamente del entorno de sistema si Pydantic duda
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # 🛡️ NUEVO: Variables Críticas de Seguridad para los Tokens JWT
    # Si no encuentra la llave en el .env, usa una por defecto (útil para desarrollo, pero debe existir en .env para producción)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
    ALGORITHM: str = "HS256"

    class Config:
        env_file = str(env_path)
        extra = "ignore"

settings = Settings()