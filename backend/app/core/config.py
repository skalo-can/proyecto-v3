from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Clínico"
    API_VERSION: str = "v1"
    GEMINI_API_KEY: str = ""  # <--- Agregamos la llave a la lista oficial

    class Config:
        env_file = ".env"
        extra = "ignore"  # <--- Evita que el sistema colapse si agregas más cosas al .env en el futuro

settings = Settings()