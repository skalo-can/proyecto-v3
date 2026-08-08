import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.firma import FirmaRadiologo
from app.core.auth import obtener_usuario_actual # 🔥 Importación clave para seguridad

router = APIRouter(prefix="/firmas", tags=["Firmas Digitales"])

# Carpeta local segura
CARPETA_FIRMAS = "backend/storage/firmas_seguras"
os.makedirs(CARPETA_FIRMAS, exist_ok=True)

# 🛡️ LÍMITE DE SEGURIDAD: 2 Megabytes
MAX_FILE_SIZE = 2 * 1024 * 1024 

# 🛡️ DICCIONARIO DE TIPOS MIME (El ADN del archivo)
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
}

@router.post("/{usuario_id}")
async def subir_firma(
    usuario_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    usuario_actual = Depends(obtener_usuario_actual) # 🛡️ Bloqueo de suplantación
):
    # 1. PREVENCIÓN IDOR: Nadie puede subir firmas en nombre de otro médico
    if usuario_actual.id != usuario_id:
        raise HTTPException(status_code=403, detail="Alerta de Seguridad: No está autorizado para modificar la firma de otro usuario.")

    try:
        # 2. VERIFICACIÓN DE TIPO MIME (Ignoramos la extensión que diga el usuario)
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail="El archivo no es una imagen real o está corrupto.")

        # 3. VERIFICACIÓN DE TAMAÑO EN MEMORIA (Prevención de caída del servidor)
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="La firma es demasiado pesada. Máximo permitido: 2MB.")

        # 4. RENOMBRADO SEGURO (Descartamos por completo el nombre original del archivo)
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
        # Relanzamos las excepciones controladas (errores de seguridad)
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al procesar la firma.")


@router.get("/{usuario_id}")
def obtener_firma(
    usuario_id: int, 
    db: Session = Depends(get_db),
    usuario_actual = Depends(obtener_usuario_actual) # 🛡️ Privacidad médica
):
    # Opcional: Proteger también la lectura para que solo el propio médico (o administradores) puedan verla
    if usuario_actual.id != usuario_id:
        raise HTTPException(status_code=403, detail="Acceso denegado a firmas de terceros.")

    firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario_id).first()
    if not firma_db:
        raise HTTPException(status_code=404, detail="Firma no encontrada")
    
    return {"usuario_id": firma_db.usuario_id, "archivo": firma_db.nombre_archivo}