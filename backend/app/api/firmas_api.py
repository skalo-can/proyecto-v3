import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.firma import FirmaRadiologo

router = APIRouter(prefix="/firmas", tags=["Firmas Digitales"])

# Carpeta local segura en el servidor donde se guardarán las firmas
CARPETA_FIRMAS = "backend/storage/firmas_seguras"
os.makedirs(CARPETA_FIRMAS, exist_ok=True)

@router.post("/{usuario_id}")
async def subir_firma(usuario_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            raise HTTPException(status_code=400, detail="Formato de imagen no válido. Use PNG o JPG.")

        nombre_seguro = f"firma_user_{usuario_id}{os.path.splitext(file.filename)[1]}"
        ruta_destino = os.path.join(CARPETA_FIRMAS, nombre_seguro)

        contents = await file.read()
        with open(ruta_destino, "wb") as f:
            f.write(contents)

        firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario_id).first()
        if firma_db:
            firma_db.nombre_archivo = nombre_seguro
        else:
            nueva_firma = FirmaRadiologo(usuario_id=usuario_id, nombre_archivo=nombre_seguro)
            db.add(nueva_firma)
        
        db.commit()
        return {"status": "success", "mensaje": "Firma almacenada de forma segura localmente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar la firma: {str(e)}")

@router.get("/{usuario_id}")
def obtener_firma(usuario_id: int, db: Session = Depends(get_db)):
    firma_db = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario_id).first()
    if not firma_db:
        raise HTTPException(status_code=404, detail="Firma no encontrada")
    
    return {"usuario_id": firma_db.usuario_id, "archivo": firma_db.nombre_archivo}