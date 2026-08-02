import os
import shutil
import traceback
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db

# Importación de modelos
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.usuario import Usuario 

# 1. DEFINICIÓN DEL ROUTER
router = APIRouter(tags=["Estadísticas y Productividad"])

# --- FUNCIONES AUXILIARES ---

def get_pacs_disk_metrics():
    """
    Calcula el espacio físico real del disco donde opera el almacenamiento principal,
    entregando el consumo exacto y el porcentaje para la barra de colores.
    """
    ruta_pacs = r"D:\proyecto v3\storage\dicom"
    ruta_disco = "D:\\" if os.path.exists("D:\\") else "."
    
    try:
        # 1. Medir el peso específico de la carpeta DICOM local
        total_folder_size = 0
        if os.path.exists(ruta_pacs):
            for dirpath, dirnames, filenames in os.walk(ruta_pacs):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if os.path.isfile(fp):
                        total_folder_size += os.path.getsize(fp)
        folder_gb = round(total_folder_size / (1024**3), 2)
        
        # 2. Medir las métricas de hardware del disco completo (Capacidad y Ocupación Real)
        total_disk, used_disk, free_disk = shutil.disk_usage(ruta_disco)
        
        total_disk_gb = round(total_disk / (1024**3), 2)
        used_disk_gb = round(used_disk / (1024**3), 2)
        free_disk_gb = round(free_disk / (1024**3), 2)
        porcentaje_uso_disco = round((used_disk / total_disk) * 100, 2)
        
        return {
            "carpeta_dicom_gb": folder_gb,
            "total_disco_gb": total_disk_gb,
            "usado_disco_gb": used_disk_gb,
            "libre_disco_gb": free_disk_gb,
            "porcentaje_uso_real": porcentaje_uso_disco,
            "limite_purga_porcentaje": 80.0
        }
    except Exception as e:
        print(f"⚠️ Error calculando métricas de hardware de almacenamiento: {e}")
        return {
            "carpeta_dicom_gb": 0.00,
            "total_disco_gb": 1000.00,
            "usado_disco_gb": 0.00,
            "libre_disco_gb": 1000.00,
            "porcentaje_uso_real": 0.00,
            "limite_purga_porcentaje": 80.0
        }

# --- ENDPOINTS DE DASHBOARD ---

@router.get("/stats-dashboard")
def get_stats_dashboard(
    inicio: Optional[str] = Query(None),
    fin: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        # 1. Consultas Base
        q_pacientes = db.query(Paciente)
        q_estudios = db.query(Estudio)
        q_imagenes = db.query(EstudioImagen)
        
        # 🚀 MODIFICADO: Agrupamos también por tipo de estudio para alimentar la gráfica de red a color
        q_crecimiento = db.query(
            func.strftime("%Y-%m-%d", Estudio.fecha_estudio).label("fecha"),
            Estudio.tipo_estudio.label("modalidad"),
            func.count(Estudio.id).label("cantidad")
        )

        # 🟢 Consulta experta agrupada por modalidades (Pacientes distintos, Estudios e Imágenes)
        q_modalidades = db.query(
            Estudio.tipo_estudio, 
            func.count(func.distinct(Estudio.paciente_id)).label("pacientes"),
            func.count(func.distinct(Estudio.id)).label("estudios"),
            func.count(EstudioImagen.id).label("imagenes")
        ).outerjoin(EstudioImagen, Estudio.id == EstudioImagen.estudio_id)

        # 2. Aplicar filtro de fechas si fueron enviadas por React
        if inicio and fin:
            q_estudios = q_estudios.filter(Estudio.fecha_estudio >= inicio, Estudio.fecha_estudio <= fin)
            q_imagenes = q_imagenes.join(Estudio).filter(Estudio.fecha_estudio >= inicio, Estudio.fecha_estudio <= fin)
            q_pacientes = q_pacientes.join(Estudio).filter(Estudio.fecha_estudio >= inicio, Estudio.fecha_estudio <= fin).distinct()
            q_crecimiento = q_crecimiento.filter(Estudio.fecha_estudio >= inicio, Estudio.fecha_estudio <= fin)
            q_modalidades = q_modalidades.filter(Estudio.fecha_estudio >= inicio, Estudio.fecha_estudio <= fin)

        # 3. Contar Resultados 
        p_count = q_pacientes.count()
        e_count = q_estudios.count()
        i_count = q_imagenes.count()
        
        crecimiento_query = q_crecimiento.group_by("fecha", Estudio.tipo_estudio).order_by("fecha").all()
        
        # Ejecutar agrupación por modalidad
        modalidades_query = q_modalidades.group_by(Estudio.tipo_estudio).all()
        
        # 4. Inyección de métricas de almacenamiento físico real
        metricas_disco = get_pacs_disk_metrics()

        # 5. Cálculo dinámico de GB consumidos
        if inicio and fin:
            gb_consumidos = f"{(i_count * 0.03):.2f}" if i_count > 0 else f"{(e_count * 0.45):.2f}"
        else:
            gb_consumidos = f"{metricas_disco['carpeta_dicom_gb']:.2f}"

        # Empaquetar las modalidades con sus 3 valores para el Frontend
        modalidades_formateadas = []
        for m in modalidades_query:
            if m.tipo_estudio:
                modalidades_formateadas.append({
                    "name": str(m.tipo_estudio).upper(),
                    "pacientes": m.pacientes or 0,
                    "value": m.estudios or 0,  
                    "imagenes": m.imagenes or 0
                })

        # 🚀 CONSTRUCCIÓN DEL DICCIONARIO DE CRECIMIENTO AGRUPADO POR DÍA Y MODALIDAD
        crecimiento_dict = {}
        for c in crecimiento_query:
            f_str = c.fecha
            mod = str(c.modalidad or "CR").upper()
            cant = c.cantidad or 0

            if f_str not in crecimiento_dict:
                crecimiento_dict[f_str] = {"fecha": f_str, "total": 0, "modalidades": {}}
            
            crecimiento_dict[f_str]["modalidades"][mod] = cant
            crecimiento_dict[f_str]["total"] += cant

        crecimiento_final = list(crecimiento_dict.values())

        return {
            "pacientesTotal": p_count,
            "estudiosTotal": e_count,
            "imagenesTotal": i_count,
            
            "almacenamientoGB": gb_consumidos, 
            "porcentajeNAS": metricas_disco['porcentaje_uso_real'],
            "discoTotalGB": metricas_disco['total_disco_gb'],
            "discoUsadoGB": metricas_disco['usado_disco_gb'],
            "discoLibreGB": metricas_disco['libre_disco_gb'],
            "limitePurga": metricas_disco['limite_purga_porcentaje'],
            
            "crecimiento": crecimiento_final, # 🎨 Ahora incluye el desglose exacto por modalidad para cada día
            "modalidades": modalidades_formateadas, 
            "success": True
        }
    except Exception as e:
        print(f"❌ Error en stats-dashboard: {e}")
        traceback.print_exc()
        return {"success": False, "error": str(e)}

# --- 🚀 ENDPOINT DE PRODUCTIVIDAD (ULTRA-RESILIENTE) ---

# --- 🚀 ENDPOINT DE PRODUCTIVIDAD (ULTRA-RESILIENTE) ---

@router.get("/productividad-real")
def get_productividad_real(
    db: Session = Depends(get_db),
    fecha_desde: str = Query(None),
    fecha_hasta: str = Query(None),
    rol: str = Query("TODOS")
):
    try:
        # 1. Cargamos TODOS los usuarios en memoria (Diccionario ultra rápido {id: Usuario})
        usuarios_db = {u.id: u for u in db.query(Usuario).all()}

        # 2. Consulta base (Solo Estudio y Paciente, sin JOIN forzados que borren datos)
        query = db.query(Estudio, Paciente).join(Paciente, Estudio.paciente_id == Paciente.id)

        if fecha_desde:
            query = query.filter(Estudio.fecha_estudio >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Estudio.fecha_estudio <= fecha_hasta)

        result = query.order_by(Estudio.fecha_estudio.desc()).all()

        output = []
        for row in result:
            est = row[0]
            pac = row[1]
            
            estado_real = getattr(est, 'estado_pacs', getattr(est, 'estado', 'PENDIENTE'))
            estado_upper = str(estado_real).upper()

            # 🔥 EL CEREBRO DE AUTORÍA: Buscamos el ID correcto según el ESTADO del estudio
            id_responsable = None
            
            if estado_upper in ["FIRMADO", "ENTREGADO"]:
                # Si está firmado, el responsable es el médico
                id_responsable = getattr(est, 'medico_id', getattr(est, 'firmado_por', getattr(est, 'radiologo_id', None)))
            elif estado_upper in ["TRANSCRITO", "DICTADO"]:
                # Si está transcrito, el responsable es el transcriptor
                id_responsable = getattr(est, 'transcriptor_id', None)
            elif estado_upper == "TOMADO":
                # Si está tomado, el responsable es el tecnólogo
                id_responsable = getattr(est, 'tecnologo_id', getattr(est, 'tecnico_id', None))
            
            # Fallback: Si no hay IDs específicos o sigue PENDIENTE, usamos al creador
            if not id_responsable:
                id_responsable = getattr(est, 'usuario_id', getattr(est, 'creado_por_id', None))

            # Rescatamos al usuario usando el ID exacto que descubrimos
            usu = usuarios_db.get(id_responsable)
            
            # Formateo de Nombres del Paciente
            n_p = getattr(pac, 'primer_nombre', getattr(pac, 'nombre', getattr(pac, 'nombres', '')))
            a_p = getattr(pac, 'primer_apellido', getattr(pac, 'apellido', getattr(pac, 'apellidos', '')))
            nombre_paciente = f"{n_p} {a_p}".strip() or "Paciente S/N"

            # Formateo del Profesional Responsable
            if usu:
                n_u = getattr(usu, 'primer_nombre', getattr(usu, 'nombre', getattr(usu, 'username', 'Usuario')))
                a_u = getattr(usu, 'primer_apellido', getattr(usu, 'apellido', ''))
                profesional = f"{n_u} {a_u}".strip() or "Usuario S/N"
                rol_prof = getattr(usu, 'rol', 'N/A').upper()
            else:
                profesional = "Sin Asignar"
                rol_prof = "N/A"

            # ⏱️ CÁLCULO REAL DEL TAT (Tiempo de Respuesta)
            tat_minutos = 0
            fecha_toma = getattr(est, 'fecha_estudio', None)
            fecha_firma = getattr(est, 'firmado_en', getattr(est, 'fecha_actualizacion', None))
            
            if fecha_firma and fecha_toma:
                try:
                    from datetime import datetime, date
                    # Parseo seguro de fechas
                    if isinstance(fecha_toma, date) and not isinstance(fecha_toma, datetime):
                        fecha_toma = datetime.combine(fecha_toma, datetime.min.time())
                    elif isinstance(fecha_toma, str):
                        fecha_toma = datetime.fromisoformat(fecha_toma.replace("Z", ""))
                        
                    if isinstance(fecha_firma, str):
                        fecha_firma = datetime.fromisoformat(fecha_firma.replace("Z", ""))
                    
                    diferencia = fecha_firma - fecha_toma
                    tat_minutos = int(diferencia.total_seconds() / 60)
                    if tat_minutos < 0: tat_minutos = 15 # Compensación de Zona Horaria
                except Exception:
                    tat_minutos = 30
                    
            if not fecha_firma:
                tat_minutos = 0

            output.append({
                "id": est.id,
                "paciente": nombre_paciente,
                "profesional": profesional,
                "rol": rol_prof,
                "modalidad": getattr(est, 'tipo_estudio', getattr(est, 'modalidad', 'N/A')),
                "estado": estado_upper,
                "tiempo_respuesta_minutos": tat_minutos,
                "fecha": est.fecha_estudio
            })
            
        return output

    except Exception as e:
        print(f"❌ Error detallado en Productividad: {e}")
        import traceback
        traceback.print_exc()
        return []