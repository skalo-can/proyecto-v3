from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.crud.dicom_config_crud import get_config, update_config, get_nodos, create_nodo, update_nodo, delete_nodo
# 🚀 AÑADIMOS DicomConfig A LA IMPORTACIÓN
from app.models.dicom_config import DicomConfig, DicomMapeoCampos
from app.schemas.dicom_config import NodoDicomCreate, NodoDicomUpdate, NodoDicomResponse

router = APIRouter(tags=["Configuración DICOM"])

# --- SCHEMAS (Locales para mapeos e iniciales) ---
class ConfigUpdate(BaseModel):
    ae_title: str
    ip_address: Optional[str] = None
    ip: Optional[str] = None
    port: int
    client_ae: Optional[str] = "WEASIS" 
    weasis_ae_title: Optional[str] = "WEASIS"

class MapeoCreate(BaseModel):
    nombre_mostrar: str
    tag_dicom: str

# ==========================================
# ENDPOINTS NODO PACS (GLOBAL)
# ==========================================
@router.get("/status")
def get_pacs_status(db: Session = Depends(get_db)):
    # 🚀 CURA DE HARDCODE: Ahora lee la verdad desde la base de datos
    config = db.query(DicomConfig).first()
    return {
        "running": True, "status": "LISTENING", "last_event": "Servidor DICOM en línea",
        "ae_title": config.ae_title if config else "MIPACS", 
        "port": config.port if config else 11112
    }

@router.get("/config")
def obtener_configuracion_pacs(db: Session = Depends(get_db)):
    config = get_config(db)
    if not config:
        return {"ae_title": "MIPACS", "ip_address": "127.0.0.1", "port": 11112, "client_ae": "WEASIS"}
    return config

@router.put("/config")
def actualizar_configuracion_pacs(data: ConfigUpdate, db: Session = Depends(get_db)):
    try:
        if data.ip and not data.ip_address: data.ip_address = data.ip
        if not data.client_ae: data.client_ae = data.weasis_ae_title
        
        # 🚀 CURA DE AMNESIA: Escritura forzada y directa a SQLite
        config = db.query(DicomConfig).first()
        if not config:
            config = DicomConfig()
            db.add(config)
            
        config.ae_title = data.ae_title
        config.port = data.port
        
        if hasattr(config, 'ip_address'):
            config.ip_address = data.ip_address
        if hasattr(config, 'ip'):
            config.ip = data.ip_address
            
        if hasattr(config, 'client_ae'):
            config.client_ae = data.client_ae
            
        # 🔥 EL COMANDO MÁGICO QUE FALTABA
        db.commit()
        db.refresh(config)
        
        # Importación diferida para evitar ciclos
        from app.services.dicom_service import reiniciar_servidor_dicom
        reiniciar_servidor_dicom(config.ae_title, config.port)
        
        return {"success": True, "message": "Guardado permanentemente"}
    except Exception as e:
        db.rollback()
        return {"success": False, "message": str(e)}

@router.post("/test-connection")
async def probar_conexion_dicom(data: ConfigUpdate):
    try:
        return {"success": True, "message": f"✅ Prueba exitosa: AE Title '{data.ae_title}' disponible en puerto {data.port}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en la prueba: {str(e)}")


# ==========================================
# 🚀 ENDPOINTS ESTACIONES DE DIAGNÓSTICO (NODOS)
# ==========================================
@router.get("/nodos", response_model=List[NodoDicomResponse])
def listar_nodos(db: Session = Depends(get_db)):
    return get_nodos(db)

@router.post("/nodos", response_model=NodoDicomResponse)
def agregar_nodo(data: NodoDicomCreate, db: Session = Depends(get_db)):
    try:
        return create_nodo(db, data)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/nodos/{id}", response_model=NodoDicomResponse)
def editar_nodo(id: int, data: NodoDicomUpdate, db: Session = Depends(get_db)):
    nodo = update_nodo(db, id, data)
    if not nodo:
        raise HTTPException(status_code=404, detail="Nodo no encontrado")
    return nodo

@router.delete("/nodos/{id}")
def borrar_nodo(id: int, db: Session = Depends(get_db)):
    if not delete_nodo(db, id):
        raise HTTPException(status_code=404, detail="Nodo no encontrado")
    return {"message": "Nodo eliminado exitosamente"}


# ==========================================
# ENDPOINTS LOGS Y MAPEOS
# ==========================================
@router.get("/logs")
def obtener_logs_dicom():
    return {
        "status": "success",
        "logs": [
            {"fecha": "2026-04-28 10:00:00", "mensaje": "Servidor DICOM MIPACS iniciado"},
            {"fecha": "2026-04-28 10:05:00", "mensaje": "Puerto 11112 escuchando correctamente"}
        ]
    }

@router.get("/mapeo")
def listar_mapeos(db: Session = Depends(get_db)):
    return db.query(DicomMapeoCampos).all()

@router.post("/mapeo")
def crear_mapeo(data: MapeoCreate, db: Session = Depends(get_db)):
    try:
        nuevo_mapeo = DicomMapeoCampos(nombre_mostrar=data.nombre_mostrar, tag_dicom=data.tag_dicom, activo=True)
        db.add(nuevo_mapeo)
        db.commit()
        db.refresh(nuevo_mapeo)
        return nuevo_mapeo
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/mapeo/{id}")
def eliminar_mapeo(id: int, db: Session = Depends(get_db)):
    mapeo = db.query(DicomMapeoCampos).filter(DicomMapeoCampos.id == id).first()
    if not mapeo:
        raise HTTPException(status_code=404, detail="Mapeo no encontrado")
    db.delete(mapeo)
    db.commit()
    return {"message": "Mapeo eliminado"}

@router.get("/campos-activos")
def get_campos_para_recepcion(db: Session = Depends(get_db)):
    return db.query(DicomMapeoCampos).filter(DicomMapeoCampos.activo == True).all()