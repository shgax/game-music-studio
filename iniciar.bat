@echo off
chcp 65001 >nul
rem Pone en marcha Sonidos Dashboard en este equipo (Windows). Doble clic para abrirlo.
rem
rem Usa SIEMPRE el puerto 5173: los proyectos y las claves se guardan en el navegador
rem POR DIRECCION, y si la direccion cambia, la persona creeria haberlos perdido.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Falta instalar Node.js. Descargalo ^(la version "LTS"^) en https://nodejs.org,
  echo instalalo y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Preparando la herramienta ^(solo la primera vez, necesita internet^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo No se pudo preparar la herramienta. Revisa tu conexion a internet y vuelve a intentarlo.
    pause
    exit /b 1
  )
)

rem Quien usa estos lanzadores suele ser un companero que solo necesita los prompts: se abre
rem la vista simple. Si ya existe un .env ^(el de quien desarrolla^), no se toca.
if not exist .env echo VITE_DEFAULT_VIEW=simple> .env

echo.
echo Abriendo http://localhost:5173/ ...
echo Deja esta ventana abierta mientras trabajes. Para cerrar la herramienta, cierrala.
echo.

rem El navegador se abre unos segundos despues, cuando el servidor ya responde.
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5173/"

call npm run dev -- --port 5173 --strictPort

echo.
echo La herramienta se ha detenido. Si ves un aviso de que el puerto 5173 esta ocupado,
echo es que ya la tienes abierta en otra ventana: cierrala o usala.
pause
