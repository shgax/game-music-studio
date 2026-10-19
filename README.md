# Game Music Studio

**Del juego a la lista de sonidos con sus prompts, y de ahí al documento que recibe el equipo.**

Subes capturas de un videojuego y cuentas cómo quieres que suene. Una inteligencia artificial propone **qué sonidos hacen falta**, cada uno con su **prompt** (la instrucción que se le da al generador de audio) ya escrito siguiendo el método del estudio. Tú eliges cuáles producir, los generas, y la herramienta lleva la cuenta de **dónde guardaste** cada uno para entregar al final una página web o una hoja de Excel al equipo del juego.

Está pensada para que la use **cualquier persona del estudio, sin experiencia en audio**: te explica cada paso y cada palabra mientras trabajas.

```text
 Capturas del juego  →  La IA propone los sonidos  →  Tú apruebas los que valen
        →  Generas cada sonido (ElevenLabs) y lo guardas en tu Drive
        →  Pegas el enlace aquí  →  Exportas página web o Excel para el equipo
```

---

## Pruébala en 15 minutos

**Lo que necesitas**

1. **Node.js** (gratis): descarga la versión «LTS» en [nodejs.org](https://nodejs.org) e instálala con «Siguiente» hasta el final. Se hace una sola vez.
2. **La clave de una IA** de las que ya uses: Claude, Gemini u OpenAI. Es lo que le permite a la herramienta analizar tu juego.
3. **Una cuenta de [ElevenLabs](https://elevenlabs.io/)** para convertir los prompts en sonidos. Eso lo haces tú en su página; la herramienta no te pide su clave.

> Cada análisis gasta saldo de **tu** cuenta de IA y cada sonido, créditos de **tu** cuenta de ElevenLabs. La herramienta es gratis y no hay ninguna cuenta del estudio de por medio.

**Paso 1 · Descárgala.** Pulsa el botón verde **Code → Download ZIP** en esta página, descomprime la carpeta y déjala donde no se borre sola (por ejemplo, en *Documentos*).

**Paso 2 · Ponla en marcha.** Haz doble clic en **`iniciar.command`** (Mac) o en **`iniciar.bat`** (Windows). Se abre una ventana con texto, que debes dejar abierta, y después tu navegador con la herramienta en `http://localhost:5173`. La primera vez tarda un poco más. *(En Mac, si dice que no puede abrirlo, clic derecho sobre el archivo → Abrir. La [guía](docs/guia-puesta-en-marcha.md) lo explica paso a paso.)*

**Paso 3 · Conecta tu IA.** Pulsa el engranaje **⚙️** arriba a la derecha, elige tu proveedor en **Motor de IA**, pega tu clave y pulsa **Comprobar conexión**. Debe decir «Conexión correcta». Tu clave se queda en tu navegador.

**Paso 4 · Crea tus sonidos.** La pantalla te guía en cuatro pasos, con el actual resaltado:

| | Paso | Qué haces |
| :-- | :-- | :-- |
| 1 | **Cuenta tu juego** | Creas el juego, subes capturas y escribes cómo quieres que suene. Pulsas **Analizar y proponer sonidos**. |
| 2 | **Revisa la lista** | Lees lo que propone la IA, corriges lo que quieras y pulsas **Aprobar para producción** en los que vas a hacer. |
| 3 | **Crea y guarda** | Pulsas **Copiar prompt**, generas el sonido en la página de ElevenLabs, lo guardas en tu Drive y **pegas su enlace** en la fila. |
| 4 | **Comparte** | Marcas **Incluir en el documento** y exportas la **página web** o la **hoja de Excel** con los nombres y los enlaces. Se la envías al equipo del juego. |

> **¿Prefieres ver cómo queda antes de empezar?** En la pantalla inicial pulsa **Cargar el ejemplo**: es un juego inventado con su análisis y su lista de sonidos ya hechos. Sirve para leer y aprender, y no toca tus juegos.

Si te encuentras con una palabra que no conoces (prompt, loop, boceto…), pulsa **📖 Glosario**.

---

## Preguntas frecuentes

**¿Mis claves y mis juegos salen de mi ordenador?** No. Tus claves viven solo en tu navegador y únicamente se envían al proveedor de IA que elijas. Tus juegos también se guardan en tu navegador. No hay ningún servidor del estudio.

**¿Por qué los sonidos se generan a mano en ElevenLabs?** Es el flujo del estudio por ahora: la herramienta se encarga de que el prompt salga bien escrito y de llevar la cuenta de dónde quedó cada sonido; el sonido lo generas tú y lo guardas donde ya guardas todo, por ejemplo en Drive. La herramienta nunca sube los audios: solo anota **dónde están**.

**¿Cómo recibo las mejoras?** Los prompts se mantienen al día solos: la primera vez te pregunta si quieres que la herramienta consulte este repositorio al abrirse. Solo lee, no envía nada tuyo, y lo puedes apagar en ⚙️ → *Prompts del estudio*. Si algún día pide una versión nueva de la herramienta, descarga el ZIP otra vez.

**¿Y sin internet?** Todo funciona salvo el análisis con la IA. Los prompts usan la última versión que descargó o la que viene incluida.

**¿Hay una vista con más cosas?** Sí. Arriba está el interruptor **Simple / Completa**. La completa trae la tabla maestra, el tablero y los seis estados de cada sonido; está pensada para quien dirige el audio.

**¿Algo no funciona o tienes una idea?** Díselo a quien te pasó este enlace. La [guía paso a paso](docs/guia-puesta-en-marcha.md) tiene una sección «Si algo no funciona».

---

## Para quien desarrolla

Todo lo de abajo es técnico. Quien solo quiere usar la herramienta no lo necesita.

### El pipeline

| # | Etapa | Qué ocurre |
| :-- | :-- | :-- |
| 1 | **Concepto** | Subes capturas del juego y describes el tono. |
| 2 | **Análisis (IA)** | El motor de IA que elijas (Gemini, Claude, OpenAI o uno compatible) actúa como director de audio y puebla la matriz de sonidos. |
| 3 | **Prompts e IA** | Refinas los prompts y los llevas a ElevenLabs, donde generas los sonidos a mano. |
| 4 | **DAW (Logic Pro)** | Masterizas el WAV y registras dónde queda. |
| 5 | **Código** | Exportas el manifiesto JSON con las claves de evento. |

### Qué hace

- **Análisis multimodal con el motor que elijas**: Gemini, Claude (Anthropic), OpenAI o cualquier endpoint compatible con OpenAI, con tu propia clave. El motor lee las imágenes del juego y devuelve identidad sonora, materiales, restricciones y una lista maestra con prompts que siguen la fórmula de ocho componentes.
- **Prompts siempre al día**: el catálogo, las listas base por género y las instrucciones del análisis viven en `prompts/paquete.json`. Cada copia lo trae incluido y, tras un aviso y si la persona lo permite, lee la última versión publicada en este repositorio. Solo lectura, validado antes de usarse, desactivable y con la copia incluida como respaldo.
- **Tabla maestra**: rejilla editable con los seis ejes de estado del Audio Production System, nomenclatura validada en vivo y guardado automático.
- **Tablero por eje**: los mismos assets como tarjetas, agrupados por el eje que quieras consultar (producción, revisión, mezcla, entrega...).
- **Perfiles por género**: seis perfiles con rangos de alcance por complejidad, listas base para Slot, Crash y Casino de mesa, e importación de CSV.
- **Biblioteca de prompts**: catálogo curado de prompts probados, insertables en cualquier fila con un clic.
- **Nube sin fricción**: proyectos sincronizados en Vercel Blob, con respaldo local automático. Los WAV se referencian por ruta, no se duplican.
- **Manifiesto JSON**: exportación en un clic de las claves de evento para integrar en el juego.

### Arrancar en local

```bash
git clone https://github.com/shgax/game-music-studio.git
cd game-music-studio
npm install
npm run dev        # http://localhost:5173
```

Si no usas la terminal, `iniciar.command` (Mac) e `iniciar.bat` (Windows) hacen lo mismo con doble clic; la guía paso a paso para quien no es técnico está en [`docs/guia-puesta-en-marcha.md`](docs/guia-puesta-en-marcha.md).

| Comando | Qué hace |
| :-- | :-- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run build` | Bundle de producción en `dist/`. |
| `npm run lint` | Análisis estático con oxlint. |
| `npm run preview` | Sirve el bundle ya compilado. |
| `npm run prompts:validar` | Valida `prompts/paquete.json` con las mismas reglas que aplica la herramienta (también se ejecuta antes de cada `build`). Con `-- --probar`, lo ataca con variantes hostiles. |

**La aplicación funciona sin ninguna credencial.** En Modo Local guarda todo en el navegador: puedes crear juegos, cargar plantillas, importar CSV y trabajar la matriz completa. Las claves solo hacen falta para el análisis con IA, la generación de audio y la sincronización en la nube.

### Dónde se guarda tu trabajo

**Los proyectos, listas maestras y prompts** se guardan en **Vercel Blob** a través de `/api/db`. Sin OAuth, sin pantalla de consentimiento, sin sesiones que caduquen: el token vive en el servidor y nunca llega al navegador.

En paralelo, el navegador conserva **siempre** un respaldo local automático. Si la nube no está disponible —desarrollo con `npm run dev`, sin red, sin token— la aplicación sigue funcionando en modo local y nada se pierde. También puedes descargar la base completa como JSON desde el panel ⚙️.

**Los WAV masterizados NO se suben.** La aplicación guarda **dónde está** cada archivo (una ruta de tu disco o una URL), no el archivo. Así no se duplican gigas y tus masters siguen donde ya los tienes, en Logic Pro. Las rutas locales se muestran; las URL además se pueden reproducir desde la tabla.

#### Activar la nube

```bash
vercel integration add blob    # provisiona el store y la variable de entorno
vercel env pull .env.local     # para desarrollo con `vercel dev`
```

Eso crea `BLOB_READ_WRITE_TOKEN` en el proyecto. No hace falta nada más.

> En `npm run dev` la función `/api/db` no existe (Vite solo sirve el front). Es normal ver "Modo local". Para probar la nube en local usa `vercel dev`.

### Configurar las API keys

Se introducen en el panel ⚙️ y se guardan en el `localStorage` de tu navegador. Nunca salen de tu equipo.

#### Google Gemini

1. Entra en [Google AI Studio](https://aistudio.google.com/).
2. Pulsa **Get API Key** en el menú lateral.
3. Crea una clave y pégala en el panel.

#### Claude (Anthropic)

1. Entra en la [consola de Anthropic](https://console.anthropic.com/) → **API Keys**.
2. Crea una clave y pégala en el panel, eligiendo *Claude (Anthropic)* como motor.

#### OpenAI y compatibles

1. Crea una clave en la [plataforma de OpenAI](https://platform.openai.com/api-keys) y elige *OpenAI* como motor.
2. Para un servicio compatible con la API de OpenAI, elige *Compatible con OpenAI* e indica su dirección base (solo `https://`, o `http://` en `localhost`).

#### ElevenLabs

La herramienta **no pide la clave de ElevenLabs**: generar el sonido es un paso manual. Copias el prompt, lo generas en [ElevenLabs](https://elevenlabs.io/), guardas el archivo donde quieras (por ejemplo Drive) y pegas aquí su ruta o enlace.

Si quieres generar bocetos dentro de la herramienta, es una opción avanzada: pon `VITE_ELEVENLABS_API_KEY` en tu `.env` (ver `.env.example`). Sin esa clave no aparece ningún botón de generar.

### Desplegar en Vercel

```bash
npx vercel          # despliegue de vista previa
npx vercel --prod   # producción
```

Vercel autodetecta Vite. El `vercel.json` incluido añade el rewrite de SPA para que ninguna ruta devuelva 404.

El `vercel.json` también **apaga los despliegues automáticos desde Git** (`git.deploymentEnabled: false`): subir cambios a este repositorio no despliega nada. Se despliega a propósito, con los comandos de arriba. Si quieres que Vercel despliegue en cada `push`, quita esa línea.

**Después del primer despliegue:**

**Protege la URL.** En Vercel → *Settings* → *Deployment Protection* → activa **Password Protection**. La herramienta es interna y las claves de IA viven en el navegador de cada usuario: la URL no debe quedar abierta.

### Stack

Vite 8 · React 19 · Vanilla CSS (sin Tailwind, por constitución) · oxlint · Vercel Blob.
