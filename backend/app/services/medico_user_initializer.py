from sqlalchemy.orm import Session
from app.models.usuario import Usuario
from app.security.hashing import Hasher

def crear_usuario_para_medico(db: Session, medico):
    email_usuario = "medico@mipacs.com"

    usuario = db.query(Usuario).filter(Usuario.email == email_usuario).first()
    if usuario:
        return usuario

    nuevo_usuario = Usuario(
        nombre=medico.nombre,
        email=email_usuario,
        password_hash=Hasher.get_password_hash("Soportehc#3104"),
        rol="medico",
        activo=True,
        medico_id=medico.id,
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    return nuevo_usuario