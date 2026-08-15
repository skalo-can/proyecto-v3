import sqlite3
import os

# Ruta exacta a tu base de datos
db_path = os.path.join("backend", "app", "database.db")

print(f"🔌 Conectando a la base de datos en: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # ==========================================
    # 1. COLUMNAS DE URGENCIAS Y FLUJO CLÍNICO
    # ==========================================
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN es_urgenciologo BOOLEAN DEFAULT 0")
        print("✅ Columna 'es_urgenciologo' agregada en usuarios.")
    except Exception as e:
        print(f"⚠️ usuarios.es_urgenciologo (Puede que ya exista): {e}")

    try:
        cursor.execute("ALTER TABLE estudios ADD COLUMN nota_urgencia TEXT")
        print("✅ Columna 'nota_urgencia' agregada en estudios.")
    except Exception as e:
        print(f"⚠️ estudios.nota_urgencia (Puede que ya exista): {e}")

    try:
        cursor.execute("ALTER TABLE estudios ADD COLUMN requiere_lectura_radiologo BOOLEAN DEFAULT 0")
        print("✅ Columna 'requiere_lectura_radiologo' agregada en estudios.")
    except Exception as e:
        print(f"⚠️ estudios.requiere_lectura_radiologo (Puede que ya exista): {e}")

    # ==========================================
    # 2. 🔥 COLUMNAS DE SEGURIDAD (ZERO TRUST)
    # ==========================================
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0 NOT NULL")
        print("🛡️ Columna 'intentos_fallidos' agregada en usuarios.")
    except Exception as e:
        print(f"⚠️ usuarios.intentos_fallidos (Puede que ya exista): {e}")

    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN bloqueado BOOLEAN DEFAULT 0 NOT NULL")
        print("🛡️ Columna 'bloqueado' agregada en usuarios.")
    except Exception as e:
        print(f"⚠️ usuarios.bloqueado (Puede que ya exista): {e}")

    # ==========================================
    # 3. 🧬 COLUMNAS DICOM / RIS (MWL AGFA)
    # ==========================================
    try:
        # Añadimos el ADN único del estudio para que el PACS y AGFA se entiendan
        cursor.execute("ALTER TABLE worklist_orders ADD COLUMN study_instance_uid TEXT")
        print("🧬 Columna 'study_instance_uid' agregada en worklist_orders (RIS).")
    except Exception as e:
        print(f"⚠️ worklist_orders.study_instance_uid (Puede que ya exista): {e}")

    # Guardamos los cambios
    conn.commit()
    conn.close()
    
    print("\n🚀 PARCHEO FINALIZADO. La base de datos está blindada y lista para la conexión DICOM.")

except Exception as main_e:
    print(f"❌ Error crítico al abrir la base de datos: {main_e}")