# Game Music Studio · Para quien desarrolla

> Todo lo de aquí es técnico. Quien solo quiere usar la herramienta no lo necesita: basta el [README](../README.md) o la [guía paso a paso](guia-puesta-en-marcha.md).

**Índice**
[Cómo funciona](#cómo-funciona) · [Qué hace](#qué-hace) · [Arrancar en local](#arrancar-en-local) · [Dónde se guarda tu trabajo](#dónde-se-guarda-tu-trabajo) · [Claves de IA](#configurar-las-api-keys) · [Desplegar en Vercel](#desplegar-en-vercel) · [Stack](#stack)

---

## Cómo funciona

| # | Etapa | Qué ocurre |
| :-- | :-- | :-- |
| 1 | **Concepto** | Subes capturas del juego y describes el tono. |
| 2 | **Análisis (IA)** | El motor de IA que elijas (Gemini, Claude, OpenAI o uno compatible) actúa como director de audio y puebla la matriz de sonidos. |
| 3 | **Prompts e IA** | Refinas los prompts y los llevas a ElevenLabs, donde generas los sonidos a mano. |
| 4 | **DAW (Logic Pro)** | Masterizas el WAV y registras dónde queda. |
| 5 | **Código** | Exportas el manifiesto JSON con las claves de evento. |

## Qué hace

- **Análisis multimodal con el motor que elijas**: Gemini, Claude (Anthropic), OpenAI o cualquier endpoint compatible con OpenAI, con tu propia clave. El motor lee las imágenes del juego y devuelve identidad sonora, materiales, restricciones y una lista maestra con prompts que siguen la fórmula de ocho componentes.
- **Prompts siempre al día**: el catálogo, las listas base por género y las instrucciones del análisis viven en `prompts/paquete.json`. Cada copia lo trae incluido y, tras un aviso y si la persona lo permite, lee la última versión publicada en este repositorio. Solo lectura, validado antes de usarse, desactivable y con la copia incluida como respaldo.
- **Tabla maestra**: rejilla editable con los seis ejes de estado del Audio Production System, nomenclatura validada en vivo y guardado automático.
- **Tablero por eje**: los mismos assets como tarjetas, agrupados por el eje que quieras consultar (producción, revisión, mezcla, entrega...).
- **Perfiles por género**: seis perfiles con rangos de alcance por complejidad, listas base para Slot, Crash y Casino de mesa, e importación de CSV.
- **Biblioteca de prompts**: catálogo curado de prompts probados, insertables en cualquier fila con un clic.
- **Nube opcional**: si despliegas tu propia copia, los proyectos pueden sincronizarse en Vercel Blob, siempre con respaldo local automático. Los WAV se referencian por ruta, no se duplican.
- **Manifiesto JSON**: exportación en un clic de las claves de evento para integrar en el juego.

## Arrancar en local

```bash
git clone https://github.com/shgax/game-music-studio.git
cd game-music-studio
npm install
npm run dev        # http://localhost:5173
```

Si no usas la terminal, `iniciar.command` (Mac) e `iniciar.bat` (Windows) hacen lo mismo con doble clic.

| Comando | Qué hace |
| :-- | :-- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run build` | Bundle de producción en `dist/`. |
| `npm run lint` | Análisis estático con oxlint. |
| `npm run preview` | Sirve el bundle ya compilado. |
| `npm run prompts:validar` | Valida `prompts/paquete.json` con las mismas reglas que aplica la herramienta (también se ejecuta antes de cada `build`). Con `-- --probar`, lo ataca con variantes hostiles. |

**La aplicación funciona sin ninguna credencial.** En modo local guarda todo en el navegador: puedes crear juegos, cargar plantillas, importar CSV y trabajar la matriz completa. Las claves solo hacen falta para el análisis con IA, la generación de audio y la sincronización en la nube.

## Dónde se guarda tu trabajo

En el modo por defecto, **los proyectos, listas maestras y prompts se guardan en el navegador**, en tu equipo.

Si despliegas tu propia copia con la nube activada, se guardan además en **Vercel Blob** a través de `/api/db`. Sin OAuth, sin pantalla de consentimiento, sin sesiones que caduquen: el token vive en el servidor y nunca llega al navegador. El navegador conserva **siempre** un respaldo local automático; si la nube no está disponible —desarrollo con `npm run dev`, sin red, sin token— la aplicación sigue funcionando en modo local y nada se pierde. También puedes descargar la base completa como JSON desde el panel ⚙️.

**Los WAV masterizados NO se suben.** La aplicación guarda **dónde está** cada archivo (una ruta de tu disco o una URL), no el archivo. Así no se duplican gigas y tus masters siguen donde ya los tienes. Las rutas locales se muestran; las URL además se pueden reproducir desde la tabla.

### Activar la nube (opcional)

```bash
vercel integration add blob    # provisiona el store y la variable de entorno
vercel env pull .env.local     # para desarrollo con `vercel dev`
```

Eso crea `BLOB_READ_WRITE_TOKEN` en el proyecto. No hace falta nada más.

> En `npm run dev` la función `/api/db` no existe (Vite solo sirve el front). Es normal ver «Modo local». Para probar la nube en local usa `vercel dev`.

## Configurar las API keys

Se introducen en el panel ⚙️ y se guardan en el `localStorage` de tu navegador. Nunca salen de tu equipo.

| Motor | Dónde conseguir la clave |
| :-- | :-- |
| **Google Gemini** | [Google AI Studio](https://aistudio.google.com/) → **Get API Key** → crea una clave y pégala en el panel. |
| **Claude (Anthropic)** | [Consola de Anthropic](https://console.anthropic.com/) → **API Keys**. En el panel elige *Claude (Anthropic)* como motor. |
| **OpenAI** | [Plataforma de OpenAI](https://platform.openai.com/api-keys). En el panel elige *OpenAI* como motor. |
| **Compatible con OpenAI** | Elige *Compatible con OpenAI* e indica su dirección base (solo `https://`, o `http://` en `localhost`). |

### ElevenLabs

La herramienta **no pide la clave de ElevenLabs**: generar el sonido es un paso manual. Copias el prompt, lo generas en [ElevenLabs](https://elevenlabs.io/), guardas el archivo donde quieras (por ejemplo Drive) y pegas aquí su ruta o enlace.

Si quieres generar bocetos dentro de la herramienta, es una opción avanzada: pon `VITE_ELEVENLABS_API_KEY` en tu `.env` (ver `.env.example`). Sin esa clave no aparece ningún botón de generar.

## Desplegar en Vercel

```bash
npx vercel          # despliegue de vista previa
npx vercel --prod   # producción
```

Vercel autodetecta Vite. El `vercel.json` incluido añade el rewrite de SPA para que ninguna ruta devuelva 404.

El `vercel.json` también **apaga los despliegues automáticos desde Git** (`git.deploymentEnabled: false`): subir cambios a este repositorio no despliega nada. Se despliega a propósito, con los comandos de arriba. Si quieres que Vercel despliegue en cada `push`, quita esa línea.

**Después del primer despliegue, protege la URL.** En Vercel → *Settings* → *Deployment Protection* → activa **Password Protection**. La herramienta es interna y las claves de IA viven en el navegador de cada usuario: la URL no debe quedar abierta.

## Stack

Vite 8 · React 19 · CSS puro (sin Tailwind) · oxlint · Vercel Blob.
