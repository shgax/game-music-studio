# Game Music Studio · Guía de puesta en marcha

[← Volver al README](../README.md)

Esta herramienta te ayuda a crear los sonidos de un videojuego: le cuentas cómo es tu juego, una inteligencia artificial te propone qué sonidos hacen falta, tú eliges cuáles producir, los generas y al final compartes una lista con el equipo.

**Funciona en tu propio equipo.** No hay cuentas, ni contraseñas, ni servidores del estudio. Todo lo que hagas se queda en tu ordenador.

Necesitarás unos **15 minutos** la primera vez.

---

## Antes de empezar

Necesitas tres cosas:

1. **Node.js**, un programa gratuito que hace funcionar la herramienta. Se instala una sola vez (paso 1).
2. **Una cuenta con alguna inteligencia artificial**: Claude, Gemini u OpenAI. La que ya uses sirve. Necesitarás una *clave* de esa cuenta (paso 4).
3. **Una cuenta de ElevenLabs** para convertir los prompts en sonidos. Lo haces tú en su página: la herramienta no te pide su clave.

> Cada sonido que generes gasta créditos de **tu** cuenta de ElevenLabs, y cada análisis gasta saldo de **tu** cuenta de IA. El estudio no paga nada por ti ni ve tu consumo.

---

## Paso 1 · Instala Node.js (solo la primera vez)

1. Entra en **https://nodejs.org**.
2. Descarga la versión que dice **LTS** (la recomendada).
3. Ábrela y sigue el instalador pulsando «Siguiente» hasta terminar.

Si ya lo tenías instalado, salta al paso 2.

## Paso 2 · Descarga la herramienta

1. Entra en la página de la herramienta: **https://github.com/shgax/game-music-studio**.
2. Pulsa el botón verde **Code** y luego **Download ZIP**.
3. Descomprime la carpeta y guárdala donde no se borre sola, por ejemplo en *Documentos*. **No la muevas después**: así no pierdes nada.

> Si sabes usar `git`, puedes clonarla con `git clone https://github.com/shgax/game-music-studio.git` y, de vez en cuando, traer mejoras de la propia herramienta con `git pull`. No es necesario: **los prompts se actualizan solos**, ver más abajo.

## Paso 3 · Ponla en marcha

- **En Mac**: haz doble clic en **`iniciar.command`**.
  - La primera vez, el Mac puede decir que no puede abrirlo porque viene de internet. Haz clic derecho sobre el archivo, elige **Abrir** y confirma.
  - Si dice que no tienes permiso, abre la aplicación *Terminal*, escribe `chmod +x ` (con un espacio al final), arrastra el archivo `iniciar.command` a la ventana y pulsa Intro. Luego vuelve a abrirlo.
- **En Windows**: haz doble clic en **`iniciar.bat`**.
  - Si aparece un aviso azul de «Windows protegió su equipo», pulsa **Más información** y luego **Ejecutar de todas formas**.

Se abrirá una ventana negra con texto (déjala abierta) y, unos segundos después, tu navegador con la herramienta. **La primera vez tarda un poco más** porque prepara todo; necesita internet.

> **Muy importante:** la herramienta vive siempre en **http://localhost:5173/**. Guárdala en favoritos. Tus juegos y tus claves se guardan *en el navegador y para esa dirección*: si abres otra dirección distinta o usas otro navegador, parecerá que se han perdido, pero siguen en el original.

Para cerrar la herramienta, cierra la ventana negra.

## Paso 4 · Conecta tu inteligencia artificial

1. Pulsa el engranaje **⚙️** arriba a la derecha.
2. En **Motor de IA**, elige tu proveedor (Claude, Gemini, OpenAI…).
3. Pega tu **clave**. Si no sabes dónde conseguirla, abre **«¿Cómo obtener las claves?»** al final del panel: lo explica paso a paso.
4. Pulsa **Comprobar conexión**. Debe decir «Conexión correcta».
5. Pulsa **Guardar**.

### Sobre tus claves

- Se guardan **solo en tu navegador**. No se envían al estudio ni a nadie más que al proveedor que elijas.
- Quedan guardadas tal cual: **no las dejes en un ordenador que no sea tuyo**. Si usas un equipo prestado, pulsa «Borrar todas las claves de este equipo» al terminar.
- Nunca aparecen en los archivos que exportas.

## Paso 5 · Crea tus sonidos

La herramienta te guía paso a paso, con explicaciones en pantalla. En resumen:

1. **Cuenta tu juego**: crea el juego, sube capturas de pantalla y escribe cómo quieres que suene.
2. **Revisa la lista**: la IA propone los sonidos. Léelos, corrige lo que quieras y **aprueba para producción** los que vayas a generar.
3. **Crea y guarda**: copia el prompt de cada sonido, genéralo en la página de ElevenLabs, descárgalo, guárdalo en tu Drive y pega el enlace en su fila.
4. **Comparte**: exporta una página web o una hoja de Excel y envíasela al equipo del juego.

Si no sabes qué significa una palabra, pulsa **📖 Glosario**. Si prefieres ver cómo queda antes de empezar, carga **el ejemplo** (un juego inventado) desde la pantalla inicial.

## Los prompts se mantienen al día

Los prompts que propone la herramienta —el catálogo, las listas base de cada género y las instrucciones que recibe la IA— los mejora el estudio con el tiempo. Para que no tengas que descargar nada, **la herramienta puede consultar, al abrirse, una dirección pública del repositorio** y traer la última versión.

- **La primera vez te lo avisa** y no consulta nada hasta que aceptes.
- **Solo lee.** No envía tus claves, tus imágenes ni tus juegos. GitHub, que aloja la dirección, puede ver la dirección de red de tu equipo.
- **Se puede apagar** en ⚙️ → **Prompts del estudio**. Allí también ves qué versión usas, puedes pulsar *Buscar actualización ahora* o *Volver a la copia incluida*.
- **Sin conexión funciona igual**, con la última versión que descargó o la que viene incluida.
- **No cambia lo que ya tienes escrito.** Los prompts que ya están en los sonidos de tus juegos no se tocan; la novedad solo afecta a lo que insertes o analices después.
- Si la versión nueva necesita una versión más reciente de la herramienta, te lo dice: descarga el ZIP otra vez.

> **Importante:** guarda cada sonido en tu Drive en cuanto lo descargues de ElevenLabs y pega su enlace en la fila. La herramienta guarda **dónde está** el archivo, no el archivo.

---

## Si algo no funciona

| Qué ves | Qué hacer |
| :-- | :-- |
| «Falta instalar Node.js» | Haz el paso 1 y vuelve a abrir el lanzador. |
| «El puerto 5173 está ocupado» | Ya tienes la herramienta abierta en otra ventana negra. Ciérrala o úsala. |
| La página sale en blanco | Espera unos segundos y recarga. Si sigue igual, cierra la ventana negra y vuelve a abrirla. |
| Mis juegos han desaparecido | Comprueba que abres **http://localhost:5173/** y el mismo navegador de siempre. |
| «Claude/Gemini/OpenAI rechazó la clave» | Revisa que la copiaste entera, sin espacios. Tu clave no se ha borrado. |
| «Sin saldo» o «límite alcanzado» | Es tu cuenta con ese proveedor, no la herramienta. Revisa tu saldo en su sitio web. |
| «No se obtuvo respuesta» | Revisa tu internet. Si usas un servicio propio, comprueba que admite peticiones desde el navegador. |

## Tus datos

- Tus juegos se guardan **en este navegador**. Si borras los datos del navegador, se pierden.
- Para tener una copia, entra en ⚙️ y pulsa **Descargar respaldo JSON**. Hazlo de vez en cuando.
- Los archivos de audio **no se guardan en la herramienta**: solo el enlace que tú pegas.

## Actualizar la herramienta

Cuando te envíen una versión nueva, descomprímela en otra carpeta y ábrela con el lanzador. Para conservar tus juegos, usa **Descargar respaldo JSON** en la versión anterior; los juegos viven en el navegador, así que seguirán ahí mientras uses **http://localhost:5173/**.

---

¿Sigue sin funcionar o tienes una idea? [Abre una incidencia](https://github.com/shgax/game-music-studio/issues/new) o díselo a quien te pasó el enlace. Licencia [MIT](../LICENSE).
