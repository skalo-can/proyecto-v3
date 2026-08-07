from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel

from app.core.database import SessionLocal

from app.models.estudio_imagen import EstudioImagen

# Importamos funciones directamente del CRUD
from app.crud.secure_link_crud import (
    crear_link,
    obtener_por_token,
    registrar_descarga,
    revocar,
    listar_todos
)

from app.api.dicom_email_tools_api import generar_zip_dicom


router = APIRouter(tags=["Enlaces seguros"], prefix="/secure-links")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =========================================================
# FUNCIONES INTERNAS (HELPERS)
# =========================================================
def generar_link_para_estudio(estudio_id: int, db: Session) -> str:
    """Función interna utilizada por whatsapp_api.py y otros módulos."""
    archivo = generar_zip_dicom(estudio_id)

    link = crear_link(
        db=db,
        estudio_id=estudio_id,
        ruta_archivo=str(archivo),
        horas=48,
        max_descargas=5,
    )
    # Devolvemos el token. El Frontend armará la URL final.
    return link.token


# =========================================================
# 1) GENERAR LINK SEGURO (ENDPOINT)
# =========================================================
@router.post("/generar/{estudio_id}")
def generar_link_endpoint(estudio_id: int, db: Session = Depends(get_db)):
    # Reutilizamos la función interna de arriba
    token = generar_link_para_estudio(estudio_id, db)
    
    return {"status": "ok", "link": token}


# =========================================================
# 2) VALIDAR ESTADO DEL LINK
# =========================================================
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


# =========================================================
# 3) DESCARGAR ZIP (SI APLICA)
# =========================================================
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


# =========================================================
# 4) REVOCAR Y LISTAR
# =========================================================
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


# =========================================================
# 5) PORTAL PACIENTE: VALIDAR PIN (FECHA DE NACIMIENTO)
# =========================================================
# 📌 Esquema Pydantic para recibir los datos desde React
class ValidarPinRequest(BaseModel):
    token: str
    pin: str

@router.post("/validar-pin")
def validar_pin_paciente(request: ValidarPinRequest, db: Session = Depends(get_db)):
    # 1. Obtener el enlace por token usando la función CRUD existente
    link = obtener_por_token(db, request.token)

    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="ENLACE NO VÁLIDO O INEXISTENTE")

    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="EL ENLACE HA CADUCADO")

    # 2. Navegar hasta el paciente usando las relaciones de SQLAlchemy
    estudio = link.estudio
    if not estudio:
        raise HTTPException(status_code=404, detail="ESTUDIO NO ENCONTRADO")

    paciente = estudio.paciente
    if not paciente or not paciente.fecha_nacimiento:
        raise HTTPException(
            status_code=400, 
            detail="EL PACIENTE NO TIENE FECHA DE NACIMIENTO REGISTRADA"
        )

    # 3. Formatear la fecha de nacimiento a DDMMYYYY
    # %d = Día (01-31), %m = Mes (01-12), %Y = Año (ej. 1974)
    pin_esperado = paciente.fecha_nacimiento.strftime("%d%m%Y")

    # 4. Validar el PIN ingresado contra la fecha formateada
    if request.pin != pin_esperado:
        raise HTTPException(
            status_code=401, 
            detail="PIN INCORRECTO O IDENTIDAD NO VERIFICADA"
        )

    # 5. Respuesta exitosa con los datos necesarios para el frontend
    return {
        "acceso_permitido": True,
        "estudio": {
            "id": estudio.id,
            "paciente_nombre": f"{paciente.primer_nombre or ''} {paciente.primer_apellido or ''}".strip(),
            "modalidad": estudio.modalidad if hasattr(estudio, 'modalidad') else "N/A"
        }
    }

# =========================================================
# 6) LISTAR IMÁGENES PARA EL VISOR DEL PACIENTE
# =========================================================
@router.get("/imagenes/{token}")
def obtener_imagenes_paciente(token: str, db: Session = Depends(get_db)):
    link = obtener_por_token(db, token)

    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="ENLACE NO VÁLIDO")

    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="EL ENLACE HA CADUCADO")

    # Buscamos todas las imágenes que pertenecen a este estudio autorizado
    imagenes = (
        db.query(EstudioImagen)
        .filter(EstudioImagen.estudio_id == link.estudio_id)
        .order_by(EstudioImagen.id.asc())
        .all()
    )

    return imagenes

# =========================================================
# 7) DESCARGAR IMAGEN INDIVIDUAL (VISOR DICOM PACIENTE)
# =========================================================
@router.get("/stream/{imagen_id}")
def stream_imagen_paciente(imagen_id: int, token: str, db: Session = Depends(get_db)):
    # 1. Validar que el token sea correcto y no haya expirado
    link = obtener_por_token(db, token)
    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="ENLACE NO VÁLIDO")
    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="EL ENLACE HA CADUCADO")

    # 2. Buscar la imagen en la base de datos
    imagen = db.query(EstudioImagen).filter(EstudioImagen.id == imagen_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    # 3. 🛡️ BLINDAJE: Confirmar que la imagen pertenece al estudio del token
    if imagen.estudio_id != link.estudio_id:
        raise HTTPException(status_code=403, detail="No autorizado para ver esta imagen")

    # 4. Enviar el archivo DICOM al visor
    ruta = Path(imagen.ruta_archivo)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Archivo físico no encontrado")

    return FileResponse(path=ruta, media_type="application/dicom")

# =========================================================
# 8) DESCARGAR INFORME MÉDICO (PDF) PARA PACIENTE (BUSCADOR DIRECTO)
# =========================================================
@router.get("/informe/{token}")
def descargar_informe_paciente(token: str, db: Session = Depends(get_db)):
    link = obtener_por_token(db, token)
    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="ENLACE NO VÁLIDO")
    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="EL ENLACE HA CADUCADO")

    estudio = link.estudio
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    ruta_pdf = None
    paciente = estudio.paciente

    # Buscamos de forma inteligente usando la identificación del paciente (ej. 9728484)
    if paciente and paciente.identificacion:
        from glob import glob
        # Busca cualquier archivo PDF que contenga la cédula en la carpeta backend/static o subdirectorios
        coincidencias = glob(f"**/*{paciente.identificacion}*.pdf", recursive=True)
        if coincidencias:
            ruta_pdf = Path(coincidencias[0])

    if not ruta_pdf or not ruta_pdf.exists():
        raise HTTPException(status_code=404, detail="El archivo físico del informe no se encuentra en el servidor.")

    return FileResponse(
        path=str(ruta_pdf), 
        media_type="application/pdf",
        filename=ruta_pdf.name,
        content_disposition_type="inline" # 👈 Esto fuerza al navegador a abrirlo en vez de descargarlo
    )