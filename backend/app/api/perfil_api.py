from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import json
import os

# Creamos el enrutador para el perfil
router = APIRouter(prefix="/api/perfil", tags=["Perfil Institucional"])

# El archivo donde se guardará la configuración física de la clínica (Marca Blanca)
CONFIG_FILE = "perfil_institucion.json"

# Modelo estricto de validación de datos
class PerfilInstitucion(BaseModel):
    nombre_clinica: str
    nit_registro: str
    direccion: str
    telefono: str
    email: str
    sitio_web: str
    modalidades_activas: List[str]

# Datos por defecto si el sistema está recién instalado
DEFAULT_PROFILE = {
    "nombre_clinica": "MI_PACS Institución Base",
    "nit_registro": "000000000-0",
    "direccion": "Dirección no configurada",
    "telefono": "0000000",
    "email": "admin@mipacs.local",
    "sitio_web": "www.mipacs.local",
    "modalidades_activas": ["CR", "DX", "US"]
}

@router.get("/")
def obtener_perfil():
    """Devuelve la configuración actual de la clínica."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error leyendo perfil: {e}")
            return DEFAULT_PROFILE
    return DEFAULT_PROFILE

@router.put("/")
def actualizar_perfil(perfil: PerfilInstitucion):
    """Guarda la nueva configuración de la clínica."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            # Convertimos el modelo a diccionario y lo guardamos en un JSON físico
            json.dump(perfil.dict(), f, indent=4, ensure_ascii=False)
        return {"mensaje": "Perfil actualizado exitosamente", "perfil": perfil.dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando perfil: {str(e)}")