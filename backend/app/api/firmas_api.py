import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.firma import FirmaRadiologo
from app.core.auth import obtener_usuario_actual

router = APIRouter(prefix="/firmas", tags=["Firmas Digitales"])

# 1. RUTA ABSOLUTA DE PRODUCCIÓN (Para que el servidor nunca se pierda)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CARPETA_FIRMAS = os.path.join(BASE_DIR, "storage", "firmas_seguras")
os.makedirs(CARPETA_FIRMAS, exist_ok=True)

# Límite y Tipos Permitidos
MAX_FILE_SIZE = 2 * 1024 * 1024 
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
}

# 2. TOLERANCIA DE RUTAS: Aceptamos la petición con o sin slash al final
@router.post("/{usuario_id}")
@router.post("/{usuario_id}/", include_in_schema=False)
async def subir_firma(
    usuario_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    usuario_actual = Depends(obtener_usuario_actual)
):
    # 3. EL PARCHE MAESTRO: Permitir que el Administrador (SKALO) asigne firmas a otros médicos
    es_admin = (getattr(usuario_actual, "rol", "") == "Administrador" or usuario_actual.username == "SKALO")
    
    if usuario_actual.id != usuario_id and not es_admin:
        raise HTTPException(status_code=403, detail="Alerta de Seguridad: No está autorizado para modificar la firma de otro usuario.")

    try:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail="El archivo no es una imagen real o está corrupto.")

        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="La firma es demasiado pesada. Máximo permitido: 2MB.")

        extension_real = ALLOWED_MIME_TYPES[file.content_type]
        nombre_seguro = f"firma_user_{usuario_id}{extension_real}"
        ruta_destino = os.path.join(CARPETA_FIRMAS, nombre_seguro)

        with open(ruta_destino, "wb") as f:
            f.write(contents)

        # Actualizar o crear registro en Base de Datos
        firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario_id).first()
        if firma_db:
            firma_db.nombre_archivo = nombre_seguro
        else:
            nueva_firma = FirmaRadiologo(usuario_id=usuario_id, nombre_archivo=nombre_seguro)
            db.add(nueva_firma)
        
        db.commit()
        return {"status": "success", "mensaje": "Firma almacenada y protegida con éxito."}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno al procesar la firma: {str(e)}")


@router.get("/{usuario_id}")
@router.get("/{usuario_id}/", include_in_schema=False)
def obtener_firma(
    usuario_id: int, 
    db: Session = Depends(get_db),
    usuario_actual = Depends(obtener_usuario_actual)
):
    es_admin = (getattr(usuario_actual, "rol", "") == "Administrador" or usuario_actual.username == "SKALO")
    
    if usuario_actual.id != usuario_id and not es_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado a firmas de terceros.")

    firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario_id).first()
    if not firma_db:
        raise HTTPException(status_code=404, detail="Firma no encontrada")
    
    return {"usuario_id": firma_db.usuario_id, "archivo": firma_db.nombre_archivo}