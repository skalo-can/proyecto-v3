import os
from pathlib import Path
from pydantic_settings import BaseSettings

# ==========================================
# ⚓ ANCLA ABSOLUTA DE RUTAS (ANTI-FANTASMAS)
# ==========================================

# 1. Capturamos la ruta exacta de ESTE archivo en el disco duro
CURRENT_FILE = Path(__file__).resolve()

# 2. Subimos 3 niveles para anclarnos EXACTAMENTE en la carpeta 'backend'
BACKEND_DIR = CURRENT_FILE.parent.parent.parent

# 3. Definimos los directorios maestros a partir del ancla
STATIC_DIR = BACKEND_DIR / "static"
DICOM_ARCHIVADOS_DIR = BACKEND_DIR / "dicom_archivados"

# 4. Definimos las subcarpetas oficiales dentro de static
AUDIOS_DIR = STATIC_DIR / "audios_dictado"
DICOMS_DIR = STATIC_DIR / "dicoms"
EXPORTS_DIR = STATIC_DIR / "exports"
PDF_REPORTS_DIR = STATIC_DIR / "pdf_reports"
THUMBNAILS_DIR = STATIC_DIR / "thumbnails"

# 5. Función de seguridad: Recrea las carpetas automáticamente si no existen
for directory in [AUDIOS_DIR, DICOMS_DIR, EXPORTS_DIR, PDF_REPORTS_DIR, THUMBNAILS_DIR, DICOM_ARCHIVADOS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


# ==========================================
# ⚙️ CONFIGURACIÓN DEL SISTEMA Y VARIABLES
# ==========================================

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Clínico"
    API_VERSION: str = "v1"
    GEMINI_API_KEY: str = ""  # <--- Llave de la API oficial

    class Config:
        env_file = ".env"
        extra = "ignore"  # <--- Evita que el sistema colapse si agregas más cosas al .env

settings = Settings()