// Compositor de prompts.
//
// Implementa la fórmula de specs/reference/03_PROMPT_ENGINEERING.md §1:
//   [Duración] + [tipo de asset y momento exacto] + [acción temporal]
//   + [materiales o instrumentación] + [carácter emocional y función]
//   + [identidad temática] + [restricciones] + [tratamiento técnico]
//
// El orden no es una convención estética: los motores de generación prestan más
// atención al inicio del prompt, y la duración debe encabezar para que no la
// deduzcan del resto del texto. Componer desde partes garantiza ese orden por
// construcción, en vez de depender de que quien escribe se acuerde.
//
// Los tres últimos componentes no se escriben a mano: la identidad sale del
// proyecto, y las restricciones y el tratamiento técnico del perfil del asset.

import { getTechnicalProfile } from './soundModel.js';
import { THEME_PLACEHOLDER, applyTheme } from './analysisModel.js';

// Los cinco componentes que sí redacta una persona.
export const PROMPT_PARTS = [
  {
    key: 'duration',
    label: 'Duración',
    order: 1,
    derived: 'Del campo del asset',
    hint: 'Encabeza siempre: es lo que peor deduce el motor del resto del texto'
  },
  {
    key: 'event',
    label: 'Tipo de asset y momento exacto',
    order: 2,
    placeholder: 'Main spin button press in a slot interface',
    hint: 'Qué es y cuándo suena, no cómo suena'
  },
  {
    key: 'action',
    label: 'Acción temporal',
    order: 3,
    placeholder: 'Fast attack, short tactile body, immediate stop',
    hint: 'La secuencia en el tiempo: ataque, cuerpo, cola'
  },
  {
    key: 'materials',
    label: 'Materiales o instrumentación',
    order: 4,
    placeholder: 'Dense wood and soft rubber contact',
    hint: 'De qué está hecho el sonido físicamente'
  },
  {
    key: 'function',
    label: 'Carácter emocional y función',
    order: 5,
    placeholder: 'Confirms the action without suggesting any reward',
    hint: 'Qué comunica al jugador, y qué NO debe comunicar'
  },
  {
    key: 'theme',
    label: 'Identidad temática',
    order: 6,
    derived: 'Del proyecto',
    hint: 'Lo que hace que todos los sonidos suenen al mismo juego'
  },
  {
    key: 'restrictions',
    label: 'Restricciones',
    order: 7,
    derived: 'De la configuración del proyecto',
    hint: 'Política de voz y rasgos prohibidos'
  },
  {
    key: 'technical',
    label: 'Tratamiento técnico',
    order: 8,
    derived: 'Del perfil de mezcla del asset',
    hint: 'Nunca universal: una BGM no lleva reverb cero'
  }
];

export const EDITABLE_PARTS = PROMPT_PARTS.filter(p => !p.derived);

// --- Restricciones derivadas de la configuración ---

const voiceClause = (voice = {}) => {
  const bans = [];
  if (voice.vocals_allowed === false) bans.push('no vocals');
  if (voice.speech_allowed === false) bans.push('no speech');
  if (voice.chants_allowed === false) bans.push('no chants');
  if (voice.laughter_allowed === false) bans.push('no laughter');
  return bans;
};

export const buildRestrictions = (config = {}, category) => {
  const parts = [...voiceClause(config.voice)];

  // Un SFX no lleva música dentro; un stinger es música por definición.
  if (!['BGM', 'AMB', 'STG'].includes(category)) parts.push('no music');

  const forbidden = config.restrictions?.forbidden_audio_traits || [];
  if (forbidden.length) parts.push(`no ${forbidden.join(', no ')}`);

  const mandatory = config.restrictions?.mandatory_prompt_phrases || [];
  return [...mandatory, ...parts];
};

// --- Composición ---

const clean = (text = '') => String(text).trim().replace(/[.\s]+$/, '');

const formatDuration = (seconds, loop) => {
  const value = String(seconds ?? '').trim();
  if (!value) return null;
  return loop ? `${value} seconds seamless loop` : `${value} seconds`;
};

/**
 * Construye el prompt en el orden de la fórmula.
 * Las partes vacías se omiten en vez de dejar frases huecas.
 */
export const composePrompt = (parts = {}, { sound = {}, config = {}, themeTag } = {}) => {
  const segments = [];

  const duration = formatDuration(sound.duration_seconds, sound.loop);
  if (duration) segments.push(duration);

  for (const key of ['event', 'action', 'materials', 'function']) {
    const value = clean(parts[key]);
    if (value) segments.push(value);
  }

  // La identidad va como marcador y se resuelve al final, para que un prompt
  // compuesto sea tan reutilizable como uno del catálogo.
  segments.push(THEME_PLACEHOLDER);

  const restrictions = buildRestrictions(config, sound.category);
  if (restrictions.length) segments.push(restrictions.join(', '));

  const profile = getTechnicalProfile(sound.technical_profile);
  segments.push(profile.chain);

  const text = segments.join('. ') + '.';
  return themeTag !== undefined ? applyTheme(text, themeTag) : text;
};

// --- Descomposición ---

/**
 * Intenta separar un prompt existente en sus partes para poder editarlo.
 * Es best effort: un prompt escrito a mano puede no seguir la estructura, y en
 * ese caso se devuelve entero como `event` para que no se pierda nada.
 */
export const decomposePrompt = (text = '') => {
  const empty = { event: '', action: '', materials: '', function: '' };
  if (!text.trim()) return empty;

  // Se separa por puntos que no formen parte de un decimal.
  const segments = text.split(/\.(?!\d)/).map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return empty;

  let i = 0;
  // Saltar la duración si encabeza.
  if (/^\d+(\.\d+)?\s+seconds?/i.test(segments[0])) i = 1;

  // Descartar por el final los segmentos derivados: técnica, restricciones e
  // identidad. Se reconocen por su vocabulario fijo.
  const isDerived = (s) =>
    s === THEME_PLACEHOLDER ||
    /clean|isolated|dry|zero reverb|game-ready|loop transition|strong ending|spatial depth|no voice|no vocals|no speech|no music|no chants|no laughter|instrumental only|designed to leave space|theme$/i.test(s);

  let end = segments.length;
  while (end > i && isDerived(segments[end - 1])) end--;

  const body = segments.slice(i, end);
  if (body.length === 0) return empty;

  // Con menos de cuatro segmentos no se puede repartir con criterio: todo va a
  // `event` para que la persona lo reparta.
  if (body.length < 4) return { ...empty, event: body.join('. ') };

  return {
    event: body[0] || '',
    action: body[1] || '',
    materials: body[2] || '',
    function: body.slice(3).join('. ')
  };
};

// --- Validación ---

/**
 * Comprueba la estructura de un prompt contra la fórmula y el asset.
 * Devuelve una lista de problemas, cada uno con su severidad y un `code` estable:
 * quien decide por la naturaleza del problema (la validación del paquete de prompts)
 * lo hace por el código, no por el texto del mensaje, que puede cambiar de redacción.
 */
export const validatePrompt = (text = '', sound = {}, config = {}) => {
  const problems = [];
  const add = (level, code, message) => problems.push({ level, code, message });

  if (!text.trim()) {
    add('error', 'empty', 'Sin prompt.');
    return problems;
  }

  // Un efecto abre con su duración. Una cama o un ambiente abre con la ESCENA, y la duración va
  // después o no va (03_PROMPT_ENGINEERING §12): gastar la primera frase en un número le deja al
  // resto del prompt sin sitio donde ocurrir. Si la lleva, tiene que coincidir con la del asset.
  const isBed = ['BGM', 'AMB'].includes(sound.category);
  const durationMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s+seconds?/i)
    || (isBed ? text.match(/(?<![\d.])(\d+(?:\.\d+)?)\s+seconds?\b/i) : null);

  if (!durationMatch) {
    if (!isBed) add('error', 'no_duration', 'No empieza por la duración. El motor la deduce mal si no encabeza el prompt.');
  } else {
    const inPrompt = durationMatch[1];
    const declared = String(sound.duration_seconds ?? '').trim();
    if (declared && inPrompt !== declared) {
      add('error', 'duration_mismatch', `La duración del prompt (${inPrompt} s) no coincide con la del asset (${declared} s).`);
    }
  }

  if (sound.loop && !/seamless loop/i.test(text)) {
    add('warn', 'loop_mismatch', 'El asset es un loop pero el prompt no pide "seamless loop".');
  }
  if (!sound.loop && /seamless loop/i.test(text)) {
    add('warn', 'loop_mismatch', 'El prompt pide un loop pero el asset no está marcado como loop.');
  }

  const profile = getTechnicalProfile(sound.technical_profile);
  if (!text.includes(profile.chain.split(',')[0].trim())) {
    add('warn', 'missing_technical', `Falta el tratamiento técnico del perfil ${profile.label}.`);
  }

  // El error explícito del sistema: reverb cero en música o ambiente.
  if (['BGM', 'AMB'].includes(sound.category) && /zero reverb/i.test(text)) {
    add('error', 'zero_reverb', 'Una BGM o un ambiente no puede llevar "zero reverb": es un error explícito del sistema.');
  }

  // Las plantillas del sistema declaran la voz con "no voice, no vocals, no
  // speech": eso cubre coros y risas sin enumerarlos. Solo se avisa cuando el
  // prompt no declara la voz de ninguna forma.
  const voiceBans = voiceClause(config.voice);
  if (voiceBans.length) {
    const declaresVoice = /no voice|no vocals|instrumental only/i.test(text);
    if (!declaresVoice) {
      add('warn', 'voice_policy', 'La política de voz del proyecto no está declarada en el prompt.');
    } else if (config.voice?.speech_allowed === false && !/no speech|instrumental only/i.test(text)) {
      add('warn', 'voice_policy', 'El habla está prohibida y el prompt no lo declara.');
    }
  }

  for (const trait of config.restrictions?.forbidden_audio_traits || []) {
    const re = new RegExp(`\\b${trait.replace(/_/g, '[ _]')}\\b`, 'i');
    // Se busca fuera de la cláusula de prohibición: "no horror" es correcto.
    if (re.test(text.replace(new RegExp(`no ${trait.replace(/_/g, '[ _]')}`, 'ig'), ''))) {
      add('error', 'forbidden_trait', `Usa "${trait}", que está prohibido en este proyecto.`);
    }
  }

  if (text.includes(THEME_PLACEHOLDER)) {
    add('warn', 'unresolved_theme', 'Queda el marcador de identidad sin resolver.');
  }

  const segments = text.split(/\.(?!\d)/).filter(s => s.trim()).length;
  if (segments < 5) {
    add('warn', 'few_components', `Solo ${segments} componentes: la fórmula pide duración, momento, acción, materiales, función, identidad, restricciones y técnica.`);
  }

  return problems;
};

export const promptSeverity = (problems = []) =>
  problems.some(p => p.level === 'error') ? 'error'
    : problems.length ? 'warn'
      : 'ok';
