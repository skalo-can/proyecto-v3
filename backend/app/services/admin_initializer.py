from sqlalchemy.orm import Session
from app.models.usuario import Usuario
from app.security.hashing import Hasher

def crear_admin_por_defecto(db: Session):
    admin_email = "admin@mipacs.com"

    admin = db.query(Usuario).filter(Usuario.email == admin_email).first()
    if admin:
        return

    nuevo_admin = Usuario(
        nombre="sadat karim luna osorio",
        email=admin_email,
        password_hash=Hasher.get_password_hash("Soportehc#3104"),
        rol="admin",
        activo=True,
    )

    db.add(nuevo_admin)
    db.commit()