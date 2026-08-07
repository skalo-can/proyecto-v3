from fastapi import APIRouter, Depends, HTTPException, Request
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

from app.models.acceso_paciente import AccesoPaciente

router = APIRouter(tags=["Enlaces seguros"], prefix="/secure-links")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =========================================================
# FUNCIÓN AUXILIAR DE AUDITORÍA (ACTUALIZADA Y FUNCIONAL)
# =========================================================
def registrar_auditoria(db: Session, referencia: str, ip: str, user_agent: str, estado: str, detalle: str):
    """
    Guarda cada intento de acceso permanentemente en la base de datos
    para cumplir con normativas de ciberseguridad médica.
    """
    try:
        nuevo_log = AccesoPaciente(
            token_usado=str(referencia),
            ip_cliente=ip,
            user_agent=user_agent,
            estado=estado,
            detalle=detalle
        )
        db.add(nuevo_log)
        db.commit()
    except Exception as e:
        print(f"⚠️ Error guardando auditoría: {e}")
        db.rollback()


# =========================================================
# FUNCIONES INTERNAS (HELPERS)
# =========================================================
def generar_link_para_estudio(estudio_id: int, db: Session, dias_validez: int = 30, max_vistas: int = 4) -> str:
    """Función interna utilizada por whatsapp_api.py y otros módulos."""
    archivo = generar_zip_dicom(estudio_id)

    # Asegúrate de que `crear_link` en tu crud/secure_link_crud.py acepte estos nuevos parámetros
    link = crear_link(
        db=db,
        estudio_id=estudio_id,
        ruta_archivo=str(archivo),
        dias_validez=dias_validez, # Reemplaza el antiguo 'horas' para hacerlo configurable
        max_vistas=max_vistas,     # Nuevo límite de visualizaciones
        max_descargas=5,
    )
    return link.token


# =========================================================
# 1) GENERAR LINK SEGURO (ENDPOINT)
# =========================================================
class GenerarLinkParams(BaseModel):
    dias_validez: int = 30
    max_vistas: int = 4

@router.post("/generar/{estudio_id}")
def generar_link_endpoint(estudio_id: int, params: GenerarLinkParams = Depends(), db: Session = Depends(get_db)):
    # Pasamos los parámetros configurables de tiempo y usos máximos
    token = generar_link_para_estudio(estudio_id, db, params.dias_validez, params.max_vistas)
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
# 5) PORTAL PACIENTE: VALIDAR PIN Y AUDITAR
# =========================================================
class ValidarPinRequest(BaseModel):
    token: str
    pin: str

@router.post("/validar-pin")
def validar_pin_paciente(request_data: ValidarPinRequest, request: Request, db: Session = Depends(get_db)):
    ip_cliente = request.client.host
    user_agent = request.headers.get("user-agent", "Desconocido")

    # 1. Obtener el enlace por token
    link = obtener_por_token(db, request_data.token)

    if not link:
        registrar_auditoria(db, request_data.token, ip_cliente, user_agent, "FALLIDO", "Enlace inexistente")
        raise HTTPException(status_code=404, detail="ENLACE NO VÁLIDO O INEXISTENTE")

    # 🛡️ 2. Validación de Expiración por Tiempo (Revisar primero)
    if datetime.utcnow() > link.expira_en:
        if link.activo:
            link.activo = False
            db.commit()
        registrar_auditoria(db, link.id, ip_cliente, user_agent, "BLOQUEADO", "Enlace expirado por tiempo")
        raise HTTPException(status_code=410, detail="EL ENLACE EXPIRÓ POR TIEMPO")

    # 🛡️ 3. Control contra Fuerza Bruta (Intentos fallidos)
    if hasattr(link, 'intentos_fallidos') and getattr(link, 'intentos_fallidos', 0) >= 4:
        if link.activo:
            link.activo = False
            db.commit()
        registrar_auditoria(db, link.id, ip_cliente, user_agent, "BLOQUEADO", "Exceso de intentos de PIN")
        raise HTTPException(status_code=403, detail="SE CANCELÓ EL ENLACE POR INTENTOS FALLIDOS")

    # 🛡️ 4. Control de Usos Máximos (Vistas agotadas)
    if hasattr(link, 'vistas_actuales') and getattr(link, 'vistas_actuales', 0) >= getattr(link, 'max_vistas', 4):
        if link.activo:
            link.activo = False
            db.commit()
        registrar_auditoria(db, link.id, ip_cliente, user_agent, "BLOQUEADO", "Límite de visualizaciones agotado")
        raise HTTPException(status_code=403, detail="YA HAS SUPERADO LAS VISTAS AUTORIZADAS Y EL ENLACE EXPIRÓ")

    # 🛡️ 5. Si está inactivo por revocación manual u otra razón del administrador
    if not link.activo:
        registrar_auditoria(db, link.id, ip_cliente, user_agent, "FALLIDO", "Enlace inactivo")
        raise HTTPException(status_code=403, detail="EL ENLACE FUE CANCELADO MANUALMENTE")

    # Navegar hasta el paciente usando las relaciones de SQLAlchemy
    estudio = link.estudio
    if not estudio:
        raise HTTPException(status_code=404, detail="ESTUDIO NO ENCONTRADO")

    paciente = estudio.paciente
    if not paciente or not paciente.fecha_nacimiento:
        raise HTTPException(status_code=400, detail="EL PACIENTE NO TIENE FECHA DE NACIMIENTO REGISTRADA")

    # Formatear la fecha de nacimiento a DDMMYYYY
    pin_esperado = paciente.fecha_nacimiento.strftime("%d%m%Y")

    # 🛡️ 6. Validar el PIN ingresado contra la fecha
    if request_data.pin != pin_esperado:
        if hasattr(link, 'intentos_fallidos'):
            link.intentos_fallidos = getattr(link, 'intentos_fallidos', 0) + 1
            db.commit()
        
        intentos_restantes = 4 - getattr(link, 'intentos_fallidos', 0)
        
        # Si este error fue el último intento permitido, bloqueamos de inmediato
        if intentos_restantes <= 0:
            link.activo = False
            db.commit()
            registrar_auditoria(db, link.id, ip_cliente, user_agent, "BLOQUEADO", "Exceso de intentos de PIN")
            raise HTTPException(status_code=403, detail="SE CANCELÓ EL ENLACE POR INTENTOS FALLIDOS")

        registrar_auditoria(db, link.id, ip_cliente, user_agent, "FALLIDO", f"PIN incorrecto. Intentos restantes: {intentos_restantes}")
        raise HTTPException(status_code=401, detail=f"PIN INCORRECTO. INTENTOS RESTANTES: {intentos_restantes}")

    # 🛡️ 7. Registrar nueva vista exitosa
    limite = getattr(link, 'max_vistas', 4)
    actuales = getattr(link, 'vistas_actuales', 0)
    
    # Incrementamos el contador de uso
    link.vistas_actuales = actuales + 1
    
    # Si con esta vista se alcanzó el tope, apagamos el enlace para el futuro
    if link.vistas_actuales >= limite:
        link.activo = False
        
    db.commit()
    vistas_restantes = limite - link.vistas_actuales

    # 8. Registro de Éxito
    registrar_auditoria(db, link.id, ip_cliente, user_agent, "ÉXITO", "Acceso autorizado al portal")

    # 9. Respuesta exitosa
    return {
        "acceso_permitido": True,
        "vistas_restantes": vistas_restantes,
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
    link = obtener_por_token(db, token)
    if not link or not link.activo:
        raise HTTPException(status_code=404, detail="ENLACE NO VÁLIDO")
    if datetime.utcnow() > link.expira_en:
        raise HTTPException(status_code=410, detail="EL ENLACE HA CADUCADO")

    imagen = db.query(EstudioImagen).filter(EstudioImagen.id == imagen_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    if imagen.estudio_id != link.estudio_id:
        raise HTTPException(status_code=403, detail="No autorizado para ver esta imagen")

    ruta = Path(imagen.ruta_archivo)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Archivo físico no encontrado")

    return FileResponse(path=ruta, media_type="application/dicom")


# =========================================================
# 8) DESCARGAR INFORME MÉDICO (PDF) PARA PACIENTE
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

    if paciente and paciente.identificacion:
        from glob import glob
        coincidencias = glob(f"**/*{paciente.identificacion}*.pdf", recursive=True)
        if coincidencias:
            ruta_pdf = Path(coincidencias[0])

    if not ruta_pdf or not ruta_pdf.exists():
        raise HTTPException(status_code=404, detail="El archivo físico del informe no se encuentra en el servidor.")

    return FileResponse(
        path=str(ruta_pdf), 
        media_type="application/pdf",
        filename=ruta_pdf.name,
        content_disposition_type="inline"
    )