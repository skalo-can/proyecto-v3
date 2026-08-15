"""
auth_api.py — MI_PACS (BLINDADO - ZERO TRUST)
---------------------------------------------------------
Autenticación robusta con control de red, mitigación de ataques 
y protección especial de inmunidad para cuentas maestras.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
import ipaddress
import requests
from datetime import datetime

from app.core.database import get_db
from app.core.auth import crear_token
from app.core.security import verify_password
from app.models.usuario import Usuario

from app.crud import auditoria_descarga_crud

from app.services.whatsapp_service import enviar_mensaje_whatsapp

from fastapi.responses import JSONResponse

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# =========================================================
# 🛠️ FUNCIONES DE SEGURIDAD Y ALERTAS
# =========================================================
def is_local_network(ip_str: str) -> bool:
    """Evalúa si una IP pertenece a la red de área local (LAN) de la clínica."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False

def enviar_alerta_seguridad(ip_atacante: str, identificador: str, motivo: str):
    """
    Función en segundo plano que conecta las alertas de seguridad 
    NATIVAMENTE con el servicio de WhatsApp (Selenium) y guarda 
    el registro en la Auditoría General.
    """
    hora_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 1. Formateamos el mensaje con estilo para WhatsApp
    mensaje_whatsapp = (
        f"🚨 *ALERTA DE SEGURIDAD MI_PACS* 🚨\n\n"
        f"⚠️ *Motivo:* {motivo}\n"
        f"👤 *Usuario Objetivo:* {identificador}\n"
        f"🌐 *IP Origen:* {ip_atacante}\n"
        f"🕒 *Hora:* {hora_actual}\n\n"
        f"🛡️ _Sistema Zero Trust Activado_"
    )
    
    print(mensaje_whatsapp) # Log en consola

    # 2. Tu número de teléfono canadiense
    numero_skalo = "+16478652950" 

    # 3. Disparamos la alerta saltando el protocolo HTTP (Llamada directa al servicio)
    try:
        enviar_mensaje_whatsapp(numero_skalo, mensaje_whatsapp)
    except Exception as e:
        print(f"❌ Falló la conexión interna con el bot de WhatsApp: {e}")

    # 4. 🔥 NUEVO: Registro silencioso en la base de datos (Auditoría General)
    db = SessionLocal()
    try:
        auditoria_descarga_crud.crear_registro(
            db=db,
            estudio_id=None,
            tipo="SEGURIDAD",
            resultado="bloqueado",
            usuario_id=None,
            email=identificador, 
            ip=ip_atacante
        )
    except Exception as e:
        print(f"❌ Error al registrar en la tabla de auditoría: {e}")
    finally:
        db.close()

# =========================================================
# 🔒 ENDPOINT DE LOGIN BLINDADO
# =========================================================
@router.post("/login")
def login_endpoint(
    request: Request, 
    credenciales: dict, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # Obtener IP real del cliente (Incluso detrás de Nginx/Apache)
    ip_real = request.headers.get("X-Forwarded-For") or request.client.host
    ip_cliente = ip_real.split(",")[0].strip() if ip_real else "0.0.0.0"
    
    es_red_local = is_local_network(ip_cliente)

    # 🛡️ NORMALIZACIÓN
    identifier = credenciales.get("email") or credenciales.get("username")
    password = credenciales.get("password")

    if not identifier or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credenciales incompletas.")

    # 1. Búsqueda segura
    usuario = db.query(Usuario).filter(
        or_(Usuario.email == identifier, Usuario.username == identifier)
    ).first()

    es_skalo = usuario and "SKALO" in usuario.username.upper()

    # 2. Control de cuenta bloqueada (Omitido para SKALO)
    if usuario and getattr(usuario, "bloqueado", False) and not es_skalo:
        raise HTTPException(status_code=403, detail="Cuenta bloqueada por seguridad. Contacte al administrador.")

    # 3. Verificación de contraseña + Estado
    if not usuario or not verify_password(password, usuario.password) or not usuario.is_active:
        if usuario:
            # Sistema Anti-Fuerza Bruta
            intentos_actuales = getattr(usuario, "intentos_fallidos", 0) + 1
            
            if not es_skalo:
                usuario.intentos_fallidos = intentos_actuales
                if intentos_actuales >= 5:
                    usuario.bloqueado = True
                    background_tasks.add_task(enviar_alerta_seguridad, ip_cliente, identifier, "Cuenta bloqueada por múltiples intentos fallidos")
                db.commit()
            else:
                # INMUNIDAD SKALO: Nunca se bloquea, pero se notifica el ataque
                if intentos_actuales % 5 == 0: 
                    background_tasks.add_task(enviar_alerta_seguridad, ip_cliente, identifier, "Ataque de fuerza bruta detectado contra la cuenta MAESTRA")

        # 🔥 SOLUCIÓN: Usamos JSONResponse para que la tarea en segundo plano NO se destruya
        return JSONResponse(
            status_code=401,
            content={"detail": "Credenciales inválidas o cuenta inactiva."},
            background=background_tasks
        )

    # 4. Reseteo de intentos fallidos al ingresar correctamente
    if getattr(usuario, "intentos_fallidos", 0) > 0:
        usuario.intentos_fallidos = 0
        usuario.bloqueado = False
        db.commit()

    # 5. CONTROL DE ACCESO GEOGRÁFICO Y POR ROLES (INTERNET VS LAN)
    if not es_red_local:
        rol_valido = usuario.rol.lower() in ["radiologo", "admin", "superadmin"]
        
        if not (rol_valido or es_skalo):
            background_tasks.add_task(enviar_alerta_seguridad, ip_cliente, identifier, f"Intento de acceso remoto bloqueado para el rol: {usuario.rol}")
            
            # 🔥 SOLUCIÓN: Usamos JSONResponse para que la tarea en segundo plano NO se destruya
            return JSONResponse(
                status_code=403,
                content={"detail": "Su perfil está restringido exclusivamente a la red de la clínica."},
                background=background_tasks
            )

    # 6. Generación de token
    token_str = crear_token(usuario)

    # 7. RESPUESTA BLINDADA
    return {
        "access_token": token_str,
        "token_type": "bearer",
        "user": {
            "id": usuario.id,
            "username": usuario.username,
            "rol": usuario.rol,
            "es_urgenciologo": getattr(usuario, "es_urgenciologo", False),
        }
    }