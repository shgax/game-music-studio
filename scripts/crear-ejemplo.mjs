#!/usr/bin/env node
//
// Genera src/data/exampleProject.js: el ÚNICO ejemplo que ofrece la herramienta.
//
//   node scripts/crear-ejemplo.mjs
//
// El ejemplo es un juego FICTICIO, inventado para enseñar: no hay cliente ni obra real
// detrás. La herramienta se reparte en un repositorio público, y un ejemplo sacado de un
// trabajo real regalaría ese trabajo en cada copia (feature 011, D16).
//
// La lista de sonidos parte de la lista base de Slot del paquete de prompts
// (prompts/paquete.json), con la identidad temática del juego ya puesta, y reescribe a
// mano los cinco prompts que más ganan al anclarse a la escena. El ejemplo sale donde
// empieza cualquier juego (feature 010, FR-061): los seis ejes en su valor inicial, sin
// historial y sin ubicación de audios. Uno con estados avanzados enseñaría que el trabajo
// se da por hecho (Principio 6).
//
// Cada prompt pasa por las mismas reglas que valida la herramienta; si alguno las incumple,
// no se escribe nada. El resultado se revisa a mano y se versiona. Volver a ejecutarlo lo
// regenera.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAnalysis, applyTheme } from '../src/data/analysisModel.js';
import { createSound } from '../src/data/soundModel.js';
import { validatePackage } from '../src/data/promptPackage.js';
import { validatePrompt } from '../src/data/promptComposer.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'src/data/exampleProject.js');

const EXAMPLE_ID = 'proj_example_firefly_forest';
const THEME_TAG = 'firefly forest dusk';

// --- El juego ficticio ---

const analisis = {
  gameAnalysis: {
    name: 'Bosque de las Luciérnagas',
    type: 'Slot de vídeo 5x3, 20 líneas de pago',
    theme: 'Un bosque encantado al anochecer, con luciérnagas doradas y hongos de cristal',
    scenario: 'Un claro entre troncos cubiertos de musgo, con niebla baja y farolillos de vidrio colgados de las ramas.',
    visualStyle: 'Ilustración cálida en ámbar, verde musgo y azul noche; texturas de madera, cristal soplado y latón pulido.',
    energy: 'Media: acogedora, con picos de brillo en los premios.',
    feeling: 'Calma mágica y expectativa dulce.',
    narrative: 'Un paseo nocturno en el que cada premio enciende una luz más.'
  },
  context: {
    mainCharacter: 'Una lechuza de madera tallada que vigila el tablero.',
    animals: 'Ninguno vivo. Las luciérnagas son luces dibujadas.',
    symbols: 'Alto valor: lechuza, hongo de cristal, farolillo, llave de latón. Bajo valor: A, K, Q, J y 10 sobre hojas.',
    objects: 'Farolillos de vidrio, cajas de música, llaves de latón.',
    background: 'Bosque al anochecer, troncos con musgo y niebla baja.',
    elementsToSound: 'El WILD, una luciérnaga dorada que se enciende. El SCATTER, un hongo de cristal que resuena. El cartel de premio, con farolillos que se encienden en cadena.',
    materials: 'Madera tallada, cristal soplado, latón pulido, papel de seda.',
    magicElements: 'Destellos dorados de luciérnaga y brillos de cristal.',
    mechanicalElements: 'Rodillos de madera con remaches de latón.',
    naturalElements: 'Bosque, niebla y hojas.',
    techElements: 'Ninguno.',
    colors: 'Ámbar, verde musgo, azul noche y dorado.',
    interface: 'Botones de madera con remaches de latón y marcos de hoja.',
    modes: 'Juego base y tiradas gratis, que ocurren más adentro del bosque y más de noche.',
    moments: 'El giro, las paradas de rodillo, la aparición del WILD y del SCATTER, los carteles de premio y la activación de las tiradas gratis.'
  },
  soundDetails: {
    materials: 'Madera, cristal, latón y papel de seda. Nada de carne ni de voz.',
    ui: 'Clics de madera pulida con remache de latón: cortos, sin cola, sin sonar a premio.',
    sfx: 'Cada símbolo especial tiene su material: el WILD es luz dorada sobre latón; el SCATTER, cristal que resuena.',
    loops: 'El giro del rodillo es madera rodando con un zumbido grave de latón; el contador de premio sube con campanillas de cristal.',
    bgm: 'Tres camas de 60 s con pulso continuo: marimba, percusión de mano, bajo acústico y una frase de glockenspiel que vuelve.',
    stingers: 'Impacto, cascada de monedas y campanas. Sin melodía propia: la música viene de una cama aparte.',
    bigWins: 'Cuatro niveles (Big, Mega, Super Mega y Epic). Cada uno suma un material nuevo y audible en lugar de subir solo el volumen.',
    layers: 'Ninguna por ahora. Los premios son piezas únicas de hasta 3 s con una cola natural.',
    exclusions: 'Voz, coros, risas y cualquier sonido de animal.',
    restrictions: 'Sin música dentro de los efectos, salvo en los stingers.'
  },
  identity: {
    summary: 'Todo lo que el jugador toca suena a un objeto del bosque nocturno: madera, cristal y latón. Todo lo que celebra suena a luces que se encienden una a una.',
    palette: 'Marimba, glockenspiel, percusión de mano, bajo acústico, cuerdas y metales cortos. Efectos de madera, cristal soplado, latón y papel de seda.',
    rules: 'La luz es dorada y cálida; el cristal nunca suena a hielo. El bosque es acogedor, no inquietante.',
    themeTag: THEME_TAG
  },
  doubts: {
    confirmed: ['Cinco rodillos y tres filas, con veinte líneas de pago', 'Una lechuza de madera como mascota, sin voz', 'Tiradas gratis con un fondo propio'],
    probable: ['Los farolillos se encienden en cadena en los carteles de premio'],
    notVisible: ['No se ve ninguna pantalla de carga', 'No se ve ningún jackpot'],
    needsValidation: ['¿Cuántas tiradas gratis concede cada combinación de SCATTER?', '¿La lechuza reacciona a los premios, o solo mira?']
  },
  openQuestions: []
};

const proyecto = {
  id: EXAMPLE_ID,
  name: 'Ejemplo · Bosque de las Luciérnagas',
  type: 'Slot',
  coverImage: '/images/ejemplo_portada.svg',
  context: 'Slot de vídeo 5x3 con 20 líneas de pago, ambientado en un bosque encantado al anochecer: troncos con musgo, hongos de cristal que brillan, farolillos de vidrio colgados de las ramas y luciérnagas doradas que cruzan la pantalla. La mascota es una lechuza de madera tallada que vigila el tablero. Tono acogedor y mágico. Este juego es FICTICIO: está inventado para enseñar a usar la herramienta.',
  config: {
    complexity_level: 'standard',
    voice: {
      vocals_allowed: false,
      speech_allowed: false,
      chants_allowed: false,
      character_voice_allowed: false,
      laughter_allowed: false
    },
    technical: { format: 'WAV', sample_rate: 48000, bit_depth: 24 },
    restrictions: {
      forbidden_audio_traits: ['vocals', 'speech', 'chants', 'animal_sounds'],
      forbidden_visual_themes: [],
      mandatory_prompt_phrases: [],
      forbidden_prompt_phrases: ['vocals']
    }
  },
  discovery: {
    reels: '5',
    rows: '3',
    pay_system: '20 líneas de pago',
    regular_symbols: '5',
    animated_regular_symbols: '3',
    special_symbols: '2',
    wild_types: 'Luciérnaga dorada que se enciende',
    scatter_types: 'Hongo de cristal',
    bonus_modes: '1',
    free_spin_modes: '1',
    win_tiers: '4',
    jackpot_tiers: '0',
    characters: 'Una lechuza de madera tallada, sin voz',
    character_voice: 'no',
    cascades: 'no',
    respins: 'no',
    dynamic_music: 'no'
  },
  analysis: normalizeAnalysis(analisis)
};

// --- Los cinco prompts reescritos a mano: anclados a la escena que se ve ---

const TAIL_MUSICAL = 'Instrumental only, no vocals, no chants, polished game-ready mix, controlled low end, clean loop transition.';
const TAIL_DRY = 'No voice, no vocals, no speech, no music, clean, isolated, completely dry, zero reverb.';
const TAIL_SPATIAL = 'Instrumental only, no vocals, clean game-ready mix, controlled spatial depth, strong ending.';

const reescritos = {
  '001': {
    prompt: `Base game bed for a mossy forest at dusk, heard from a clearing where glass lanterns hang from the branches. 60.0 seconds seamless loop. Unhurried mid-tempo groove in D major with a steady pulse: marimba playing eighth notes, soft hand percussion, warm acoustic bass and a four-note glockenspiel phrase that returns every eight bars. The piece develops in passes that change the instrumentation without changing key, tempo or level, and never reaches a peak. No lead melody taking the foreground, clean uncluttered upper mids. [THEME]. ${TAIL_MUSICAL} The last bar leads straight back into the first with no gap.`,
    notes: 'Abre con la escena que se ve y lleva la duración después (03 §12). El desarrollo está escrito: sin él, a 60 s el motor repite ocho compases.'
  },
  '003': {
    prompt: `Free spins bed for the same forest deeper into the night, where the lanterns burn brighter and fireflies fill the air. 60.0 seconds seamless loop. Driving groove in B minor, the relative minor of the base bed, with a chord loop that pulls the pass back to the start: string ostinato in eighth notes, a short brass hook, hand drums and a percussion break that relaunches each pass. Same key signature and tempo family as the base bed, with the energy raised by doubling the rhythmic subdivision. No lead melody taking the foreground. [THEME]. ${TAIL_MUSICAL} The last bar leads straight back into the first with no gap.`,
    notes: 'Comparte tonalidad y tempo con la cama base: la energía sube doblando la subdivisión, no cambiando el tempo.'
  },
  '017': {
    prompt: `1.0 seconds. WILD symbol, a golden firefly, lighting up on the reels. Sharp glassy attack opening into a bright shimmer and a quick close. Struck brass and tiny glass bells. Draws attention to a valuable symbol without reading as a win. [THEME]. ${TAIL_DRY}`,
    notes: 'Material de latón y cristal para la luz dorada; nada de insectos ni de alas.'
  },
  '018': {
    prompt: `1.3 seconds. SCATTER symbol, a glowing crystal mushroom, locking into place on the reels. Weighted wooden thud opening into a resonant glass bloom. Hand-blown glass and a distant brass chime tail. Marks a rare symbol and raises expectation for the feature. [THEME]. ${TAIL_DRY}`,
    notes: 'Escala con el número de scatters que han aparecido.'
  },
  '019': {
    prompt: `2.0 seconds. Free spins feature triggering after the third crystal mushroom locks in. Strong wooden impact opening into a rising glass-bell figure with a decisive close. Brass, struck glass and bright bells. Celebrates the trigger itself, before the mode begins. [THEME]. ${TAIL_SPATIAL}`,
    notes: 'Celebra la activación; la entrada al modo la hace el stinger de inicio de tiradas gratis.'
  }
};

// --- La lista: la base de Slot del paquete, con la identidad puesta ---

const paquete = validatePackage(JSON.parse(fs.readFileSync(path.join(raiz, 'prompts/paquete.json'), 'utf8')));
if (!paquete.ok) {
  console.error('El paquete de prompts no es válido:', paquete.details.join(' · '));
  process.exit(1);
}

const reiniciar = (base) => {
  const sound = { ...base, ...(reescritos[base.id] || {}) };
  sound.prompt = applyTheme(sound.prompt, THEME_TAG);

  return createSound(sound.id, {
    ...sound,
    // Los seis ejes, en el valor con el que entra cualquier propuesta del análisis.
    planning_status: 'pending_validation',
    prompt_status: sound.prompt.trim() ? 'created' : 'not_created',
    production_status: 'not_generated',
    review_status: 'not_reviewed',
    mix_status: sound.single_or_stems === 'stems' ? 'pending' : 'not_required',
    delivery_status: 'not_delivered',
    versions: [],
    reviews: [],
    audioSource: ''
  });
};

const sonidos = paquete.pkg.templates.Slot.map(reiniciar);

// Cada prompt del ejemplo cumple las reglas del método, o no se escribe nada.
const incumplimientos = sonidos.flatMap(s =>
  validatePrompt(s.prompt, s, proyecto.config).filter(p => p.level === 'error').map(p => `${s.official_filename}: ${p.message}`)
);
if (incumplimientos.length) {
  console.error('El ejemplo incumple el método y no se escribe:\n  ' + incumplimientos.join('\n  '));
  process.exit(1);
}

const ejemplo = { ...proyecto, createdAt: new Date().toISOString(), sounds: sonidos };

const contenido = `// GENERADO por scripts/crear-ejemplo.mjs. No editar a mano: se regenera.
//
// El único ejemplo de la herramienta: un juego FICTICIO (el Bosque de las Luciérnagas),
// EMPEZANDO donde empieza cualquier juego. Sin enlaces a masters y con los seis ejes en su
// valor inicial. La persona lo carga a petición; nunca se carga solo (feature 010, FR-060
// y FR-061, enmendado por la feature 011).

export const EXAMPLE_PROJECT_ID = '${EXAMPLE_ID}';

export const EXAMPLE_PROJECT = ${JSON.stringify(ejemplo, null, 2)};
`;

fs.writeFileSync(salida, contenido);
console.log(`Escrito ${path.relative(raiz, salida)}: ${ejemplo.sounds.length} sonidos, ejes reiniciados, todos los prompts válidos.`);
