#!/bin/bash
#
# Pone en marcha Sonidos Dashboard en este equipo (macOS). Doble clic para abrirlo.
#
# Usa SIEMPRE el puerto 5173: los proyectos y las claves se guardan en el navegador
# POR DIRECCIÓN, y si la dirección cambia, la persona creería haberlos perdido.

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Falta instalar Node.js. Descárgalo (la versión «LTS») en https://nodejs.org,"
  echo "instálalo y vuelve a abrir este archivo."
  echo ""
  read -r -p "Pulsa Intro para cerrar..." _
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Preparando la herramienta (solo la primera vez, necesita internet)..."
  if ! npm install; then
    echo ""
    echo "No se pudo preparar la herramienta. Revisa tu conexión a internet y vuelve a intentarlo."
    read -r -p "Pulsa Intro para cerrar..." _
    exit 1
  fi
fi

# Quien usa estos lanzadores suele ser un compañero que solo necesita los prompts: se abre
# la vista simple. Si ya existe un .env (el de quien desarrolla), no se toca.
if [ ! -f .env ]; then
  printf 'VITE_DEFAULT_VIEW=simple\n' > .env
fi

echo ""
echo "Abriendo http://localhost:5173/ ..."
echo "Deja esta ventana abierta mientras trabajes. Para cerrar la herramienta, ciérrala."
echo ""

# El navegador se abre unos segundos después, cuando el servidor ya responde.
( sleep 4; open "http://localhost:5173/" ) &

npm run dev -- --port 5173 --strictPort

echo ""
echo "La herramienta se ha detenido. Si ves un aviso de que el puerto 5173 está ocupado,"
echo "es que ya la tienes abierta en otra ventana: ciérrala o úsala."
read -r -p "Pulsa Intro para cerrar..." _
