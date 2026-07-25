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
        
        q_crecimiento = db.query(
            func.strftime("%Y-%m-%d", Estudio.fecha_estudio).label("fecha"),
            func.count(Estudio.id).label("cantidad")
        )

        # 🟢 NUEVO: Consulta experta agrupada por modalidades (Pacientes distintos, Estudios e Imágenes)
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
        
        crecimiento_query = q_crecimiento.group_by("fecha").order_by("fecha").all()
        
        # Ejecutar agrupación por modalidad
        modalidades_query = q_modalidades.group_by(Estudio.tipo_estudio).all()
        
        # 4. Inyección de métricas de almacenamiento físico real
        metricas_disco = get_pacs_disk_metrics()

        # 5. Cálculo dinámico de GB consumidos
        if inicio and fin:
            gb_consumidos = f"{(i_count * 0.03):.2f}" if i_count > 0 else f"{(e_count * 0.45):.2f}"
        else:
            gb_consumidos = f"{metricas_disco['carpeta_dicom_gb']:.2f}"

        # 🟢 NUEVO: Empaquetar las modalidades con sus 3 valores para el Frontend
        modalidades_formateadas = []
        for m in modalidades_query:
            if m.tipo_estudio:
                modalidades_formateadas.append({
                    "name": str(m.tipo_estudio).upper(),
                    "pacientes": m.pacientes or 0,
                    "value": m.estudios or 0,  # 'value' se usa para la dona de Recharts
                    "imagenes": m.imagenes or 0
                })

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
            
            "crecimiento": [{"fecha": c.fecha, "cantidad": c.cantidad} for c in crecimiento_query],
            "modalidades": modalidades_formateadas, # 🚀 Lista enriquecida con desglose total
            "success": True
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# --- 🚀 ENDPOINT DE PRODUCTIVIDAD (ULTRA-RESILIENTE) ---

@router.get("/productividad-real")
def get_productividad_real(
    db: Session = Depends(get_db),
    fecha_desde: str = Query(None),
    fecha_hasta: str = Query(None),
    rol: str = Query("TODOS")
):
    try:
        # Detectamos dinámicamente la columna de relación para no romper el sistema
        columna_usuario = None
        for nombre in ['usuario_id', 'medico_id', 'tecnico_id', 'creado_por_id']:
            if hasattr(Estudio, nombre):
                columna_usuario = getattr(Estudio, nombre)
                break

        # Consulta base
        query = db.query(Estudio, Paciente).join(Paciente, Estudio.paciente_id == Paciente.id)

        # Join con Usuario solo si existe la columna
        if columna_usuario is not None:
            query = query.add_entity(Usuario).join(Usuario, columna_usuario == Usuario.id)

        if fecha_desde:
            query = query.filter(Estudio.fecha_estudio >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Estudio.fecha_estudio <= fecha_hasta)
        
        if rol != "TODOS" and columna_usuario is not None:
            query = query.filter(Usuario.rol == rol.lower())

        result = query.order_by(Estudio.fecha_estudio.desc()).all()

        output = []
        for row in result:
            est = row[0]
            pac = row[1]
            usu = row[2] if len(row) > 2 else None
            
            # Nombre Paciente (Detección dinámica)
            n_p = getattr(pac, 'nombre', getattr(pac, 'nombres', ''))
            a_p = getattr(pac, 'apellido', getattr(pac, 'apellidos', ''))
            nombre_paciente = f"{n_p} {a_p}".strip() or "Paciente S/N"

            # Datos Profesional
            if usu:
                profesional = getattr(usu, 'username', getattr(usu, 'nombre', 'Usuario'))
                rol_prof = getattr(usu, 'rol', 'N/A').upper()
            else:
                profesional = "Sin Asignar"
                rol_prof = "N/A"

            output.append({
                "id": est.id,
                "paciente": nombre_paciente,
                "profesional": profesional,
                "rol": rol_prof,
                "modalidad": getattr(est, 'tipo_estudio', 'N/A'),
                "estado": "Terminado" if str(est.estado).lower() == "terminado" else "Pendiente",
                "fecha": est.fecha_estudio
            })
            
        return output

    except Exception as e:
        print(f"❌ Error detallado en Productividad: {e}")
        traceback.print_exc()
        return []