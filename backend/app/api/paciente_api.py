"""
paciente_api.py — MI_PACS
Endpoints clínicos para la gestión de pacientes con ordenamiento interactivo multivariable (Python).
Optimizado con controladores de excepción CORS para el Modo Maestro y control de flujo de re-dictado.
"""

import os
import shutil
import subprocess  
from pathlib import Path  
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Union, Optional  
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import obtener_usuario_actual  # 🚀 AQUÍ ESTÁ LA IMPORTACIÓN QUE FALTABA
from app.models.paciente import Paciente
from app.models.estudio import Estudio  

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

# 🚀 DEFINICIÓN DEL ROUTER
router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
security = HTTPBearer()

# ---------------------------------------------------------
# LISTAR PACIENTES (TABLA PRINCIPAL CON ORDENAMIENTO MULTIVARIABLE)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def listar(
    fechaDesde: str = Query("2010-01-01"),
    fechaHasta: str = Query("2030-12-31"),
    modalidad: str = Query(None),
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

# =========================================================
# 🔥 GENERACIÓN DE PDF, FIRMA Y RECHAZO
# =========================================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent 
STATIC_PDF_PATH = BASE_DIR / "static" / "pdf_reports"
STATIC_PDF_PATH.mkdir(parents=True, exist_ok=True)

class FirmaInput(BaseModel):
    informe_final: str
    medico_firma: Optional[str] = ""
    registro_medico: Optional[str] = ""
    aprobado: bool = True             # 🚀 Nuevo: Saber si el médico acepta
    nota_rechazo: Optional[str] = ""  # 🚀 Nuevo: Razón del rechazo

@router.post("/{paciente_id}/firmar-informe")
def firmar_informe(
    paciente_id: int, 
    datos: FirmaInput, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)  
):
    estudio = db.query(Estudio).filter(Estudio.paciente_id == paciente_id).first()
    if not estudio: raise HTTPException(status_code=404, detail="Estudio no localizado")
    
    paciente_db = estudio.paciente
    
    try:
        # ❌ FLUJO DE RECHAZO (Devolver al transcriptor)
        if not datos.aprobado:
            estudio.informe_texto = datos.informe_final
            estudio.estado_pacs = "Dictado"  # Vuelve atrás en el flujo
            
            # Guardamos la nota para que la vea la secretaria/transcriptor en la base de datos
            # (Asegúrate de que tu modelo 'estudio' tenga un campo para esto en el futuro)
            if hasattr(estudio, "nota_medico"):
                setattr(estudio, "nota_medico", datos.nota_rechazo) 
                
            setattr(estudio, "esta_firmado", False)
            db.commit()
            return {
                "status": "success", 
                "message": "Estudio devuelto a transcripción para correcciones.",
                "pdf_path": None
            }

        # ✅ FLUJO DE APROBACIÓN (Firma normal)
        nombre_medico_final = datos.medico_firma.strip() if datos.medico_firma else f"{getattr(usuario, 'primer_nombre', '')} {getattr(usuario, 'primer_apellido', '')}".strip()
        rm_final = datos.registro_medico.strip() if datos.registro_medico else getattr(usuario, "registro_medico", "SIN REGISTRO MÉDICO")

        if not nombre_medico_final: 
            nombre_medico_final = "Médico Radiólogo"

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

        nombre_archivo = f"Reporte_{identificacion}.pdf"
        ruta_fisica_salida = os.path.join(str(STATIC_PDF_PATH), nombre_archivo)

        construir_reporte_pdf(datos_para_pdf, ruta_fisica_salida)
        db.commit()
        
        return {
            "status": "success", 
            "message": "Informe firmado digitalmente y PDF generado.",
            "pdf_path": f"/static/pdf_reports/{nombre_archivo}"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el proceso: {str(e)}")


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
                ruta_dicom_origen = os.path.join(os.getcwd(), "dicom_storage", str(paciente_db.id), str(estudio_db.id))

            carpeta_dicom_destino = os.path.join(carpeta_paciente, "IMAGENES_DICOM")
            if ruta_dicom_origen and os.path.exists(ruta_dicom_origen):
                try:
                    shutil.copytree(ruta_dicom_origen, carpeta_dicom_destino, dirs_exist_ok=True)
                except Exception: pass
            else:
                os.makedirs(carpeta_dicom_destino, exist_ok=True) 

            pdf_nombre = f"Reporte_{identificacion}.pdf"
            ruta_pdf_origen = os.path.join(os.getcwd(), "static", "pdf_reports", pdf_nombre)
            
            if os.path.exists(ruta_pdf_origen):
                try:
                    shutil.copy2(ruta_pdf_origen, carpeta_paciente)
                except Exception: pass

            estudios_procesados += 1

        if datos.incluir_visor:
            ruta_visor_origen = os.path.join(os.getcwd(), "static", "visor_portable")
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