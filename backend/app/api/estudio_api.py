"""
estudio_api.py — MI_PACS (versión final y compatible)
-----------------------------------------------------
Endpoints clínicos para la gestión de estudios con el modelo moderno.
Compatible con:
- Procesador DICOM automático
- Frontend moderno (Estudios.jsx, VisorDICOMWrapper.jsx)
- Roles y autenticación
- IA clínica
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import shutil

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.core.roles import requiere_rol

from app.schemas.estudio import (
    EstudioCreate,
    EstudioResponse,
    EstudioListItem,
    EstudioUpdate,
)

from app.schemas.estudio_imagen import EstudioImagenResponse
from app.schemas.estudio_ia_log import EstudioIALogResponse

from app.services.estudio_service import (
    crear_estudio,
    listar_estudios_por_paciente,
    obtener_estudio,
    obtener_estudio_previo,
    actualizar_estudio,
)

from app.services.estudio_imagen_service import (
    save_image_and_register,
    obtener_imagenes_por_estudio,
    DICOMS_BASE,
    THUMB_DIR,
)

from app.services.estudio_ai_service import ejecutar_analisis_ia
from app.services.estudio_ia_log_service import registrar_solicitud_ia


# 🔵 CORREGIDO: sin /api, main.py ya aporta /api
router = APIRouter(prefix="/estudios", tags=["Estudios"])


# ---------------------------------------------------------
# CREAR ESTUDIO (manual o desde DICOM)
# ---------------------------------------------------------
@router.post("/", response_model=EstudioResponse)
def crear_estudio_endpoint(
    estudio: EstudioCreate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    requiere_rol(usuario, ["medico", "tecnico", "admin"])
    return crear_estudio(db, estudio)


# ---------------------------------------------------------
# LISTAR ESTUDIOS POR PACIENTE (Frontend)
# ---------------------------------------------------------
@router.get("/paciente/{paciente_id}", response_model=list[EstudioListItem])
def listar_estudios_por_paciente_endpoint(
    paciente_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    # Seguridad para pacientes
    if usuario.rol == "paciente" and usuario.id != paciente_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    return listar_estudios_por_paciente(db, paciente_id)


# ---------------------------------------------------------
# OBTENER ESTUDIO POR ID
# ---------------------------------------------------------
@router.get("/{estudio_id}", response_model=EstudioResponse)
def obtener_estudio_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if usuario.rol == "paciente" and usuario.id != estudio.paciente_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    return estudio


# ---------------------------------------------------------
# ACTUALIZAR ESTUDIO
# ---------------------------------------------------------
@router.put("/{estudio_id}", response_model=EstudioResponse)
def actualizar_estudio_endpoint(
    estudio_id: int,
    datos: EstudioUpdate,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    requiere_rol(usuario, ["medico", "admin"])

    estudio = actualizar_estudio(db, estudio_id, datos)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    return estudio


# ---------------------------------------------------------
# LISTAR IMÁGENES DE UN ESTUDIO (VisorDICOMWrapper.jsx)
# ---------------------------------------------------------
@router.get("/{estudio_id}/imagenes", response_model=list[EstudioImagenResponse])
def listar_imagenes_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if usuario.rol == "paciente" and usuario.id != estudio.paciente_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    imagenes = obtener_imagenes_por_estudio(db, estudio_id)
    respuesta: list[EstudioImagenResponse] = []

    for img in imagenes:
        ruta = img.ruta_archivo.replace("\\", "/")
        nombre_archivo = ruta.split("/")[-1]
        extension = nombre_archivo.split(".")[-1].lower()

        respuesta.append(
            EstudioImagenResponse(
                id=img.id,
                estudio_id=img.estudio_id,
                ruta_archivo=img.ruta_archivo,
                dicom_metadata=img.dicom_metadata,
                thumbnail=img.thumbnail,
                fecha_subida=img.fecha_subida,
                creado_en=img.creado_en,
                actualizado_en=img.actualizado_en,
                tipo=extension,
                nombre_archivo=nombre_archivo,
                url=img.ruta_archivo,
            )
        )

    return respuesta


# ---------------------------------------------------------
# OBTENER ESTUDIO PREVIO
# ---------------------------------------------------------
@router.get("/{estudio_id}/previo", response_model=EstudioListItem | None)
def obtener_estudio_previo_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    if usuario.rol == "paciente" and usuario.id != estudio.paciente_id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    return obtener_estudio_previo(db, estudio)


# ---------------------------------------------------------
# ELIMINAR ESTUDIO COMPLETO
# ---------------------------------------------------------
@router.delete("/{estudio_id}")
def eliminar_estudio_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    requiere_rol(usuario, ["admin"])

    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    print(f"[MI_PACS] Eliminando estudio clínico ID={estudio_id}")

    # 1. Eliminar imágenes físicas + BD
    imagenes = obtener_imagenes_por_estudio(db, estudio_id)

    for img in imagenes:
        # Archivo físico
        nombre = Path(img.ruta_archivo).name
        ruta_fisica = Path(DICOMS_BASE) / f"estudio_{estudio_id}" / nombre
        ruta_fisica.unlink(missing_ok=True)

        # Thumbnail físico
        nombre_thumb = Path(img.thumbnail).name
        thumb_fisica = Path(THUMB_DIR) / nombre_thumb
        thumb_fisica.unlink(missing_ok=True)

        db.delete(img)

    # 2. Eliminar estudio en BD
    db.delete(estudio)
    db.commit()

    # 3. Eliminar carpeta física del estudio
    carpeta_estudio = Path(DICOMS_BASE) / f"estudio_{estudio_id}"
    if carpeta_estudio.exists():
        shutil.rmtree(carpeta_estudio)

    return {"mensaje": "Estudio eliminado completamente."}


# ---------------------------------------------------------
# SOLICITAR ANÁLISIS IA
# ---------------------------------------------------------
@router.get("/{estudio_id}/analisis-ia", response_model=EstudioIALogResponse)
def solicitar_analisis_ia_endpoint(
    estudio_id: int,
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    requiere_rol(usuario, ["medico"])

    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    resultado = ejecutar_analisis_ia(db, estudio_id)
    log = registrar_solicitud_ia(db, estudio_id, usuario.id, resultado)

    return log


# ---------------------------------------------------------
# SUBIR IMAGEN A UN ESTUDIO (manual)
# ---------------------------------------------------------
@router.post("/{estudio_id}/upload-image", response_model=EstudioImagenResponse)
async def upload_image_estudio_endpoint(
    estudio_id: int,
    file: UploadFile = File(...),
    usuario=Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    requiere_rol(usuario, ["medico", "tecnico"])

    estudio = obtener_estudio(db, estudio_id)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")

    result = await save_image_and_register(db, estudio_id, file)

    return EstudioImagenResponse(
        id=result.id,
        estudio_id=result.estudio_id,
        ruta_archivo=result.ruta_archivo,
        dicom_metadata=result.dicom_metadata,
        thumbnail=result.thumbnail,
        fecha_subida=result.fecha_subida,
        creado_en=result.creado_en,
        actualizado_en=result.actualizado_en,
        tipo=result.ruta_archivo.split(".")[-1],
        nombre_archivo=result.ruta_archivo.split("/")[-1],
        url=result.ruta_archivo,
    )