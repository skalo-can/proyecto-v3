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
from webdriver_manager.chrome import ChromeDriverManager

def enviar_mensaje_whatsapp(numero: str, mensaje: str) -> bool:
    """
    Envía un mensaje de WhatsApp automáticamente usando una sesión persistente de WhatsApp Web.
    """
    numero_limpio = str(numero).replace(" ", "").replace("-", "").replace("+", "").strip()
    
    # Carpeta local donde se guardan las cookies/sesión
    user_data_dir = os.path.abspath("./whatsapp_session")
    
    options = Options()
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = None
    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        
        mensaje_codificado = urllib.parse.quote(mensaje)
        url = f"https://web.whatsapp.com/send?phone={numero_limpio}&text={mensaje_codificado}"
        
        driver.get(url)
        print("⏳ Esperando a que cargue WhatsApp Web...")

        # Esperar hasta 25 segundos a que la caja de texto editable esté presente
        wait = WebDriverWait(driver, 25)
        
        # Selector del cuadro de texto editable de WhatsApp Web
        chat_box = wait.until(
            EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
        )
        
        time.sleep(2)  # Pequeña pausa de estabilidad
        
        # Enviar ENTER directamente a la caja del chat (no al body)
        chat_box.send_keys(Keys.ENTER)
        
        # Intentar presionar el botón de enviar explícitamente si ENTER no lo dispara
        time.sleep(2)
        try:
            send_button = driver.find_element(By.XPATH, '//button[@aria-label="Send"] | //button[@aria-label="Enviar"] | //span[@data-icon="send"]')
            send_button.click()
        except Exception:
            pass # Si la tecla ENTER ya lo envió, ignoramos la excepción del botón

        time.sleep(4)  # Esperar a que se procese el envío
        print("✅ Mensaje enviado automáticamente por WhatsApp Web.")
        return True

    except Exception as e:
        print(f"❌ Error al enviar mensaje mediante Selenium: {e}")
        return False
    finally:
        if driver:
            driver.quit()