from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import traceback

from app.core.database import SessionLocal
from app.crud import auditoria_descarga_crud
from app.models.auditoria_descarga import AuditoriaDescarga
from app.models.estudio import Estudio
from app.models.paciente import Paciente

router = APIRouter(tags=["Auditoría descargas"], prefix="/auditoria")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 🚀 RUTA EXCLUSIVA PARA EL FRONTEND (Blindada contra errores de datos)
@router.get("/dashboard")
def listar_auditoria_dashboard(limit: int = 100, db: Session = Depends(get_db)):
    try:
        registros = db.query(AuditoriaDescarga).order_by(AuditoriaDescarga.creado_en.desc()).limit(limit).all()
        
        resultado_api = []
        for r in registros:
            nombre_paciente = "Paciente Desconocido"
            nombre_estudio = "Estudio sin descripción"
            
            # Cruce de datos relacionales super seguro
            if r.estudio_id:
                estudio_real = db.query(Estudio).filter(Estudio.id == r.estudio_id).first()
                if estudio_real:
                    tipo = getattr(estudio_real, 'tipo_estudio', 'DICOM') or 'DICOM'
                    desc = getattr(estudio_real, 'descripcion', 'Sin descripción') or 'Sin descripción'
                    nombre_estudio = f"{tipo} - {desc}".strip()
                    
                    paciente_real = db.query(Paciente).filter(Paciente.id == estudio_real.paciente_id).first()
                    if paciente_real:
                        n1 = getattr(paciente_real, 'primer_nombre', '') or ''
                        a1 = getattr(paciente_real, 'primer_apellido', '') or ''
                        nombre_paciente = f"{n1} {a1}".strip()
                        if not nombre_paciente:
                            nombre_paciente = getattr(paciente_real, 'identificacion', 'Sin Nombre')
            
            # Formateo de fecha: Convertir de UTC a Hora Local de Windows
            fecha_str = "Sin fecha"
            if r.creado_en:
                if isinstance(r.creado_en, str):
                    fecha_str = r.creado_en  # Si SQLite lo devolvió como texto puro
                else:
                    try:
                        from datetime import timezone
                        # Le decimos a Python que esa fecha está en UTC, y la pasamos a la zona del sistema
                        fecha_utc = r.creado_en.replace(tzinfo=timezone.utc)
                        fecha_local = fecha_utc.astimezone()
                        fecha_str = fecha_local.strftime("%d/%m/%Y %I:%M %p")
                    except Exception:
                        fecha_str = str(r.creado_en)
                
            estado_resultado = str(r.resultado or "ok").strip().lower()
            
            resultado_api.append({
                "id": r.id,
                "paciente": nombre_paciente,
                "estudio": f"[{str(r.tipo).upper() if r.tipo else 'SISTEMA'}] {nombre_estudio}",
                "ip": r.ip or "Local",
                "resultado": estado_resultado,
                "fecha": fecha_str
            })
            
        return resultado_api
    
    except Exception as e:
        # Si algo falla, atrapamos el error y lo imprimimos en consola sin tumbar el servidor
        print(f"🔥 ERROR FATAL EN DASHBOARD: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------
# RUTAS ORIGINALES MANTENIDAS INTACTAS
# ---------------------------------------------------------
@router.post("/registrar-descarga")
def registrar_descarga(
    estudio_id: int,
    tipo: str,
    resultado: str = "ok",
    usuario_id: Optional[int] = None,
    email: Optional[str] = None,
    ip: Optional[str] = None,
    db: Session = Depends(get_db),
):
    registro = auditoria_descarga_crud.crear_registro(
        db=db,
        estudio_id=estudio_id,
        tipo=tipo,
        resultado=resultado,
        usuario_id=usuario_id,
        email=email,
        ip=ip,
    )
    return {"status": "ok", "id": registro.id}

@router.get("/listar", response_model=list[dict])
def listar(limit: int = 100, db: Session = Depends(get_db)):
    registros = auditoria_descarga_crud.listar(db, limit=limit)
    return [
        {
            "id": r.id,
            "estudio_id": r.estudio_id,
            "usuario_id": r.usuario_id,
            "email": r.email,
            "ip": r.ip,
            "tipo": r.tipo,
            "resultado": r.resultado,
            "creado_en": r.creado_en,
        }
        for r in registros
    ]

@router.get("/estudio/{estudio_id}", response_model=list[dict])
def listar_por_estudio(estudio_id: int, db: Session = Depends(get_db)):
    registros = auditoria_descarga_crud.listar_por_estudio(db, estudio_id)
    return [
        {
            "id": r.id,
            "estudio_id": r.estudio_id,
            "usuario_id": r.usuario_id,
            "email": r.email,
            "ip": r.ip,
            "tipo": r.tipo,
            "resultado": r.resultado,
            "creado_en": r.creado_en,
        }
        for r in registros
    ]

@router.get("/usuario/{usuario_id}", response_model=list[dict])
def listar_por_usuario(usuario_id: int, db: Session = Depends(get_db)):
    registros = auditoria_descarga_crud.listar_por_usuario(db, usuario_id)
    return [
        {
            "id": r.id,
            "estudio_id": r.estudio_id,
            "usuario_id": r.usuario_id,
            "email": r.email,
            "ip": r.ip,
            "tipo": r.tipo,
            "resultado": r.resultado,
            "creado_en": r.creado_en,
        }
        for r in registros
    ]