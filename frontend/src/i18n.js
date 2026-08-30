import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          "menu_pacientes": "Patients Dashboard",
          "boton_buscar": "Search",
          "cambiar_idioma": "Switch to Spanish",
          "btn_enviar_dicom": "📤 Send DICOM",
          "btn_productividad": "📊 PRODUCTIVITY DASHBOARD",
          "lbl_estudios_pantalla": "STUDIES ON SCREEN:"
        }
      },
      es: {
        translation: {
          "menu_pacientes": "Panel de Pacientes",
          "boton_buscar": "Buscar",
          "cambiar_idioma": "Cambiar a Inglés",
          "btn_enviar_dicom": "📤 Enviar DICOM",
          "btn_productividad": "📊 PANEL DE PRODUCTIVIDAD",
          "lbl_estudios_pantalla": "ESTUDIOS EN PANTALLA:"
        }
      }
    },
    fallbackLng: "es", // Si falla la detección, usará español
    interpolation: { escapeValue: false }
  });

export default i18n;