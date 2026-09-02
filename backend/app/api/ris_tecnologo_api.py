from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, SessionLocal
from app.models.estudio import Estudio
from pydantic import BaseModel

router = APIRouter()

class AtencionSchema(BaseModel):
    usuario_id: int

# =========================================================
# 🧠 FASE 2: MOTOR DE INTELIGENCIA LOCAL (TRIAGE AUTOMÁTICO)
# =========================================================
def motor_analisis_local_background(estudio_id: int, lang: str = "es"):
    """
    Analiza el estudio en segundo plano buscando palabras clave clínicas críticas.
    Se adapta al idioma para leer metadatos y escribir el triage correctamente.
    """
    db_ia = SessionLocal()
    try:
        print(f"🤖 [IA LOCAL] Iniciando análisis de triage para estudio {estudio_id} (Idioma: {lang})...")
        
        estudio = db_ia.query(Estudio).filter(Estudio.id == estudio_id).first()
        if not estudio:
            return

        # 1. Extraemos toda la información clínica disponible del estudio
        modalidad = getattr(estudio, 'modalidad', '') or ''
        motivo = getattr(estudio, 'motivo_estudio', '') or ''
        nota = getattr(estudio, 'nota_urgencia', '') or ''
        
        # Unimos todo y lo pasamos a mayúsculas para la búsqueda
        descripcion_clinica = f"{modalidad} {motivo} {nota}".upper()

        # 2. Diccionarios Multilingües (Soporta metadatos de LATAM y Norteamérica)
        palabras_criticas = [
            # Español
            "POLITRAUMATISMO", "ACV", "INFARTO", "HEMORRAGIA", "URGENCIA VITAL", "UCI", "BALA", "HERIDA", "TEP", "ICTUS", "DERRAME",
            # Inglés
            "TRAUMA", "STROKE", "INFARCT", "HEMORRHAGE", "BLEEDING", "ICU", "GUNSHOT", "WOUND", "PULMONARY EMBOLISM"
        ]
        
        palabras_urgentes = [
            # Español
            "FRACTURA", "DOLOR INTENSO", "DISNEA", "URGENCIAS", "APENDICITIS", "COLICO", "CÓLICO",
            # Inglés
            "FRACTURE", "SEVERE PAIN", "DYSPNEA", "EMERGENCY", "ER", "APPENDICITIS", "COLIC"
        ]

        # 3. Diccionario de salidas según el idioma seleccionado
        salidas_triage = {
            "es": {"critico": "CRÍTICO", "urgente": "URGENTE", "normal": "NORMAL"},
            "en": {"critico": "CRITICAL", "urgente": "URGENT", "normal": "NORMAL"}
        }
        
        # Fallback a español si el idioma no está configurado
        salida_actual = salidas_triage.get(lang, salidas_triage["es"])
        prioridad_asignada = salida_actual["normal"]

        # 4. Inferencia Básica (Reglas de Decisión)
        if any(palabra in descripcion_clinica for palabra in palabras_criticas):
            prioridad_asignada = salida_actual["critico"]
        elif any(palabra in descripcion_clinica for palabra in palabras_urgentes):
            prioridad_asignada = salida_actual["urgente"]

        # 5. Guardado seguro ignorando errores si la columna aún no está creada
        if hasattr(estudio, 'prioridad_ia'):
            estudio.prioridad_ia = prioridad_asignada
        else:
            setattr(estudio, 'prioridad_ia', prioridad_asignada)
            
        db_ia.commit()
        print(f"✅ [IA LOCAL] Estudio {estudio_id} clasificado exitosamente como: {prioridad_asignada}")

    except Exception as e:
        print(f"❌ [IA LOCAL] Fallo en el análisis: {e}")
    finally:
        db_ia.close()

# =========================================================
# RUTAS DE TECNÓLOGO
# =========================================================

@router.patch("/atender/{estudio_id}")
async def atender_paciente(
    estudio_id: int, 
    data: AtencionSchema, 
    background_tasks: BackgroundTasks,
    lang: str = "es", # 🔥 Inyectamos el idioma desde el frontend
    db: Session = Depends(get_db)
):
    # 1. Buscamos el estudio en la tabla de resultados (PACS)
    estudio = db.query(Estudio).filter(Estudio.id == estudio_id).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    try:
        # 2. Marcamos como terminado en la tabla Estudio
        estudio.estado = "terminado"
        estudio.usuario_id = data.usuario_id 
        
        # 3. 🔥 EL CLAVO FINAL: Borramos o actualizamos en la tabla de la lista (Worklist)
        if hasattr(estudio, 'accession_number') or hasattr(estudio, 'acc_number'):
            acc = getattr(estudio, 'accession_number', None) or getattr(estudio, 'acc_number', None)
            if acc:
                db.execute(
                    text("UPDATE worklist_orders SET estado_ris = 'Atendido' WHERE accession_number = :acc"),
                    {"acc": acc}
                )

        db.commit()
        print(f"✅ Paciente {estudio_id} finalizado y eliminado de la lista técnica.")

        # 🧠 DISPARADOR DE IA: Enviamos el estudio a triage de forma invisible pasando el idioma
        background_tasks.add_task(motor_analisis_local_background, estudio_id, lang)

        return {"status": "success"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al atender: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usuarios/tecnologos")
async def obtener_tecnologos(db: Session = Depends(get_db)):
    from app.models.usuario import Usuario
    return db.query(Usuario).filter(Usuario.rol == "tecnologo").all()