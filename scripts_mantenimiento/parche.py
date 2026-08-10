import sqlite3
import os

# Ruta exacta a tu base de datos basándome en tus logs
db_path = os.path.join("backend", "app", "database.db")

print(f"🔌 Conectando a la base de datos en: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # ==========================================
    # COLUMNAS EXISTENTES
    # ==========================================
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN es_urgenciologo BOOLEAN DEFAULT 0")
        print("✅ Columna 'es_urgenciologo' forzada en usuarios.")
    except Exception as e:
        print(f"⚠️ usuarios.es_urgenciologo: {e}")

    try:
        cursor.execute("ALTER TABLE estudios ADD COLUMN nota_urgencia TEXT")
        print("✅ Columna 'nota_urgencia' forzada en estudios.")
    except Exception as e:
        print(f"⚠️ estudios.nota_urgencia: {e}")

    try:
        cursor.execute("ALTER TABLE estudios ADD COLUMN requiere_lectura_radiologo BOOLEAN DEFAULT 0")
        print("✅ Columna 'requiere_lectura_radiologo' forzada en estudios.")
    except Exception as e:
        print(f"⚠️ estudios.requiere_lectura_radiologo: {e}")

    # ==========================================
    # 🔥 NUEVAS COLUMNAS DE SEGURIDAD (ZERO TRUST)
    # ==========================================
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0 NOT NULL")
        print("🛡️ Columna 'intentos_fallidos' forzada en usuarios.")
    except Exception as e:
        print(f"⚠️ usuarios.intentos_fallidos: {e}")

    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN bloqueado BOOLEAN DEFAULT 0 NOT NULL")
        print("🛡️ Columna 'bloqueado' forzada en usuarios.")
    except Exception as e:
        print(f"⚠️ usuarios.bloqueado: {e}")

    conn.commit()
    conn.close()
    print("🚀 PARCHEO FINALIZADO. El sistema está blindado y listo para arrancar.")

except Exception as main_e:
    print(f"❌ Error crítico al abrir la base de datos: {main_e}")