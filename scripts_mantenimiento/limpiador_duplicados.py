import sys
import os

# Asegurar que encuentre la ruta del backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.database import SessionLocal
from sqlalchemy import text

def limpiar_estudios_duplicados():
    db = SessionLocal()
    try:
        print("🔍 Buscando estudios duplicados de forma directa (SQL Puro)...")
        
        # 1. Leer directamente de la base de datos sin despertar al ORM
        # Asumiendo que el nombre de tu tabla en la base de datos es 'estudios'
        resultado = db.execute(text("SELECT id, uid FROM estudios ORDER BY id ASC")).fetchall()
        
        vistos = set()
        duplicados_ids = []

        for fila in resultado:
            # Dependiendo de la versión de SQLAlchemy, se accede por atributo o por índice
            est_id = fila.id if hasattr(fila, 'id') else fila[0]
            est_uid = fila.uid if hasattr(fila, 'uid') else fila[1]

            if est_uid in vistos:
                duplicados_ids.append(est_id)
            else:
                vistos.add(est_uid)

        if duplicados_ids:
            print(f"🗑️ Se encontraron {len(duplicados_ids)} estudios duplicados. Eliminando...")
            
            # 2. Borrar directamente pasando los IDs
            # Convertimos la lista de IDs a un formato seguro para SQL
            lista_ids = ", ".join(map(str, duplicados_ids))
            
            db.execute(text(f"DELETE FROM estudios WHERE id IN ({lista_ids})"))
            db.commit()
            print("✅ ¡Duplicados eliminados exitosamente!")
        else:
            print("✨ No se encontraron estudios duplicados.")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error durante la limpieza: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    limpiar_estudios_duplicados()