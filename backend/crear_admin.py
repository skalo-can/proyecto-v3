from app.core.database import SessionLocal

# IMPORTAR TODOS LOS MODELOS QUE USUARIO NECESITA
from app.models.usuario import Usuario
from app.models.medico import Medico
from app.models.paciente import Paciente
from app.models.estudio import Estudio
from app.models.estudio_imagen import EstudioImagen
from app.models.estudio_ia_log import EstudioIALog

from app.core.security import hash_password

db = SessionLocal()

email_admin = "admin@mipacs.com"
password_admin = "admin123"
nombre_admin = "Administrador del Sistema"

existe = db.query(Usuario).filter(Usuario.email == email_admin).first()

if existe:
    print("✔ El usuario admin ya existe:", email_admin)
else:
    nuevo = Usuario(
        nombre=nombre_admin,
        email=email_admin,
        rol="admin",
        password_hash=hash_password(password_admin),
        activo=True
    )
    db.add(nuevo)
    db.commit()
    print("✨ Usuario admin creado correctamente:")
    print("   Email:", email_admin)
    print("   Password:", password_admin)

db.close()