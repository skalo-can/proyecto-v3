import time
import os
import urllib.parse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

print("\n" + "="*55)
print("🟢 [MI_PACS] MÓDULO DE WHATSAPP (SELENIUM) CARGADO 🟢")
print("🤖 Servicio en espera. Se activará bajo demanda...")
print("="*55 + "\n")

def enviar_mensaje_whatsapp(numero: str, mensaje: str) -> bool:
    # WhatsApp Web requiere el número sin el signo +
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
        
        # 🔥 FASE 1: VERIFICAR SESIÓN
        print("⏳ [BOT WHATSAPP] Verificando estado de la sesión...")
        driver.get("https://web.whatsapp.com/")
        
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, 'canvas'))
            )
            print("📷 [BOT WHATSAPP] Se requiere vincular el dispositivo. Tomando foto del QR...")
            time.sleep(3)
            driver.save_screenshot(os.path.abspath("whatsapp_qr.png"))
            print("📸 [ATENCIÓN] Abre 'whatsapp_qr.png' en la carpeta backend y ESCANEA EL QR.")
            
            WebDriverWait(driver, 60).until_not(
                EC.presence_of_element_located((By.TAG_NAME, 'canvas'))
            )
            print("✅ [BOT WHATSAPP] Dispositivo vinculado con éxito.")
            time.sleep(5)
        except Exception:
            print("✅ [BOT WHATSAPP] Sesión activa detectada. Procediendo...")

        # 🔥 FASE 2: CARGAR CHAT Y ESPERAR BOTÓN DE ENVÍO
        mensaje_codificado = urllib.parse.quote(mensaje)
        url = f"https://web.whatsapp.com/send?phone={numero_limpio}&text={mensaje_codificado}"
        driver.get(url)
        print("⏳ [BOT WHATSAPP] Cargando el chat y esperando renderizado del texto...")

        wait = WebDriverWait(driver, 35)
        
        # El botón solo será "clicable" cuando el texto largo termine de pegarse en la caja
        send_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, '//span[@data-icon="send"]'))
        )
        time.sleep(1) # Pausa de seguridad para estabilizar el DOM
        send_button.click()
        
        # Dar tiempo a que el mensaje salga hacia el servidor de Meta antes de cerrar Chrome
        time.sleep(4)
        print("✅ [BOT WHATSAPP] Mensaje enviado automáticamente. Apagando navegador.\n")
        return True

    except Exception as e:
        print(f"❌ [BOT WHATSAPP] Error en el proceso: {e}\n")
        if driver:
            driver.save_screenshot(os.path.abspath("whatsapp_error.png"))
            print("📸 Se ha guardado 'whatsapp_error.png' en backend para diagnosticar el problema.")
        return False
    finally:
        if driver:
            driver.quit()