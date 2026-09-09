import time
import os
import urllib.parse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

print("\n" + "="*55)
print("🟢 [MI_PACS] MÓDULO DE WHATSAPP (SELENIUM) CARGADO 🟢")
print("🤖 Servicio en espera. Se activará bajo demanda...")
print("="*55 + "\n")

def enviar_mensaje_whatsapp(numero: str, mensaje: str) -> bool:
    numero_limpio = str(numero).replace(" ", "").replace("-", "").replace("+", "").strip()
    print(f"\n🚀 [BOT WHATSAPP] Iniciando navegador para enviar a: {numero_limpio}...")
    
    user_data_dir = os.path.abspath("./whatsapp_session")
    os.makedirs(user_data_dir, exist_ok=True)
    
    options = Options()
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    if os.path.exists("/usr/bin/chromium"):
        options.binary_location = "/usr/bin/chromium"
        service = Service("/usr/bin/chromedriver")
    else:
        from webdriver_manager.chrome import ChromeDriverManager
        service = Service(ChromeDriverManager().install())

    driver = None
    try:
        driver = webdriver.Chrome(service=service, options=options)
        
        # 🔥 FASE 1: IR A LA PÁGINA PRINCIPAL PARA FORZAR EL QR
        print("⏳ [BOT WHATSAPP] Verificando estado de la sesión...")
        driver.get("https://web.whatsapp.com/")
        
        try:
            # Esperamos hasta 15 segundos a que aparezca el lienzo (canvas) del QR
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, 'canvas'))
            )
            print("📷 [BOT WHATSAPP] Se requiere vincular el dispositivo. Tomando foto del QR...")
            time.sleep(3) # Darle tiempo a que los cuadritos del QR se dibujen
            
            ruta_foto = os.path.abspath("whatsapp_qr.png")
            driver.save_screenshot(ruta_foto)
            print("📸 [ATENCIÓN] Abre 'whatsapp_qr.png' en la carpeta backend y ESCANEA EL QR.")
            print("⏱️ Tienes 60 segundos para escanear con tu celular...")
            
            # El script se pausa aquí. Espera hasta 60 segundos a que el QR desaparezca tras escanear.
            WebDriverWait(driver, 60).until_not(
                EC.presence_of_element_located((By.TAG_NAME, 'canvas'))
            )
            print("✅ [BOT WHATSAPP] Dispositivo vinculado con éxito. Guardando sesión...")
            time.sleep(5) # Esperar a que la interfaz principal cargue
        except Exception:
            # Si a los 15 segundos no hay QR, asumimos que la sesión ya estaba activa
            print("✅ [BOT WHATSAPP] Sesión activa detectada. Procediendo...")

        # 🔥 FASE 2: IR AL CHAT Y ENVIAR EL MENSAJE
        mensaje_codificado = urllib.parse.quote(mensaje)
        url = f"https://web.whatsapp.com/send?phone={numero_limpio}&text={mensaje_codificado}"
        driver.get(url)
        print("⏳ [BOT WHATSAPP] Cargando el chat del paciente...")

        wait = WebDriverWait(driver, 25)
        chat_box = wait.until(
            EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
        )
        
        time.sleep(2)
        chat_box.send_keys(Keys.ENTER)
        
        time.sleep(2)
        try:
            send_button = driver.find_element(By.XPATH, '//button[@aria-label="Send"] | //button[@aria-label="Enviar"] | //span[@data-icon="send"]')
            send_button.click()
        except Exception:
            pass

        time.sleep(4)
        print("✅ [BOT WHATSAPP] Mensaje enviado automáticamente. Apagando navegador.\n")
        return True

    except Exception as e:
        print(f"❌ [BOT WHATSAPP] Error en el proceso: {e}\n")
        # Capturamos la pantalla del error exacto para saber por qué falló
        if driver:
            driver.save_screenshot(os.path.abspath("whatsapp_error.png"))
            print("📸 Se ha guardado 'whatsapp_error.png' en backend para diagnosticar el problema.")
        return False
    finally:
        if driver:
            driver.quit()