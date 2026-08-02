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
import re

import pydicom
import numpy as np
from PIL import Image
from google import genai

from fastapi.responses import FileResponse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.firma import FirmaRadiologo # 🔥 IMPORTAMOS LA ENTIDAD FIRMA

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

# 🚀 DEFINICIÓN DEL ROUTER Y DIRECTORIOS
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
    fechaDesde: str = Query(None),
    fechaHasta: str = Query(None),
    modalidad: str = Query(None),
    estado: str = Query(None),  
    busqueda: str = Query(None),
    sort_by: str = Query("fecha"),  
    order: str = Query("desc"),      
    db: Session = Depends(get_db)
):
    # 🟢 1. CONSULTA CENTRADA EN ESTUDIOS (Permite ver múltiples estudios del mismo paciente por día)
    query = db.query(Estudio).join(Paciente, Estudio.paciente_id == Paciente.id)
    
    # 🟢 2. PURIFICADOR DE FECHAS
    def limpiar_fecha(f_str):
        if not f_str or f_str in ["null", "undefined"]: return None
        f = str(f_str).strip().split("T")[0][:10]
        match = re.match(r"^(\d{2})[/.-](\d{2})[/.-](\d{4})$", f)
        if match: return f"{match.group(3)}-{match.group(1)}-{match.group(2)}"
        return f

    f_desde_limpia = limpiar_fecha(fechaDesde)
    f_hasta_limpia = limpiar_fecha(fechaHasta)

    if f_desde_limpia:
        query = query.filter(func.date(Estudio.fecha_estudio) >= f_desde_limpia)
    if f_hasta_limpia:
        query = query.filter(func.date(Estudio.fecha_estudio) <= f_hasta_limpia)

    if modalidad and modalidad not in ["Todas", "- Todas -", "Todos", ""]:
        mod_limpia = modalidad.split('-')[0].strip()
        query = query.filter(Estudio.tipo_estudio.ilike(f"%{mod_limpia}%"))

    if estado and estado not in ["- Todos -", "Todos", "Todas", ""]:
        query = query.filter(Estudio.estado_pacs.ilike(f"%{estado.strip()}%"))

    if busqueda and busqueda.strip() != "":
        termino = f"%{busqueda.strip()}%"
        query = query.filter(
            (Paciente.primer_apellido.ilike(termino)) | 
            (Paciente.primer_nombre.ilike(termino)) | 
            (Paciente.identificacion.ilike(termino))
        )

    resultados_estudios = query.all()
    lista_mapeada = []

    for estudio_principal in resultados_estudios:
        p = estudio_principal.paciente
        if not p:
            continue
        
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

        if es_estudio_firmado: estado_actual = "Firmado"
        elif fue_entregado: estado_actual = "Entregado"
        elif estado_bd == "Rechazado": estado_actual = "Rechazado"
        elif estado_bd == "Cancelado": estado_actual = "Cancelado"
        elif estado_bd == "Urgencia": estado_actual = "Urgencia"
        elif estado_bd == "Transcrito" or tiene_informe: estado_actual = "Transcrito"
        elif estado_bd == "Dictado" or tiene_audio: estado_actual = "Dictado"
        elif estado_bd == "Tomado": estado_actual = "Tomado" # 🔥 AQUÍ ESTÁ LA SOLUCIÓN
        else:
            es_externo = getattr(estudio_principal, "es_externo", True)
            estado_actual = "Importado" if es_externo else "Tomado"

        if estado_bd != estado_actual:
            estudio_principal.estado_pacs = estado_actual
            db.commit()

        if estado and estado not in ["- Todos -", "Todos", "Todas", ""] and estado_actual != estado.strip():
            continue

        lista_mapeada.append({
            "id": p.id,                        # ID del paciente para acciones generales
            "estudio_interno_id": estudio_principal.id, # 🟢 Clave única por estudio para evitar colisiones en React
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
            "estado_pacs": estado_actual,      # 🟢 Cada estudio muestra su estado real independiente
            "pdf_path": getattr(estudio_principal, "pdf_path", None), 
            "flujo_clinico": {
                "tiene_audio": tiene_audio or (estado_actual == "Dictado"),
                "tiene_informe": tiene_informe,
                "esta_firmado": esta_firmado,
                "tiene_anexos": tiene_anexos,
                "entregado": fue_entregado
            }
        })


# 🟢 MOTOR DE ORDENAMIENTO EXACTO Y UNIVERSAL
    def obtener_llave_orden(item):
        # Usamos el id del estudio como desempate para evitar inestabilidad en el orden
        desempate = item.get("estudio_interno_id", 0)
        
        # Estandarizamos el parámetro de búsqueda (minúsculas y sin espacios extra)
        c = str(sort_by).lower().strip() if sort_by else "fecha_estudio"

        # 1. Ordenamiento de IDs (Menor a Mayor / Mayor a Menor)
        if c in ["identificacion", "id_paciente", "id"]:
            # Rellenamos con ceros a la izquierda para un orden numérico perfecto en formato texto
            return (str(item.get("identificacion", "")).zfill(20), desempate)
        
        # 2. Ordenamiento por Fecha y Hora cronológica
        elif c in ["fecha", "fecha_estudio", "hora", "hora_estudio", "fechahora"]:
            return (f"{item.get('fecha_estudio', '0000-00-00')} {item.get('hora_estudio', '00:00')}", desempate)
        
        # 3. Ordenamiento por Modalidad (A-Z / Z-A)
        elif c in ["mod", "modalidad", "tipo_estudio"]:
            return (str(item.get("tipo_estudio", "")).lower(), desempate)
        
        # 4. Ordenamiento por Estado (A-Z / Z-A)
        elif c in ["estado", "estado_pacs"]:
            return (str(item.get("estado_pacs", "")).lower(), desempate)
            
        # 5. Ordenamiento por Género / Sexo (A-Z / Z-A)
        elif c in ["genero", "sexo"]:
            return (str(item.get("sexo", "")).lower(), desempate)

        # 6. Ordenamiento Universal (A-Z / Z-A) para Nombres, Apellidos, Departamentos, etc.
        if c in item:
            val = item[c]
            # Si el valor resulta ser numérico, lo ordenamos como tal
            if isinstance(val, (int, float)):
                return (val, desempate)
            # De lo contrario, lo tratamos como texto
            return (str(val).lower() if val is not None else "", desempate)
            
        # Fallback (Por defecto si la columna no existe)
        return (f"{item.get('fecha_estudio', '0000-00-00')} {item.get('hora_estudio', '00:00')}", desempate)

    es_descendente = (str(order).lower().strip() == "desc")
    lista_mapeada.sort(key=obtener_llave_orden, reverse=es_descendente)
        
    # ESTA LÍNEA ES CRÍTICA PARA QUE LOS DATOS LLEGUEN AL FRONTEND
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

from fastapi import UploadFile, File

@router.post("/{paciente_id}/guardar-audio")
def guardar_audio_paciente(paciente_id: int, audio: UploadFile = File(...), db: Session = Depends(get_db)):
    paciente_db = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente_db:
        raise HTTPException(status_code=404, detail="Paciente no localizado")
    
    # 1. Traemos todos los estudios del paciente ordenados del más antiguo al más reciente
    estudios = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).order_by(Estudio.id.asc()).all()
    if not estudios: 
        raise HTTPException(status_code=404, detail="Estudios no localizados")
    
    # 2. INTELIGENCIA DE SELECCIÓN: Buscamos el estudio que esté pendiente de lectura
    # Ignora los que ya están Firmados o Cancelados, para no sobreescribir su flujo
    estudio_actual = next((e for e in estudios if e.estado_pacs in ["Importado", "Tomado", "Urgencia", "Rechazado", None]), estudios[-1])
    
    try:
        # 3. Usamos la fecha exacta de ESE estudio para la carpeta
        fecha_referencia = estudio_actual.fecha_estudio if estudio_actual.fecha_estudio else datetime.now()
        año = str(fecha_referencia.year)
        mes = f"{fecha_referencia.month:02d}"
        dia = f"{fecha_referencia.day:02d}"
        
        ruta_jerarquica = Path(STATIC_DIR) / "audios_dictado" / año / mes / dia
        ruta_jerarquica.mkdir(parents=True, exist_ok=True)
        
        # 4. 🔥 EL CONSECUTIVO PERFECTO: Añadimos el ID del estudio al nombre del archivo
        consecutivo = estudio_actual.id
        nombre_limpio = f"dictado_{paciente_db.identificacion}_estudio_{consecutivo}.wav"
        file_path = ruta_jerarquica / nombre_limpio
        
        with open(file_path, "wb") as buffer:
            import shutil
            shutil.copyfileobj(audio.file, buffer)
            
        ruta_relativa = f"/static/audios_dictado/{año}/{mes}/{dia}/{nombre_limpio}"
        
        # 5. 🔥 SOLO ACTUALIZAMOS ESTE ESTUDIO ESPECÍFICO
        estudio_actual.audio_path = ruta_relativa
        estudio_actual.estado_pacs = "Dictado"
        if hasattr(estudio_actual, "tiene_dictado"):
            setattr(estudio_actual, "tiene_dictado", True)
        
        db.commit()
        return {"status": "success", "message": f"Audio acoplado con éxito al estudio {consecutivo}."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Asegúrate de importar datetime si no lo tienes arriba en tu archivo:
# from datetime import datetime

@router.post("/{paciente_id}/guardar-transcripcion")
def guardar_transcripcion(paciente_id: int, datos: TranscripcionInput, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    try:
        estudio.informe_texto = datos.informe
        estudio.estado_pacs = "Transcrito"
        setattr(estudio, "tiene_transcripcion", True)
        setattr(estudio, "tiene_dictado", False)  
        
        # ---------------------------------------------------------------------
        # 🔥 AQUÍ ESTÁ LA PIEZA FALTANTE: ENLAZAR AL TRANSCRIPTOR PARA LA GERENCIA
        # ---------------------------------------------------------------------
        if hasattr(estudio, 'transcriptor_id'):
            estudio.transcriptor_id = usuario.id
        elif hasattr(estudio, 'usuario_id'): 
            # Fallback de seguridad
            estudio.usuario_id = usuario.id

        # Guardamos la marca de tiempo exacta para calcular el rendimiento
        if hasattr(estudio, 'fecha_actualizacion'):
            from datetime import datetime
            estudio.fecha_actualizacion = datetime.now()
        # ---------------------------------------------------------------------

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

class NotaUrgenciaInput(BaseModel):
    nota_urgencia: str
    requiere_lectura: bool = True

@router.post("/{paciente_id}/guardar-nota-urgencia")
def guardar_nota_urgencia(paciente_id: int, datos: NotaUrgenciaInput, db: Session = Depends(get_db)):
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

class FirmaInput(BaseModel):
    informe_final: str
    medico_firma: Optional[str] = ""
    registro_medico: Optional[str] = ""
    aprobado: bool = True              
    nota_rechazo: Optional[str] = ""  

# 🔥 SOLUCIÓN: INYECCIÓN DE LA ANCLA ABSOLUTA + GUARDADO DEL AUTOR PARA PRODUCTIVIDAD
@router.post("/{paciente_id}/firmar-informe")
def firmar_informe(paciente_id: int, datos: FirmaInput, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    paciente_db = estudio.paciente
    
    try:
        if not datos.aprobado:
            estudio.informe_texto = datos.informe_final
            estudio.estado_pacs = "Dictado"
            if hasattr(estudio, "nota_medico"):
                setattr(estudio, "nota_medico", datos.nota_rechazo) 
            setattr(estudio, "esta_firmado", False)
            db.commit()
            return {"status": "success", "message": "Estudio devuelto a transcripción para correcciones.", "pdf_path": None}

        # 🚀 LA MAGIA SUCEDE AQUÍ: BUSCAMOS LA RUTA ABSOLUTA
        BASE_DIR = Path(__file__).resolve().parent.parent.parent
        CARPETA_FIRMAS = BASE_DIR / "storage" / "firmas_seguras"
        
        firma_local = db.query(FirmaRadiologo).filter(FirmaRadiologo.usuario_id == usuario.id).first()
        ruta_firma_fisica = str(CARPETA_FIRMAS / firma_local.nombre_archivo) if firma_local else None

        nombre_medico_final = datos.medico_firma.strip() if datos.medico_firma else "Médico Radiólogo"
        rm_final = datos.registro_medico.strip() if datos.registro_medico else "SIN REGISTRO MÉDICO"

        estudio.informe_texto = datos.informe_final
        estudio.estado_pacs = "Firmado"
        setattr(estudio, "esta_firmado", True)
        setattr(estudio, "tiene_transcripcion", True)
        setattr(estudio, "tiene_dictado", False)
        
        # ---------------------------------------------------------------------
        # 🔥 AQUÍ ESTÁ LA PIEZA FALTANTE: ENLAZAR AL MÉDICO PARA LA GERENCIA
        # ---------------------------------------------------------------------
        if hasattr(estudio, 'medico_id'):
            estudio.medico_id = usuario.id
        elif hasattr(estudio, 'firmado_por'):
            estudio.firmado_por = usuario.id
        elif hasattr(estudio, 'usuario_id'): 
            estudio.usuario_id = usuario.id

        # Guardamos la marca de tiempo exacta para calcular el TAT en el Dashboard
        if hasattr(estudio, 'firmado_en'):
            estudio.firmado_en = datetime.now()
        elif hasattr(estudio, 'fecha_actualizacion'):
            estudio.fecha_actualizacion = datetime.now()
        # ---------------------------------------------------------------------
        
        identificacion = paciente_db.identificacion or paciente_db.id
        
        datos_para_pdf = {
            "nombre_paciente": f"{paciente_db.primer_nombre} {paciente_db.primer_apellido}",
            "id_paciente": identificacion,
            "fecha_estudio": estudio.fecha_estudio.strftime("%Y-%m-%d") if estudio.fecha_estudio else "S/F",
            "modalidad": getattr(estudio, "tipo_estudio", getattr(estudio, "modalidad", "CR")),
            "texto_diagnostico": datos.informe_final,
            "nombre_medico": nombre_medico_final,
            "registro_medico": rm_final,
            "ruta_firma": ruta_firma_fisica # 🚀 PASAMOS LA RUTA A WEASYPRINT
        }
        fecha_referencia = estudio.fecha_estudio if estudio.fecha_estudio else datetime.now()
        
        año = str(fecha_referencia.year)
        mes = f"{fecha_referencia.month:02d}"
        dia = f"{fecha_referencia.day:02d}"

        ruta_destino_fecha = STATIC_PDF_PATH / año / mes / dia
        ruta_destino_fecha.mkdir(parents=True, exist_ok=True)

        nombre_archivo = f"Reporte_{identificacion}.pdf"
        ruta_fisica_salida = os.path.join(str(ruta_destino_fecha), nombre_archivo)

        construir_reporte_pdf(datos_para_pdf, ruta_fisica_salida)
        
        ruta_pdf_relativa = f"/static/pdf_reports/{año}/{mes}/{dia}/{nombre_archivo}"
        setattr(estudio, "pdf_path", ruta_pdf_relativa) 
        
        db.commit()
        return {"status": "success", "message": "Informe firmado digitalmente y PDF estructurado generado.", "pdf_path": ruta_pdf_relativa}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el proceso: {str(e)}")

from fastapi import Request
from app.models.auditoria_descarga import AuditoriaDescarga # 👈 Import corregido a tu estructura

def registrar_auditoria(db: Session, request: Request, estudio_id: int, tipo: str, resultado: str = "ok", usuario_id: int = None, email: str = None):
    try:
        ip_real = request.client.host if request.client else "Local"
        if "x-forwarded-for" in request.headers:
            ip_real = request.headers["x-forwarded-for"].split(",")[0]
        
        nueva_auditoria = AuditoriaDescarga(
            estudio_id=estudio_id,
            usuario_id=usuario_id,
            email=email,
            ip=ip_real,
            tipo=tipo.lower(),
            resultado=resultado.lower()
        )
        db.add(nueva_auditoria)
        db.commit()
    except Exception as e:
        print(f"⚠️ Error silencioso al registrar auditoría: {e}")
        db.rollback()
    
@router.get("/{paciente_id}/descargar-pdf")
def descargar_pdf_paciente(paciente_id: int, request: Request, db: Session = Depends(get_db)):
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente: raise HTTPException(status_code=404, detail="Paciente no localizado")

    # Necesitamos el estudio para cumplir con tu modelo relacional
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")

    identificacion = paciente.identificacion or paciente.id
    nombre_pdf = f"Reporte_{identificacion}.pdf"

    for raiz, directorios, archivos in os.walk(str(STATIC_PDF_PATH)):
        if nombre_pdf in archivos:
            ruta_exacta = os.path.join(raiz, nombre_pdf)
            
            # 🛡️ GATILLO DE AUDITORÍA: DESCARGA EXITOSA
            registrar_auditoria(db, request, estudio_id=estudio.id, tipo="pdf", resultado="ok")
            
            return FileResponse(ruta_exacta, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={nombre_pdf}"})

    # 🛡️ GATILLO DE AUDITORÍA: INTENTO FALLIDO (Archivo no encontrado)
    registrar_auditoria(db, request, estudio_id=estudio.id, tipo="pdf", resultado="denegado")
    raise HTTPException(status_code=404, detail=f"No se encontró el PDF: {nombre_pdf}")

class ExportacionInput(BaseModel):
    estudios_ids: List[Union[int, str]]
    incluir_visor: bool = True  
    modo_destino: str = "EXPLORADOR"

@router.post("/exportar/medios-externos")
def exportar_medios_externos(datos: ExportacionInput, request: Request, db: Session = Depends(get_db)):
    try:
        if not datos.estudios_ids: raise ValueError("No se suministraron estudios al motor físico.")

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

            if not carpeta_seleccionada: raise ValueError("Operación cancelada. No seleccionaste ninguna carpeta de destino.")
            unidad_destino = os.path.join(carpeta_seleccionada, "MI_PACS_EXPORT")
            os.makedirs(unidad_destino, exist_ok=True)

        elif datos.modo_destino == "CD_DVD":
            letras_unidades = [f"{chr(i)}:" for i in range(68, 91)]
            for letra in letras_unidades:
                ruta_base = f"{letra}\\"
                try:
                    if os.path.exists(ruta_base):
                        archivo_prueba = os.path.join(ruta_base, ".mipacs_test")
                        with open(archivo_prueba, 'w') as f: f.write('1')
                        os.remove(archivo_prueba)
                        ruta_definitiva = f"{letra}\\MI_PACS_EXPORT"
                        os.makedirs(ruta_definitiva, exist_ok=True)
                        unidad_destino = ruta_definitiva
                        break
                except Exception:
                    continue

            if not unidad_destino: raise ValueError("No se detectó ningún CD o DVD grabable insertado.")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        carpeta_lote = os.path.join(unidad_destino, f"Lote_Diagnostico_{timestamp}")
        os.makedirs(carpeta_lote, exist_ok=True)

        estudios_procesados = 0

        for item_id in datos.estudios_ids:
            # 1. RECUPERAR EL ESTUDIO EXACTO
            estudio_db = db.query(Estudio).filter(Estudio.id == item_id).first()
            if not estudio_db: continue

            paciente_db = estudio_db.paciente
            p_nombre = (paciente_db.primer_nombre or "").strip()
            p_apellido = (paciente_db.primer_apellido or "").strip()
            nombre_paciente = f"{p_nombre}_{p_apellido}".replace(" ", "_")
            if not nombre_paciente or nombre_paciente == "_": nombre_paciente = "PACIENTE_DESCONOCIDO"
            
            identificacion_paciente = str(paciente_db.identificacion or paciente_db.id).strip()
            carpeta_paciente = os.path.join(carpeta_lote, f"{nombre_paciente}_ID{identificacion_paciente}")
            os.makedirs(carpeta_paciente, exist_ok=True)

            # 2. IDENTIFICADORES DEL ESTUDIO (Para el aislamiento)
            target_uid = str(getattr(estudio_db, "study_instance_uid", "")).strip()
            target_modality = str(getattr(estudio_db, "tipo_estudio", getattr(estudio_db, "modalidad", ""))).strip().upper()
            
            if not target_uid and hasattr(estudio_db, "dicom_metadata") and estudio_db.dicom_metadata:
                import json
                try: 
                    meta = json.loads(estudio_db.dicom_metadata)
                    target_uid = str(meta.get("StudyInstanceUID", "")).strip()
                except: pass

            # 3. RECOPILACIÓN DE RUTAS SOSPECHOSAS
            rutas_validas = set()
            r1 = getattr(estudio_db, "ruta_archivos", None)
            r2 = getattr(estudio_db, "ruta_dicom", None)
            if r1 and os.path.exists(r1): rutas_validas.add(r1)
            if r2 and os.path.exists(r2): rutas_validas.add(r2)
            if target_uid:
                ruid = os.path.join(str(DICOM_ARCHIVADOS_DIR), target_uid)
                if os.path.exists(ruid): rutas_validas.add(ruid)

            base_dir = str(DICOM_ARCHIVADOS_DIR)
            if os.path.exists(base_dir):
                import pydicom
                for folder_name in os.listdir(base_dir):
                    folder_path = os.path.join(base_dir, folder_name)
                    if os.path.isdir(folder_path) and folder_path not in rutas_validas:
                        all_files = [os.path.join(dp, f) for dp, dn, filenames in os.walk(folder_path) for f in filenames]
                        for f in all_files[:5]: 
                            try:
                                ds = pydicom.dcmread(f, stop_before_pixels=True, force=True)
                                p_id = str(getattr(ds, "PatientID", "")).strip()
                                # Solo marcamos la carpeta si vemos que Melquecidec está ahí
                                if identificacion_paciente in p_id or p_id in identificacion_paciente:
                                    rutas_validas.add(folder_path)
                                    break
                            except:
                                continue

            carpeta_dicom_destino = os.path.join(carpeta_paciente, "IMAGENES_DICOM")
            os.makedirs(carpeta_dicom_destino, exist_ok=True)

            # 🚀 4. EL BUCLE DE BARRERA DE TITANIO (FILTRO ARCHIVO POR ARCHIVO)
            archivos_copiados = 0
            if rutas_validas:
                import pydicom
                try:
                    for ruta in rutas_validas:
                        for root, dirs, files in os.walk(ruta):
                            for file in files:
                                src_file = os.path.join(root, file)
                                
                                try:
                                    ds = pydicom.dcmread(src_file, stop_before_pixels=True, force=True)
                                    file_pid = str(getattr(ds, "PatientID", "")).strip()
                                    file_uid = str(getattr(ds, "StudyInstanceUID", "")).strip()
                                    file_mod = str(getattr(ds, "Modality", "")).strip().upper()
                                    
                                    # 🚨 BARRERA 1: IDENTIDAD ESTRICTA DEL PACIENTE
                                    # Si la cédula del archivo no coincide con Melquecidec, IGNORA EL ARCHIVO (Bloquea a Leidy)
                                    if identificacion_paciente not in file_pid and file_pid not in identificacion_paciente:
                                        continue 

                                    # 🚨 BARRERA 2: AISLAMIENTO EXACTO DEL ESTUDIO
                                    if target_uid and file_uid and target_uid != file_uid:
                                        continue # Es Melquecidec, pero pertenece a un TAC que no seleccionaste
                                        
                                    # BARRERA 2 DE RESPALDO: Si no tenemos UID en la DB, filtramos por Modalidad
                                    elif not target_uid and target_modality and file_mod:
                                        if target_modality not in file_mod and file_mod not in target_modality:
                                            # Los equipos antiguos a veces mezclan DX con CR. Les damos permiso de convivir.
                                            if target_modality in ["CR", "DX"] and file_mod in ["CR", "DX"]:
                                                pass
                                            else:
                                                continue # Es Melquecidec, pero es CT y tú pediste CR/DX.
                                
                                except Exception:
                                    continue # Si no es un archivo DICOM, lo ignoramos

                                # ¡SI LLEGA AQUÍ, ES EL ARCHIVO CORRECTO Y PURO!
                                archivos_copiados += 1
                                nombre_unico = f"IMG_{archivos_copiados:05d}.dcm"
                                dest_file = os.path.join(carpeta_dicom_destino, nombre_unico)
                                shutil.copy2(src_file, dest_file)
                                
                    print(f"✅ EXPORTACIÓN AISLADA DE GRADO MÉDICO: {archivos_copiados} archivos DICOM transferidos para estudio ID: {item_id}.")
                    # 🛡️ GATILLO DE AUDITORÍA: EXPORTACIÓN EXITOSA
                    registrar_auditoria(db, request, estudio_id=estudio_db.id, tipo=datos.modo_destino, resultado="ok")
                except Exception as e:
                    print(f"❌ Error en copia multiserie: {e}")
            else:
                print(f"⚠️ No se encontró la ruta para el estudio {item_id}.")

            pdf_nombre = f"Reporte_{identificacion_paciente}.pdf"
            ruta_pdf_origen = os.path.join(str(STATIC_PDF_PATH), pdf_nombre)
            if os.path.exists(ruta_pdf_origen):
                try: shutil.copy2(ruta_pdf_origen, carpeta_paciente)
                except: pass

            estudios_procesados += 1

        if datos.incluir_visor:
            ruta_visor_origen = os.path.join(str(STATIC_DIR), "visor_portable")
            carpeta_visor_destino = os.path.join(carpeta_lote, "MI_PACS_Visor_Lite")
            if os.path.exists(ruta_visor_origen):
                try: shutil.copytree(ruta_visor_origen, carpeta_visor_destino, dirs_exist_ok=True)
                except: pass

        estado_visor_msg = " (Con Visor Lite incluido)" if datos.incluir_visor else ""
        return {"status": "success", "message": f"Se grabaron y empaquetaron {estudios_procesados} estudios{estado_visor_msg} en:\n{unidad_destino}"}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo del Motor Físico: {str(e)}")

class IARequest(BaseModel):
    texto_actual: str

@router.post("/{paciente_id}/asistencia-ia")
def asistencia_ia(paciente_id: int, datos: IARequest, db: Session = Depends(get_db)):
    try:
        estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
        if not estudio: raise HTTPException(status_code=404, detail="Imagen o estudio no encontrado.")

        imagen_db = db.query(EstudioImagen).filter(EstudioImagen.estudio_id == estudio.id).first()
        if not imagen_db or not imagen_db.thumbnail: raise HTTPException(status_code=404, detail="Imagen o estudio no encontrado.")

        ruta_relativa = imagen_db.thumbnail.lstrip("/")
        imagen_a_usar = Path(STATIC_DIR).parent / ruta_relativa

        if not imagen_a_usar.exists(): raise HTTPException(status_code=404, detail="Imagen o estudio no encontrado.")
        img = Image.open(imagen_a_usar)
        
    except HTTPException as he: raise he
    except Exception as e: raise HTTPException(status_code=500, detail=f"Fallo técnico al cargar la imagen: {str(e)}")

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
        response = client.models.generate_content(model='gemini-3.5-flash', contents=[img, prompt])
        return {"sugerencia": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en el motor de análisis clínico automatizado: {str(e)}")

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
        response = client.models.generate_content(model='gemini-3.5-flash', contents=[img, prompt])
        return {"sugerencia": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en el motor de análisis clínico automatizado: {str(e)}")
    
class RechazoImagenInput(BaseModel):
    nota_rechazo: str

@router.post("/{paciente_id}/rechazar-estudio-imagen")
def rechazar_estudio_imagen(paciente_id: int, datos: RechazoImagenInput, db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    if not datos.nota_rechazo.strip(): raise HTTPException(status_code=400, detail="Debe proporcionar un motivo médico para el rechazo técnico.")

    try:
        estudio.estado_pacs = "Rechazado"
        if hasattr(estudio, "nota_medico"):
            setattr(estudio, "nota_medico", f"🚨 RECHAZO TÉCNICO ({datetime.now().strftime('%Y-%m-%d')}): {datos.nota_rechazo.strip()}")
        db.commit()
        return {"status": "success", "message": "Estudio marcado como Rechazado por control de calidad técnica."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el guardado del rechazo: {str(e)}")

class CancelacionInput(BaseModel):
    motivo_cancelacion: str

@router.post("/{paciente_id}/cancelar-estudio")
def cancelar_estudio_definitivo(paciente_id: int, datos: CancelacionInput, db: Session = Depends(get_db)):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    if not datos.motivo_cancelacion.strip(): raise HTTPException(status_code=400, detail="Debe proporcionar un motivo para la cancelación.")

    try:
        estudio.estado_pacs = "Cancelado"
        if hasattr(estudio, "nota_medico"):
            setattr(estudio, "nota_medico", f"🚫 CANCELADO DEFINITIVO ({datetime.now().strftime('%Y-%m-%d')}): {datos.motivo_cancelacion.strip()}")
        db.commit()
        return {"status": "success", "message": "Estudio abortado y archivado correctamente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cancelar: {str(e)}")

# =====================================================================
# 🚀 ENDPOINT EXCLUSIVO PARA PRODUCTIVIDAD DE TECNÓLOGOS
# =====================================================================
@router.post("/{paciente_id}/marcar-tomado")
def marcar_estudio_tomado(paciente_id: int, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    """
    Permite al Tecnólogo validar un estudio Importado y asignárselo a sus métricas de productividad.
    """
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: 
        raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    try:
        # 1. Cambiamos el estado visible y apagamos la bandera de "Externo/Importado"
        estudio.estado_pacs = "Tomado"
        if hasattr(estudio, "es_externo"):
            setattr(estudio, "es_externo", False)
            
        # 2. 🔥 ENLAZAMOS AL TECNÓLOGO PARA LA AUDITORÍA GERENCIAL
        if hasattr(estudio, 'tecnologo_id'):
            estudio.tecnologo_id = usuario.id
        elif hasattr(estudio, 'tecnico_id'):
            estudio.tecnico_id = usuario.id
        elif hasattr(estudio, 'usuario_id'): 
            # Fallback por si usan la columna genérica
            estudio.usuario_id = usuario.id

        # 3. Guardamos la hora exacta para los tiempos de respuesta (TAT)
        if hasattr(estudio, 'fecha_actualizacion'):
            from datetime import datetime
            estudio.fecha_actualizacion = datetime.now()

        db.commit()
        return {"status": "success", "message": "Estudio validado y asignado exitosamente al Tecnólogo."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar la productividad técnica: {str(e)}")


# =====================================================================
# 🪄 AUTO-TRANSCRIPCIÓN CON INTELIGENCIA ARTIFICIAL (WHISPER)
# =====================================================================
try:
    import whisper
    # Cargamos el modelo en memoria globalmente al iniciar el servidor 
    modelo_ia_voz = whisper.load_model("base")
except ImportError:
    modelo_ia_voz = None
    print("⚠️ Advertencia: La librería 'openai-whisper' no está instalada.")

@router.post("/{paciente_id}/transcribir-audio")
def auto_transcribir_con_ia(paciente_id: int, db: Session = Depends(get_db)):
    if modelo_ia_voz is None:
        raise HTTPException(status_code=500, detail="Whisper no está instalado en el servidor.")
        
    try:
        # 1. 🧠 CORRECCIÓN DEL "FALSO AMIGO": Recibimos el ID del Paciente (Ej: 22)
        # Buscamos todos sus estudios y tomamos el más reciente que tenga un audio asociado.
        estudios = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).order_by(Estudio.id.desc()).all()
        estudio_con_audio = next((e for e in estudios if getattr(e, "audio_path", None)), None)
        
        if not estudio_con_audio:
            raise HTTPException(status_code=404, detail=f"El paciente en la posición {paciente_id} no tiene audios en la base de datos.")

        # 2. Extraemos el nombre exacto del archivo que tu sistema guardó con la cédula real
        # Ejemplo: "dictado_1110570281_estudio_24.wav"
        ruta_audio_db = estudio_con_audio.audio_path
        nombre_archivo = ruta_audio_db.split("/")[-1]
        
        # 3. 🎯 Búsqueda física a prueba de fallos en el disco duro
        ruta_base = os.path.join(str(STATIC_DIR), "audios_dictado")
        archivo_encontrado = None
        
        if os.path.exists(ruta_base):
            for root, dirs, files in os.walk(ruta_base):
                if nombre_archivo in files:
                    archivo_encontrado = os.path.join(root, nombre_archivo)
                    break
                    
        if not archivo_encontrado:
            raise HTTPException(status_code=404, detail=f"Falta el archivo físico en el disco: {nombre_archivo}")

        # 🪄 MAGIA DE LA IA: Transcribimos el archivo encontrado
        resultado = modelo_ia_voz.transcribe(archivo_encontrado, language="es")
        texto_medico = resultado.get("text", "").strip()
        
        if not texto_medico:
            raise HTTPException(status_code=400, detail="La IA analizó el archivo, pero estaba vacío o contenía solo ruido.")
            
        return {"status": "success", "texto": texto_medico}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("\n" + "="*50)
        print("🚨 ERROR FATAL DE WHISPER 🚨")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=f"Fallo crítico: {str(e)}")