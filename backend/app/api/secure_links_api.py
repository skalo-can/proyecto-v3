from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path

from app.core.database import SessionLocal
from app.core.config import settings

# Importamos funciones directamente
from app.crud.secure_link_crud import (
    crear_link,
    obtener_por_token,
    registrar_descarga,
    revocar,
)

from app.api.dicom_email_tools_api import generar_zip_dicom  # reutilizamos
from app.crud.secure_link_crud import listar_todos


router = APIRouter(tags=["Enlaces seguros"], prefix="/secure-links")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generar_link_para_estudio(estudio_id: int, db: Session) -> str:
    archivo = generar_zip_dicom(estudio_id)

    link = crear_link(
        db=db,
        estudio_id=estudio_id,
        ruta_archivo=str(archivo),
        horas=48,
        max_descargas=5,
    )

    url_base = (
        settings.BACKEND_CORS_ORIGINS[0]
        if settings.BACKEND_CORS_ORIGINS
        else "http://localhost:8000"
    )

    return f"{url_base}/api/secure-links/descargar/{link.token}"


@router.post("/generar/{estudio_id}")
def generar_link(estudio_id: int, db: Session = Depends(get_db)):
    url = generar_link_para_estudio(estudio_id, db=db)
    return {"status": "ok", "link": url}


@router.get("/validar/{token}")
def validar_link(token: str, db: Session = Depends(get_db)):
    link = obtener_por_token(db, token)

    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="Enlace no válido")

    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="Enlace expirado")

    return {
        "status": "ok",
        "estudio_id": link.estudio_id,
        "expira_en": link.expira_en,
        "descargas": link.descargas,
        "max_descargas": link.max_descargas,
    }


@router.get("/descargar/{token}")
def descargar_por_token(token: str, db: Session = Depends(get_db)):
    link = obtener_por_token(db, token)

    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="Enlace no válido")

    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="Enlace expirado")

    ruta = Path(link.ruta_archivo)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    registrar_descarga(db, link)

    return FileResponse(
        path=ruta,
        filename=ruta.name,
        media_type="application/zip",
    )


@router.post("/revocar/{token}")
def revocar_link(token: str, db: Session = Depends(get_db)):
    ok = revocar(db, token)

    if not ok:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")

    return {"status": "ok", "token": token, "revocado": True}

@router.get("/listar")
def listar_enlaces(db: Session = Depends(get_db)):
    enlaces = listar_todos(db)
    return enlaces
