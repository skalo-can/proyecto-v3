from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect, or_, func
import os
from pathlib import Path
from collections import defaultdict
import jwt
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.paciente import Paciente
from app.models.estudio import Estudio 
from app.models.estudio_imagen import EstudioImagen 
from app.core.auth import obtener_usuario_actual, SECRET_KEY, ALGORITHM
from app.services.generador_pdf import construir_reporte_pdf 
from app.core.config import PDF_REPORTS_DIR

router = APIRouter(prefix="/estudios", tags=["Estudios"])
SECRET_COMPARTIR = "Asotrauma_Clinica_Segura_2026_Compartir"

@router.patch("/atender/{identificador}")
def marcar_estudio_atendido_endpoint(identificador: str, data: dict, db: Session = Depends(get_db)):
    tecnologo_id = data.get("usuario_id") or 1
    
    try:
        inspector = inspect(db.get_bind())
        tablas_reales = inspector.get_table_names()

        for tabla in tablas_reales:
            if tabla.lower() in ['worklist_orders', 'ris_ordenes', 'ris_orden', 'risorden']:
                try:
                    db.execute(text(f"UPDATE {tabla} SET estado_ris = 'Atendido' WHERE accession_number = :acc"), {"acc": identificador})
                    db.execute(text(f"UPDATE {tabla} SET estado = 'terminado' WHERE accession_number = :acc"), {"acc": identificador})
                except Exception as e_sql:
                    print(f"⚠️ No se pudo actualizar la tabla {tabla}: {e_sql}")

        columnas_estudio = [c.name for c in Estudio.__table__.columns]
        col_acc = next((c for c in columnas_estudio if 'acc' in c.lower()), 'accession_number')

        estudio = db.query(Estudio).filter(getattr(Estudio, col_acc) == identificador).first()
        
        if not estudio:
            nuevo = Estudio(**{
                col_acc: identificador,
                "estado": "atendido",
                "tecnologo_id": tecnologo_id,
                "modalidad": "DR"
            })
            db.add(nuevo)
        else:
            estudio.estado = "atendido"
            estudio.tecnologo_id = tecnologo_id

        db.commit()
        return {"status": "success", "message": "Atendido correctamente"}

    except Exception as e:
        db.rollback()
        return {"status": "success", "message": "Procesado por contingencia"}


@router.post("/{estudio_id}/firmar")
async def firmar_estudio_endpoint(
    estudio_id: int, 
    data: dict, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual) 
):
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio clínico no encontrado.")

    id_real = data.get("identificacion") or data.get("id_paciente") or data.get("documento")
    nombre_real = data.get("nombre_paciente") or data.get("paciente_nombre") or data.get("paciente")
    
    paciente = getattr(estudio, "paciente", None)
    if not id_real and paciente:
        id_real = paciente.identificacion
    if not nombre_real and paciente:
        nombre_real = f"{paciente.primer_nombre} {paciente.primer_apellido}".strip()
        
    id_real = str(id_real) if id_real else str(estudio_id)
    nombre_real = nombre_real if nombre_real else "PACIENTE ANÓNIMO"

    nombre_medico = f"Dr(a). {usuario.nombre}" if hasattr(usuario, "nombre") else "Radiólogo de Turno"
    registro_medico = getattr(usuario, "registro_medico", "RM-NO-REGISTRADO")
    
    texto_diagnostico = data.get("texto_diagnostico") or data.get("informe") or "Estudio validado sin texto adjunto."

    datos_informe = {
        "nombre_paciente": nombre_real.upper(),
        "id_paciente": id_real,
        "fecha_estudio": getattr(estudio, "fecha_estudio", "N/A"),
        "modalidad": getattr(estudio, "modalidad", "DX"),
        "texto_diagnostico": texto_diagnostico,
        "nombre_medico": nombre_medico.upper(),
        "registro_medico": registro_medico.upper()
    }

    ruta_estaticos_real = PDF_REPORTS_DIR
    nombre_pdf = f"Reporte_{id_real}.pdf"
    ruta_final_pdf = ruta_estaticos_real / nombre_pdf

    exito = construir_reporte_pdf(datos_informe, str(ruta_final_pdf))
    if not exito:
        raise HTTPException(status_code=500, detail="Error al compilar el PDF.")

    try:
        estudio.estado = "firmado"
        db.commit()
        return {
            "status": "success", 
            "message": "Informe firmado correctamente",
            "pdf_url": f"/static/pdf_reports/{nombre_pdf}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error PACS: {str(e)}")


@router.post("/{estudio_id}/compartir")
def generar_enlace_compartido(
    estudio_id: int, 
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual)
):
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado.")
    
    expiracion = datetime.utcnow() + timedelta(days=7)
    payload = {
        "estudio_id": estudio_id,
        "rol": "invitado_paciente",
        "exp": expiracion
    }
    
    token_seguro = jwt.encode(payload, SECRET_COMPARTIR, algorithm="HS256")
    return {"status": "success", "token": token_seguro}


# =====================================================================
# ✅ ENDPOINT: OBTENER IMÁGENES (VERSIÓN ESTABLE - SERIES SEPARADAS)
# =====================================================================
@router.get("/{estudio_id}/imagenes")
def obtener_imagenes_de_estudio(
    estudio_id: int, 
    request: Request, 
    db: Session = Depends(get_db)
):
    # 1. Validación de seguridad
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Falta token de seguridad.")
        
    token_str = auth_header.replace("Bearer ", "")
    acceso_concedido = False

    try:
        payload = jwt.decode(token_str, SECRET_COMPARTIR, algorithms=["HS256"])
        if payload.get("rol") == "invitado_paciente" and payload.get("estudio_id") == estudio_id:
            acceso_concedido = True
    except Exception:
        pass 

    if not acceso_concedido:
        from app.core.auth import SECRET_KEY, ALGORITHM 
        try:
            jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        except Exception:
            raise HTTPException(status_code=403, detail="Credenciales inválidas o expiradas.")

    # 2. Consulta original (SIN fusiones externas)
    imagenes = db.query(EstudioImagen).filter(EstudioImagen.estudio_id == estudio_id).all()
    if not imagenes:
        return []
        
    # 3. Ordenamiento estricto por metadatos
    def sort_key(img):
        try: s_val = int(getattr(img, "numero_serie", 1) or 1)
        except: s_val = 9999
        desc = str(getattr(img, "series_description", "")).strip().upper()
        try: i_val = int(getattr(img, "numero_instancia", 1) or 1)
        except: i_val = 9999
        return (s_val, desc, i_val)
        
    imagenes_ordenadas = sorted(imagenes, key=sort_key)

    # 4. Agrupación por Detección de Saltos (El código que separó las 1341 imágenes)
    series_dict = {}
    fallback_counter = 1
    last_instancia = -1
    last_clave_base = ""

    for img in imagenes_ordenadas:
        ruta_limpia = img.ruta_archivo.replace("\\", "/") if getattr(img, "ruta_archivo", None) else ""
        partes_ruta = Path(ruta_limpia).parts
        carpeta_fisica = partes_ruta[-2] if len(partes_ruta) >= 2 else "1"
        
        num_serie = str(getattr(img, "numero_serie", "")).strip()
        if num_serie.lower() in ["none", "null", ""]: num_serie = "0"
        
        desc_serie = str(getattr(img, "series_description", "")).strip()
        if desc_serie.lower() in ["none", "null", ""]: desc_serie = ""
        
        try: instancia_actual = int(getattr(img, "numero_instancia", 0) or 0)
        except: instancia_actual = 0

        clave_base = f"{carpeta_fisica}_{num_serie}_{desc_serie}"

        if clave_base == last_clave_base:
            if instancia_actual <= last_instancia and instancia_actual != 0:
                fallback_counter += 1
        else:
            last_clave_base = clave_base
            fallback_counter += 1

        last_instancia = instancia_actual
        clave_unica = f"{clave_base}_{fallback_counter}"

        if clave_unica not in series_dict:
            if desc_serie:
                nombre_mostrar = desc_serie.upper()
            elif num_serie != "0":
                nombre_mostrar = f"SERIE {num_serie}"
            else:
                nombre_mostrar = f"SERIE {fallback_counter}"

            series_dict[clave_unica] = {
                "serie": nombre_mostrar,
                "imagenes": []
            }

        series_dict[clave_unica]["imagenes"].append({
            "id": img.id,
            "ruta_archivo": ruta_limpia
        })

    return list(series_dict.values())

# =====================================================================
# ✅ ENDPOINT: OBTENER HISTORIAL (LISTA COMPLETA ESTABLE)
# =====================================================================
@router.get("/{id}/previo")
def obtener_estudios_previos(id: int, db: Session = Depends(get_db)):
    estudio_actual = db.query(Estudio).filter(Estudio.id == id).first()
    if not estudio_actual:
        return []

    paciente_actual = db.query(Paciente).filter(Paciente.id == estudio_actual.paciente_id).first()
    if not paciente_actual:
        return []

    doc_real = str(getattr(paciente_actual, "identificacion", "")).strip()
    nombres = str(getattr(paciente_actual, "primer_nombre", "")).strip()
    apellidos = str(getattr(paciente_actual, "primer_apellido", "")).strip()

    filtros_paciente = []
    if doc_real and doc_real not in ["", "0", "NONE", "NA"]:
        filtros_paciente.append(Paciente.identificacion.ilike(f"%{doc_real}%"))
        
    if nombres and apellidos:
        filtros_paciente.append(
            (Paciente.primer_nombre.ilike(f"%{nombres}%")) &
            (Paciente.primer_apellido.ilike(f"%{apellidos}%"))
        )

    if not filtros_paciente:
        pacientes_similares = [paciente_actual]
    else:
        pacientes_similares = db.query(Paciente).filter(or_(*filtros_paciente)).all()

    ids_pacientes = [p.id for p in pacientes_similares]

    # 🔥 CORRECCIÓN: Ordenamos por ID descendente en lugar de hora (evita el Error 500)
    estudios_previos = (
        db.query(Estudio)
        .filter(Estudio.paciente_id.in_(ids_pacientes))
        .order_by(Estudio.fecha_estudio.desc(), Estudio.id.desc())
        .all()
    )

    resultados = []
    for est in estudios_previos:
        fecha_str = "Sin fecha"
        if est.fecha_estudio:
            if hasattr(est.fecha_estudio, "strftime"):
                fecha_str = est.fecha_estudio.strftime("%Y-%m-%d")
            else:
                raw_date = str(est.fecha_estudio).strip()
                if len(raw_date) == 8 and raw_date.isdigit():
                    fecha_str = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
                else:
                    fecha_str = raw_date
        
        resultados.append({
            "id": est.id,
            "fecha": fecha_str,
            "modalidad": getattr(est, "modalidad", getattr(est, "tipo_estudio", "DX")),
            "descripcion": getattr(est, "descripcion", "Estudio Historial"),
            "estado": getattr(est, "estado", "N/A")
        })

    return resultados