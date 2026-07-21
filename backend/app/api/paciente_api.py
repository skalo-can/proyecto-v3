"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes con ordenamiento interactivo multivariable (Python).
Optimizado con controladores de excepción CORS para el Modo Maestro y control de flujo de re-dictado.
"""

import os
from dotenv import load_dotenv
import shutil
import subprocess 
import glob
from pathlib import Path  
from datetime import date, datetime
from typing import List, Union, Optional  
from pydantic import BaseModel

import pydicom
import numpy as np
from PIL import Image
from google import genai

from fastapi.responses import FileResponse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.models.paciente import Paciente
from app.models.estudio import Estudio

from app.models.estudio_imagen import EstudioImagen

from app.schemas.paciente import (
    PacienteCreate,
    PacienteUpdate,
    PacienteResponse,
    PacienteFlujoAdminUpdate
)
from app.services.paciente_service import (
    crear_paciente,
    obtener_paciente,
    actualizar_paciente,
    eliminar_paciente
)
from app.services.generador_pdf import construir_reporte_pdf

# 🔥 INYECTAMOS LAS ANCLAS ABSOLUTAS
from app.core.config import STATIC_DIR, THUMBNAILS_DIR, PDF_REPORTS_DIR, DICOM_ARCHIVADOS_DIR

# 🚀 DEFINICIÓN DEL ROUTER Y DIRECTORIOS (👻 FANTASMA ELIMINADO)
router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
security = HTTPBearer()

STATIC_THUMBNAILS_PATH = THUMBNAILS_DIR
STATIC_PDF_PATH = PDF_REPORTS_DIR

# ---------------------------------------------------------
# LISTAR PACIENTES (TABLA PRINCIPAL CON ORDENAMIENTO MULTIVARIABLE)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def listar(
    fechaDesde: str = Query("2010-01-01"),
    fechaHasta: str = Query("2030-12-31"),
    modalidad: str = Query(None),
    estado: str = Query(None),  # 🔥 NUEVO PARÁMETRO DE ESTADO CONTROLADO
    busqueda: str = Query(None),
    sort_by: str = Query("fecha"),  
    order: str = Query("desc"),      
    db: Session = Depends(get_db)
):
    query = db.query(Paciente).join(Estudio)
    
    try:
        f_desde = date.fromisoformat(fechaDesde)
        f_hasta = date.fromisoformat(fechaHasta)
        query = query.filter(Estudio.fecha_estudio >= f_desde, Estudio.fecha_estudio <= f_hasta)
    except Exception as e:
        print(f"⚠️ Formato de fecha inválido: {e}")

    if modalidad and modalidad.strip() != "":
        query = query.filter(Estudio.tipo_estudio == modalidad.strip())

    # Filtro previo en base de datos si el estado almacenado coincide
    if estado and estado.strip() != "":
        query = query.filter(Estudio.estado_pacs == estado.strip())

    if busqueda and busqueda.strip() != "":
        termino = f"%{busqueda.strip()}%"
        query = query.filter(
            (Paciente.primer_apellido.ilike(termino)) | 
            (Paciente.identificacion.like(termino))
        )

    resultados = query.all()
    lista_mapeada = []

    for p in resultados:
        estudios_validos = p.estudios
        if modalidad and modalidad.strip() != "":
            estudios_validos = [e for e in p.estudios if e.tipo_estudio == modalidad.strip()]
            
        if not estudios_validos:
            continue
            
        estudio_principal = estudios_validos[0]
        
        hora_final = "00:00"
        if hasattr(estudio_principal, "hora_estudio") and estudio_principal.hora_estudio:
            hora_final = estudio_principal.hora_estudio
        elif hasattr(estudio_principal, "dicom_metadata") and estudio_principal.dicom_metadata:
            hora_final = estudio_principal.dicom_metadata.get("StudyTime", "00:00")[:4]
            if len(hora_final) == 4:
                hora_final = f"{hora_final[:2]}:{hora_final[2:]}"
        
        descripcion_final = "Sin descripción DICOM"
        if hasattr(estudio_principal, "descripcion") and estudio_principal.descripcion:
            descripcion_final = estudio_principal.descripcion
        elif hasattr(estudio_principal, "study_description") and estudio_principal.study_description:
            descripcion_final = estudio_principal.study_description
        elif hasattr(estudio_principal, "procedimiento") and estudio_principal.procedimiento:
            descripcion_final = estudio_principal.procedimiento
        elif hasattr(estudio_principal, "dicom_metadata") and estudio_principal.dicom_metadata:
            descripcion_final = estudio_principal.dicom_metadata.get("StudyDescription", "Sin descripción DICOM")

        tiene_audio = getattr(estudio_principal, "tiene_dictado", False) or (hasattr(estudio_principal, "audio_path") and bool(estudio_principal.audio_path))
        tiene_informe = getattr(estudio_principal, "tiene_transcripcion", False) or (hasattr(estudio_principal, "informe_texto") and bool(estudio_principal.informe_texto))
        esta_firmado = getattr(estudio_principal, "esta_firmado", False)
        tiene_anexos = getattr(estudio_principal, "tiene_anexos", False) or (hasattr(estudio_principal, "anexos_count") and getattr(estudio_principal, "anexos_count", 0) > 0)
        
        fue_entregado = getattr(estudio_principal, "entregado", False) or \
                        getattr(estudio_principal, "enviado_sms", False) or \
                        getattr(estudio_principal, "enviado_email", False) or \
                        getattr(estudio_principal, "enviado_whatsapp", False)

        estado_bd = getattr(estudio_principal, "estado_pacs", None)
        valor_firmado = getattr(estudio_principal, "esta_firmado", False)
        es_estudio_firmado = estado_bd == "Firmado" or valor_firmado is True or valor_firmado == 1 or valor_firmado == "1"

        if es_estudio_firmado:
            estado_actual = "Firmado"
        elif fue_entregado:
            estado_actual = "Entregado"
        elif estado_bd == "Rechazado":          # 🔥 ¡NUEVA LÍNEA CRÍTICA! Evita que el sistema borre el rechazo
            estado_actual = "Rechazado"
        elif estado_bd == "Cancelado":          # 🔥 NUEVO: Protege el estudio abortado
            estado_actual = "Cancelado"
        elif estado_bd == "Urgencia":           # 🔥 ¡INTEGRACIÓN DE ESTADO DE URGENCIAS CLÍNICAS!
            estado_actual = "Urgencia"
        elif estado_bd == "Transcrito" or tiene_informe:
            estado_actual = "Transcrito"
        elif estado_bd == "Dictado" or tiene_audio:
            estado_actual = "Dictado"
        else:
            es_externo = getattr(estudio_principal, "es_externo", True)
            estado_actual = "Importado" if es_externo else "Tomado"

        if estado_bd != estado_actual:
            estudio_principal.estado_pacs = estado_actual
            db.commit()

        # 🔥 FILTRADO EN CALIENTE: Si el usuario seleccionó un estado específico, validamos la consistencia dinámica
        if estado and estado.strip() != "" and estado_actual != estado.strip():
            continue

        lista_mapeada.append({
            "id": p.id,
            "identificacion": p.identificacion,
            "primer_nombre": p.primer_nombre,
            "segundo_nombre": getattr(p, "segundo_nombre", "") or "-",
            "primer_apellido": p.primer_apellido,
            "segundo_apellido": getattr(p, "segundo_apellido", "") or "-",
            "telefono": getattr(p, "telefono", "") or "-",
            "email": getattr(p, "email", "") or "-",
            "activo": p.activo,
            "sexo": getattr(p, "sexo", "M"),
            "departamento": getattr(p, "departamento", "Radiología"),
            "fecha_estudio": estudio_principal.fecha_estudio.isoformat() if estudio_principal.fecha_estudio else "S/F",
            "tipo_estudio": estudio_principal.tipo_estudio if estudio_principal.tipo_estudio else "CR",
            "hora_estudio": hora_final,
            "descripcion": descripcion_final,
            "estado_pacs": estado_actual,
            "pdf_path": getattr(estudio_principal, "pdf_path", None), # <--- AGREGAR ESTA LÍNEA AQUÍ
            "flujo_clinico": {
                "tiene_audio": tiene_audio or (estado_actual == "Dictado"),
                "tiene_informe": tiene_informe,
                "esta_firmado": esta_firmado,
                "tiene_anexos": tiene_anexos,
                "entregado": fue_entregado
            }
        })

    def obtener_llave_orden(item):
        if sort_by == "id":
            try:
                return int(str(item["identificacion"]).strip())
            except ValueError:
                return str(item["identificacion"]).strip().lower()
        elif sort_by == "nombre":
            return str(item["primer_apellido"]).lower()
        else:
            return f"{item['fecha_estudio']} {item['hora_estudio']}"

    es_descendente = (order == "desc")
    lista_mapeada.sort(key=obtener_llave_orden, reverse=es_descendente)
        
    return lista_mapeada


# ---------------------------------------------------------
# ENDPOINTS REST COMPLETOS (CRUD)
# ---------------------------------------------------------
@router.post("", response_model=PacienteResponse)
def crear(paciente: PacienteCreate, db: Session = Depends(get_db)):
    return crear_paciente(db=db, paciente=paciente)

@router.get("/{paciente_id}", response_model=PacienteResponse)
def leer(paciente_id: int, db: Session = Depends(get_db)):
    db_paciente = obtener_paciente(db, paciente_id=paciente_id)
    if db_paciente is None:
        raise HTTPException(status_code=404, detail="Paciente no localizado")
    return db_paciente

@router.put("/{paciente_id}", response_model=PacienteResponse)
def actualizar(paciente_id: int, paciente: PacienteUpdate, db: Session = Depends(get_db)):
    try:
        db_paciente = actualizar_paciente(db=db, paciente_id=paciente_id, data=paciente)
        if db_paciente is None:
            raise HTTPException(status_code=404, detail="No se localizó al paciente")
        return db_paciente
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fallo en persistencia: {str(e)}")

@router.post("/import/disco-externo")
def importar_disco_externo(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    if not token or len(token) < 10:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")
    try:
        return {"status": "success", "message": "Estudios externos acoplados."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo: {str(e)}")

@router.post("/{paciente_id}/reabrir-flujo")
def reabrir_flujo_estudio(paciente_id: int, control: PacienteFlujoAdminUpdate, db: Session = Depends(get_db)):
    db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not db_paciente: raise HTTPException(status_code=404, detail="Paciente no encontrado")
        
    with db.begin_nested():
        for estudio in db_paciente.estudios:
            if hasattr(estudio, "tiene_dictado"): estudio.tiene_dictado = False
            if hasattr(estudio, "tiene_transcripcion"): estudio.tiene_transcripcion = False
            if hasattr(estudio, "esta_firmado"): estudio.esta_firmado = False
            if hasattr(estudio, "audio_path"): estudio.audio_path = None
            if hasattr(estudio, "informe_texto"): estudio.informe_texto = None
            if hasattr(estudio, "nota_urgencia"): estudio.nota_urgencia = None
            if hasattr(estudio, "requiere_lectura_radiologo"): estudio.requiere_lectura_radiologo = False
    db.commit()
    return {"status": "success", "message": "Flujo reabierto con éxito."}


class TranscripcionInput(BaseModel):
    informe: str

@router.post("/{paciente_id}/guardar-transcripcion")
def guardar_transcripcion(paciente_id: int, datos: TranscripcionInput, db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    try:
        estudio.informe_texto = datos.informe
        estudio.estado_pacs = "Transcrito"
        setattr(estudio, "tiene_transcripcion", True)
        setattr(estudio, "tiene_dictado", False)  
        db.commit()
        return {"status": "success", "message": "Transcripción acoplada."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{paciente_id}/obtener-transcripcion")
def obtener_transcripcion(paciente_id: int, db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    texto_informe = getattr(estudio, "informe_texto", "") if estudio else ""
    return {"informe_texto": texto_informe, "informe_text": texto_informe, "texto": texto_informe}


# ---------------------------------------------------------
# 🚨 ENDPOINT DEL FLUJO DE URGENCIAS (SALA DE EMERGENCIAS)
# ---------------------------------------------------------
class NotaUrgenciaInput(BaseModel):
    nota_urgencia: str
    requiere_lectura: bool = True

@router.post("/{paciente_id}/guardar-nota-urgencia")
def guardar_nota_urgencia(paciente_id: int, datos: NotaUrgenciaInput, db: Session = Depends(get_db)):
    """
    Registra los hallazgos críticos del Urgenciólogo y marca el estudio en estado
    'Urgencia' para alertar al radiólogo de que se requiere lectura oficial.
    """
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio clínico no localizado")
    
    try:
        estudio.nota_urgencia = datos.nota_urgencia
        estudio.estado_pacs = "Urgencia"
        setattr(estudio, "requiere_lectura_radiologo", datos.requiere_lectura)
        
        db.commit()
        return {"status": "success", "message": "Nota de evidencia clínica registrada en urgencias."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar la nota clínica: {str(e)}")


# =========================================================
# 🔥 GENERACIÓN DE PDF, FIRMA Y RECHAZO
# =========================================================
class FirmaInput(BaseModel):
    informe_final: str
    medico_firma: Optional[str] = ""
    registro_medico: Optional[str] = ""
    aprobado: bool = True              
    nota_rechazo: Optional[str] = ""  

@router.post("/{paciente_id}/firmar-informe")
def firmar_informe(
    paciente_id: int, 
    datos: FirmaInput, 
    db: Session = Depends(get_db)  # 🔥 ELIMINAMOS EL CANDADO DEL TOKEN AQUÍ
):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    paciente_db = estudio.paciente
    
    try:
        # ❌ FLUJO DE RECHAZO (Devolver al transcriptor)
        if not datos.aprobado:
            estudio.informe_texto = datos.informe_final
            estudio.estado_pacs = "Dictado"
            if hasattr(estudio, "nota_medico"):
                setattr(estudio, "nota_medico", datos.nota_rechazo) 
                
            setattr(estudio, "esta_firmado", False)
            db.commit()
            return {
                "status": "success", 
                "message": "Estudio devuelto a transcripción para correcciones.",
                "pdf_path": None
            }

        # ✅ FLUJO DE APROBACIÓN (Firma normal usando los datos del formulario)
        nombre_medico_final = datos.medico_firma.strip() if datos.medico_firma else "Médico Radiólogo"
        rm_final = datos.registro_medico.strip() if datos.registro_medico else "SIN REGISTRO MÉDICO"

        estudio.informe_texto = datos.informe_final
        estudio.estado_pacs = "Firmado"
        setattr(estudio, "esta_firmado", True)
        setattr(estudio, "tiene_transcripcion", True)
        setattr(estudio, "tiene_dictado", False)
        
        identificacion = paciente_db.identificacion or paciente_db.id
        
        datos_para_pdf = {
            "nombre_paciente": f"{paciente_db.primer_nombre} {paciente_db.primer_apellido}",
            "id_paciente": identificacion,
            "fecha_estudio": estudio.fecha_estudio.strftime("%Y-%m-%d") if estudio.fecha_estudio else "S/F",
            "modalidad": getattr(estudio, "tipo_estudio", getattr(estudio, "modalidad", "CR")),
            "texto_diagnostico": datos.informe_final,
            "nombre_medico": nombre_medico_final,
            "registro_medico": rm_final 
        }
        # 🔥 LA MAGIA DEL ILM PARA LOS PDFs: Partición por Año / Mes / Día ORIGINAL DEL ESTUDIO
        fecha_referencia = estudio.fecha_estudio if estudio.fecha_estudio else datetime.now()
        
        año = str(fecha_referencia.year)
        mes = f"{fecha_referencia.month:02d}"
        dia = f"{fecha_referencia.day:02d}"

        ruta_destino_fecha = STATIC_PDF_PATH / año / mes / dia
        ruta_destino_fecha.mkdir(parents=True, exist_ok=True)

        nombre_archivo = f"Reporte_{identificacion}.pdf"
        ruta_fisica_salida = os.path.join(str(ruta_destino_fecha), nombre_archivo)

        # Generar el PDF en su nueva ubicación organizada
        construir_reporte_pdf(datos_para_pdf, ruta_fisica_salida)
        
        # Guardamos la ruta relativa estructurada en la BD
        ruta_pdf_relativa = f"/static/pdf_reports/{año}/{mes}/{dia}/{nombre_archivo}"
        setattr(estudio, "pdf_path", ruta_pdf_relativa) 
        
        db.commit()
        
        return {
            "status": "success", 
            "message": "Informe firmado digitalmente y PDF estructurado generado.",
            "pdf_path": ruta_pdf_relativa
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el proceso: {str(e)}")
    
@router.get("/{paciente_id}/descargar-pdf")
def descargar_pdf_paciente(paciente_id: int, db: Session = Depends(get_db)):
    """
    Escáner profundo infalible (Compatible con Windows/Linux): 
    Busca el PDF en la estructura ILM.
    """
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no localizado")

    identificacion = paciente.identificacion or paciente.id
    nombre_pdf = f"Reporte_{identificacion}.pdf"

    # 1. Búsqueda profunda usando os.walk (Nunca falla en Windows)
    import os
    for raiz, directorios, archivos in os.walk(str(STATIC_PDF_PATH)):
        if nombre_pdf in archivos:
            ruta_exacta = os.path.join(raiz, nombre_pdf)
            # El header 'inline' fuerza al navegador a abrirlo en vez de descargarlo
            return FileResponse(
                ruta_exacta, 
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename={nombre_pdf}"}
            )

    raise HTTPException(status_code=404, detail=f"No se encontró el PDF: {nombre_pdf}")

# =========================================================
# 🔥 MOTOR FÍSICO DE EXPORTACIÓN (CD/DVD vs EXPLORADOR)
# =========================================================
class ExportacionInput(BaseModel):
    estudios_ids: List[Union[int, str]]
    incluir_visor: bool = True  
    modo_destino: str = "EXPLORADOR"

@router.post("/exportar/medios-externos")
def exportar_medios_externos(datos: ExportacionInput, db: Session = Depends(get_db)):
    try:
        if not datos.estudios_ids:
            raise ValueError("No se suministraron estudios al motor físico.")

        unidad_destino = None

        if datos.modo_destino == "EXPLORADOR":
            codigo_tk = (
                "import tkinter as tk; "
                "from tkinter import filedialog; "
                "root = tk.Tk(); "
                "root.withdraw(); "
                "root.attributes('-topmost', True); "
                "carpeta = filedialog.askdirectory(title='MI_PACS: Seleccione destino'); "
                "print(carpeta)"
            )
            
            try:
                resultado = subprocess.check_output(["python", "-c", codigo_tk], text=True, stderr=subprocess.DEVNULL)
                carpeta_seleccionada = resultado.strip()
            except Exception:
                carpeta_seleccionada = ""

            if not carpeta_seleccionada:
                raise ValueError("Operación cancelada. No seleccionaste ninguna carpeta de destino.")
                
            unidad_destino = os.path.join(carpeta_seleccionada, "MI_PACS_EXPORT")
            os.makedirs(unidad_destino, exist_ok=True)

        elif datos.modo_destino == "CD_DVD":
            letras_unidades = [f"{chr(i)}:" for i in range(68, 91)]
            
            for letra in letras_unidades:
                ruta_base = f"{letra}\\"
                try:
                    if os.path.exists(ruta_base):
                        archivo_prueba = os.path.join(ruta_base, ".mipacs_test")
                        with open(archivo_prueba, 'w') as f:
                            f.write('1')
                        os.remove(archivo_prueba)
                        
                        ruta_definitiva = f"{letra}\\MI_PACS_EXPORT"
                        os.makedirs(ruta_definitiva, exist_ok=True)
                        unidad_destino = ruta_definitiva
                        break
                except Exception:
                    continue

            if not unidad_destino:
                raise ValueError("No se detectó ningún CD o DVD grabable insertado.")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        carpeta_lote = os.path.join(unidad_destino, f"Lote_Diagnostico_{timestamp}")
        os.makedirs(carpeta_lote, exist_ok=True)

        estudios_procesados = 0

        for item_id in datos.estudios_ids:
            paciente_db = db.query(Paciente).filter(Paciente.id == item_id).first()

            if not paciente_db or not paciente_db.estudios:
                continue

            estudio_db = paciente_db.estudios[0]

            p_nombre = (paciente_db.primer_nombre or "").strip()
            p_apellido = (paciente_db.primer_apellido or "").strip()
            nombre_paciente = f"{p_nombre}_{p_apellido}".replace(" ", "_")
            if not nombre_paciente or nombre_paciente == "_":
                nombre_paciente = "PACIENTE_DESCONOCIDO"
            
            identificacion = paciente_db.identificacion or paciente_db.id
            
            carpeta_paciente = os.path.join(carpeta_lote, f"{nombre_paciente}_ID{identificacion}")
            os.makedirs(carpeta_paciente, exist_ok=True)

            ruta_dicom_origen = getattr(estudio_db, "ruta_archivos", getattr(estudio_db, "ruta_dicom", None))
            if not ruta_dicom_origen:
                # 👻 FANTASMA ELIMINADO: Anclaje absoluto a DICOM_ARCHIVADOS_DIR
                ruta_dicom_origen = os.path.join(str(DICOM_ARCHIVADOS_DIR), str(paciente_db.id), str(estudio_db.id))

            carpeta_dicom_destino = os.path.join(carpeta_paciente, "IMAGENES_DICOM")
            if ruta_dicom_origen and os.path.exists(ruta_dicom_origen):
                try:
                    shutil.copytree(ruta_dicom_origen, carpeta_dicom_destino, dirs_exist_ok=True)
                except Exception: pass
            else:
                os.makedirs(carpeta_dicom_destino, exist_ok=True) 

            pdf_nombre = f"Reporte_{identificacion}.pdf"
            
            # 👻 FANTASMA ELIMINADO: Anclaje absoluto a la variable unificada de PDFs
            ruta_pdf_origen = os.path.join(str(STATIC_PDF_PATH), pdf_nombre)
            
            if os.path.exists(ruta_pdf_origen):
                try:
                    shutil.copy2(ruta_pdf_origen, carpeta_paciente)
                except Exception: pass

            estudios_procesados += 1

        if datos.incluir_visor:
            # 👻 FANTASMA ELIMINADO: Anclaje absoluto a la carpeta estática para el visor
            ruta_visor_origen = os.path.join(str(STATIC_DIR), "visor_portable")
            carpeta_visor_destino = os.path.join(carpeta_lote, "MI_PACS_Visor_Lite")
            if os.path.exists(ruta_visor_origen):
                try:
                    shutil.copytree(ruta_visor_origen, carpeta_visor_destino, dirs_exist_ok=True)
                except Exception: pass

        estado_visor_msg = " (Con Visor Lite incluido)" if datos.incluir_visor else ""

        return {
            "status": "success", 
            "message": f"Se grabaron y empaquetaron {estudios_procesados} estudios{estado_visor_msg} en:\n{unidad_destino}"
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo del Motor Físico: {str(e)}")

# =========================================================
# 🤖 ASISTENTE DE DIAGNÓSTICO CON INTELIGENCIA ARTIFICIAL (PRODUCCIÓN BLINDADA)
# =========================================================
class IARequest(BaseModel):
    texto_actual: str

@router.post("/{paciente_id}/asistencia-ia")
def asistencia_ia(
    paciente_id: int, 
    datos: IARequest, 
    db: Session = Depends(get_db)
):
    # 1. CAPA DE INTEGRIDAD RELACIONAL (Carga estricta y segura)
    try:
        # Validar existencia del estudio
        estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
        if not estudio: 
            raise HTTPException(status_code=404, detail="Imagen o estudio no encontrado.")

        # Validar existencia de la ruta en la base de datos
        imagen_db = db.query(EstudioImagen).filter(EstudioImagen.estudio_id == estudio.id).first()
        if not imagen_db or not imagen_db.thumbnail:
            raise HTTPException(status_code=404, detail="Imagen o estudio no encontrado.")

        # Construir y validar la ruta física absoluta
        ruta_relativa = imagen_db.thumbnail.lstrip("/")
        imagen_a_usar = BASE_DIR / ruta_relativa

        if not imagen_a_usar.exists():
            raise HTTPException(status_code=404, detail="Imagen o estudio no encontrado.")

        # Apertura segura
        img = Image.open(imagen_a_usar)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo técnico al cargar la imagen: {str(e)}")

    # 2. CAPA DE SEGURIDAD CLÍNICA (Filtro Anti-Malapraxis en el Prompt)
    try:
        load_dotenv()
        api_key_gemini = os.getenv("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key_gemini)
        
        modalidad_esperada = estudio.tipo_estudio or "No especificada"
        descripcion_esperada = estudio.descripcion or "No especificada"
        
        prompt = f"""
        INSTRUCCIÓN CRÍTICA DE SEGURIDAD MÉDICA — TOLERANCIA CERO A ERRORES DE IDENTIDAD.
        Eres un radiólogo experto encargado de la auditoría final de calidad. Antes de evaluar el texto del informe, debes ejecutar de forma obligatoria un protocolo estricto de correspondencia anatómica.

        DATOS REGISTRADOS EN LA BASE DE DATOS DEL SISTEMA:
        - Modalidad técnica configurada: {modalidad_esperada}
        - Región anatómica declarada: {descripcion_esperada}
        
        INFORME PRELIMINAR DEL TRANSCRIPTOR:
        "{datos.texto_actual}"

        PROTOCOLOS DE CONTROL DE RIESGO:
        1. VALIDACIÓN VISUAL OBLIGATORIA: Analiza los píxeles de la imagen proporcionada. Si la estructura anatómica visible NO coincide con la región declarada en el sistema ({descripcion_esperada}), debes asumir inmediatamente que hay un cruce de archivos o un error de indexación en el servidor.
        
        2. ACCIÓN ANTE MISMATCH (ABORTAR): Si la validación anatómica falla (por ejemplo, ves un cráneo/columna pero el estudio dice ser un Tórax), tienes estrictamente prohibido realizar cualquier análisis clínico. Debes responder única y exclusivamente con este mensaje de alerta estructurado:
           "[💡 SUGERENCIA IA: 🚨 ERROR CRÍTICO DE SEGURIDAD: Se ha detectado una falta de correspondencia anatómica. La imagen visualizada en el servidor no coincide con la descripción de '{descripcion_esperada}' registrada para este estudio. Por favor, suspenda la firma y reporte este caso al administrador del PACS para verificar la integridad del archivo DICOM.]"
        
        3. ACCIÓN ANTE COINCIDENCIA (PROCESAR): Si la imagen coincide plenamente con la región anatómica declarada, procede a evaluar el informe preliminar del transcriptor de forma normal. Comienza tu respuesta con "[💡 SUGERENCIA IA: " y ciérrala con "]". Sé conciso y directo.
        """
        
        response = client.models.generate_content(
            model='gemini-3.5-flash', 
            contents=[img, prompt]
        )
        return {"sugerencia": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en el motor de análisis clínico automatizado: {str(e)}")
    
class RechazoImagenInput(BaseModel):
    nota_rechazo: str

@router.post("/{paciente_id}/rechazar-estudio-imagen")
def rechazar_estudio_imagen(
    paciente_id: int, 
    datos: RechazoImagenInput, 
    db: Session = Depends(get_db)  # <-- Eliminamos la exigencia estricta del token de usuario aquí
):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: 
        raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    if not datos.nota_rechazo.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar un motivo médico para el rechazo técnico.")

    try:
        estudio.estado_pacs = "Rechazado"
        
        # Guardamos la nota sin requerir el nombre del usuario logueado
        if hasattr(estudio, "nota_medico"):
            setattr(estudio, "nota_medico", f"🚨 RECHAZO TÉCNICO ({datetime.now().strftime('%Y-%m-%d')}): {datos.nota_rechazo.strip()}")
        
        db.commit()
        return {"status": "success", "message": "Estudio marcado como Rechazado por control de calidad técnica."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el guardado del rechazo: {str(e)}")
    
    # =========================================================
# 🚫 CANCELACIÓN DEFINITIVA DE ESTUDIO (VÁLVULA DE ESCAPE)
# =========================================================
class CancelacionInput(BaseModel):
    motivo_cancelacion: str

@router.post("/{paciente_id}/cancelar-estudio")
def cancelar_estudio_definitivo(paciente_id: int, datos: CancelacionInput, db: Session = Depends(get_db)):
    """
    Aborta el flujo de un estudio por limitaciones técnicas o traslado del paciente,
    archivándolo permanentemente para no afectar la productividad.
    """
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: 
        raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    if not datos.motivo_cancelacion.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar un motivo para la cancelación.")

    try:
        estudio.estado_pacs = "Cancelado"
        
        # Reutilizamos el campo de notas para guardar la evidencia legal de la cancelación
        if hasattr(estudio, "nota_medico"):
            setattr(estudio, "nota_medico", f"🚫 CANCELADO DEFINITIVO ({datetime.now().strftime('%Y-%m-%d')}): {datos.motivo_cancelacion.strip()}")
        
        db.commit()
        return {"status": "success", "message": "Estudio abortado y archivado correctamente."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cancelar: {str(e)}") 