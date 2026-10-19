// El prompt de análisis, independiente del proveedor de IA.
//
// Implementa specs/reference/SYSTEM_PROMPT_MASTER.md y la plantilla
// templates/VISUAL_ANALYSIS.md. El modelo actúa como director de audio y devuelve el
// análisis visual, la identidad sonora y la lista maestra.
//
// El texto de las instrucciones no está en este archivo sino en el paquete de prompts
// (prompts/paquete.json); aquí viven los bloques que calcula el código y el esquema de respuesta.
//
// Vive aquí, y no dentro de cada adaptador, para que «mismas instrucciones con
// cualquier motor» (feature 010, FR-013) sea verdad por construcción: Gemini, Claude y
// OpenAI reciben exactamente este texto y este esquema. Cada adaptador solo traduce
// el esquema a su dialecto.
//
// Principio operativo: la lista que devuelve NO está aprobada. Todos los assets
// llegan con planning_status 'pending_validation', porque el sistema exige validar
// el alcance antes de producir nada.

import { getProfile } from '../data/gameProfiles.js';
import {
  TECHNICAL_PROFILES,
  CATEGORY_KEYS,
  PRIORITIES,
  SOURCE_GROUPS,
  BUILD_TYPES
} from '../data/soundModel.js';
import { ANALYSIS_SECTIONS, DOUBT_LEVELS } from '../data/analysisModel.js';
import { fillSystemTemplate, fillDescriptionTemplate } from '../data/promptPackage.js';

// Traduce el perfil de género a instrucciones concretas para el modelo.
const buildGenreBrief = (gameType, complexity) => {
  const profile = getProfile(gameType);
  const [min, max] = profile.ranges[complexity] || profile.ranges.standard;

  const lines = [
    `GAME PROFILE: ${profile.label}.`,
    profile.objective ? `Scope of this profile: ${profile.objective}` : '',
    `Expected official asset count for ${complexity} complexity: ${min} to ${max}. Stay inside this range.`,
    `Audio families to cover: ${profile.categories.join(', ')}.`
  ];

  if (profile.coreMinimum) {
    lines.push(`Minimum core that must be present: ${profile.coreMinimum.join(', ')}.`);
  }
  if (profile.conditionals) {
    lines.push(`Add conditional assets only if the images or description show them: ${profile.conditionals}`);
  }
  if (profile.formula) {
    lines.push(`Count using: ${profile.formula}`);
  }
  if (profile.risks?.length) {
    lines.push(`Known mistakes for this genre, avoid them: ${profile.risks.join(' ')}`);
  }
  return lines.filter(Boolean).join('\n');
};

// La ficha del juego: lo que el director ya sabe y no hay que adivinar.
// Es la diferencia entre estimar el alcance y calcularlo con la fórmula del
// perfil, que necesita saber cuántos símbolos se animan y cuántos niveles de
// premio existen.
const buildDiscoveryBrief = (gameType, discovery = {}) => {
  const profile = getProfile(gameType);
  const questions = profile.questions || [];

  const answered = [];
  const missing = [];

  for (const q of questions) {
    const raw = discovery[q.key];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();

    if (!value) {
      missing.push(q.key);
      continue;
    }
    const readable = q.type === 'boolean' ? (value === 'yes' ? 'yes' : 'no') : value;
    answered.push(`  ${q.key}: ${readable}`);
  }

  const lines = [];

  if (answered.length) {
    lines.push(
      'GAME FACTS confirmed by the audio director. These are established, not guesses.',
      'Use them to COMPUTE the asset count with the profile formula, never contradict them:',
      ...answered
    );
  }

  if (missing.length) {
    lines.push(
      `UNKNOWN: the director did not specify ${missing.join(', ')}.`,
      'Infer them from the images if possible, and list every one you could not determine under "openQuestions" instead of inventing it.'
    );
  } else if (answered.length) {
    lines.push('Every profile question is answered. "openQuestions" should only contain doubts that arise from the images themselves.');
  }

  return lines.join('\n');
};

// Restricciones del proyecto. Por el Artículo VIII, las restricciones son por
// proyecto y las visuales NO se convierten en sonoras.
const buildRestrictionsBrief = (config = {}) => {
  const voice = config.voice || {};
  const r = config.restrictions || {};
  const lines = [];

  const voiceBans = [];
  if (voice.vocals_allowed === false) voiceBans.push('no vocals');
  if (voice.speech_allowed === false) voiceBans.push('no speech');
  if (voice.chants_allowed === false) voiceBans.push('no chants');
  if (voice.character_voice_allowed === false) voiceBans.push('no character voice');
  if (voice.laughter_allowed === false) voiceBans.push('no laughter');
  if (voiceBans.length) {
    lines.push(`VOICE POLICY: ${voiceBans.join(', ')}. Never request choirs, chants or spoken lines in any prompt.`);
  }

  if (r.forbidden_audio_traits?.length) {
    lines.push(`FORBIDDEN AUDIO TRAITS for this project: ${r.forbidden_audio_traits.join(', ')}. Never use these words or their aesthetics in any prompt.`);
  }
  if (r.forbidden_visual_themes?.length) {
    lines.push(`FORBIDDEN VISUAL THEMES: ${r.forbidden_visual_themes.join(', ')}. These are visual constraints only. Do NOT translate them into sonic restrictions.`);
  }
  if (r.mandatory_prompt_phrases?.length) {
    lines.push(`Every prompt MUST include: ${r.mandatory_prompt_phrases.join(', ')}.`);
  }
  if (r.forbidden_prompt_phrases?.length) {
    lines.push(`No prompt may contain: ${r.forbidden_prompt_phrases.join(', ')}.`);
  }

  return lines.join('\n');
};

// Esquema de respuesta estructurada, como JSON Schema ESTÁNDAR.
//
// Forzar JSON válido no basta: hay que forzar su forma. Con `enum`, el modelo no puede
// devolver «SFX» como categoría ni «Alta» como prioridad, que no existen. Se construye
// a partir del modelo de datos para que no puedan desincronizarse.
//
// Cada proveedor lo recibe a su manera: Gemini lo traduce a su dialecto, Claude lo usa
// como esquema de una herramienta de salida forzada, OpenAI como `json_schema`.
const STR = { type: 'string' };

const objectOf = (keys) => ({
  type: 'object',
  properties: Object.fromEntries(keys.map(k => [k, STR])),
  required: keys
});

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(
      ANALYSIS_SECTIONS.map(sec => [sec.key, objectOf(sec.fields.map(f => f.key))])
    ),
    doubts: {
      type: 'object',
      properties: Object.fromEntries(
        DOUBT_LEVELS.map(l => [l.key, { type: 'array', items: STR }])
      ),
      required: DOUBT_LEVELS.map(l => l.key)
    },
    sounds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: STR,
          official_filename: STR,
          category: { type: 'string', enum: CATEGORY_KEYS },
          subtype: STR,
          game_event: STR,
          usage: STR,
          objective: STR,
          duration_seconds: STR,
          priority: { type: 'string', enum: PRIORITIES },
          loop: { type: 'boolean' },
          source_group: { type: 'string', enum: SOURCE_GROUPS.map(g => g.key) },
          single_or_stems: { type: 'string', enum: BUILD_TYPES.map(b => b.key) },
          technical_profile: { type: 'string', enum: TECHNICAL_PROFILES.map(p => p.key) },
          prompt: STR,
          notes: STR
        },
        required: [
          'id', 'official_filename', 'category', 'game_event', 'usage', 'objective',
          'duration_seconds', 'priority', 'loop', 'source_group', 'single_or_stems',
          'technical_profile', 'prompt'
        ]
      }
    }
  },
  required: [...ANALYSIS_SECTIONS.map(s => s.key), 'doubts', 'sounds']
};

const TECHNICAL_BRIEF = TECHNICAL_PROFILES
  .map(p => `- "${p.key}" (${p.usage}): end the prompt with "${p.chain}"`)
  .join('\n');

// El prompt de sistema completo. El TEXTO de las instrucciones vive en el paquete de prompts
// (prompts/paquete.json, feature 011) y se puede mejorar sin tocar el código; aquí solo se
// rellenan los cuatro bloques que dependen del juego y que calcula el código. La estructura
// de la respuesta que se le pide al motor es la de RESPONSE_SCHEMA: el paquete declara qué
// formato describe y la herramienta solo lo acepta si sabe leerlo.
export const buildSystemPrompt = (gameType = 'Slot', config = {}, discovery = {}, pkg) => {
  const complexity = config.complexity_level || 'standard';

  return fillSystemTemplate(pkg.analysis.systemTemplate, {
    GENRE_BRIEF: buildGenreBrief(gameType, complexity),
    DISCOVERY_BRIEF: buildDiscoveryBrief(gameType, discovery),
    RESTRICTIONS_BRIEF: buildRestrictionsBrief(config),
    TECHNICAL_BRIEF
  });
};

// Lo que acompaña al prompt de sistema: la descripción de la persona.
export const buildDescriptionMessage = (description, pkg) =>
  fillDescriptionTemplate(pkg.analysis.descriptionTemplate, description);
