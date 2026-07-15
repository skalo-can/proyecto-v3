@echo off
echo ===================================================
echo 🚀 INICIANDO SUBIDA DUAL (DEVELOPMENT Y MAIN)...
echo ===================================================

:: 1. Guarda los cambios en tu rama actual (development)
git add .
git commit -m "Actualizacion rapida de desarrollo - %date% %time%"
git push origin development

:: 2. Salta a la rama principal y fusiona el código
echo.
echo 🔄 Fusionando con la rama main...
git checkout main
git merge development
git push origin main

:: 3. Regresa a tu rama de desarrollo para que sigas trabajando
echo.
echo 🔙 Regresando al entorno de desarrollo...
git checkout development

echo.
echo ===================================================
echo ✅ ¡AMBAS RAMAS ACTUALIZADAS CON EXITO!
echo ===================================================