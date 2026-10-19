// El paquete de prompts: catálogo, listas base por género e instrucciones del análisis.
//
// Es un único archivo (prompts/paquete.json) que viaja de dos maneras: incluido en la
// herramienta al compilar y publicado en el repositorio del autor, de donde cada copia
// puede leer la versión más reciente (feature 011).
//
// Este módulo es PURO: no toca el navegador ni la red. Lo ejecutan igual la aplicación y
// los scripts de `node`, para que «lo que valida la herramienta» y «lo que se comprueba
// antes de publicar» sea exactamente la misma cosa.
//
// Lo que llega de fuera es DATO, nunca código. Por eso `validatePackage` no devuelve el
// objeto recibido: reconstruye uno nuevo campo a campo, solo con los campos conocidos.
// Lo desconocido se ignora y nada puede colarse (por ejemplo, una clave `__proto__`).
//
// Un paquete con un solo error se rechaza ENTERO: un catálogo a medias es peor que uno
// viejo y completo.

import {
  CATEGORY_KEYS,
  TECHNICAL_PROFILES,
  PRIORITIES,
  SOURCE_GROUPS,
  BUILD_TYPES,
  validateFilename
} from './soundModel.js';
import { validatePrompt } from './promptComposer.js';
import { gameProfiles } from './gameProfiles.js';

// --- Compatibilidad ---
//
// Los tres números los declara la herramienta y se suben A MANO cuando el código cambie
// de forma incompatible con lo que el paquete puede traer. Un paquete que exige más de
// lo que la copia entiende no se aplica: se avisa de que hay que actualizarla.
export const PACKAGE_FORMAT = 1;
//
// Historial de APP_LEVEL (lo que la herramienta entiende de un paquete):
//   1  versión inicial de la feature 011.
//   2  una cama o un ambiente puede abrir con la escena y llevar la duración después (o no
//      llevarla): la duración inicial ya no es obligatoria en BGM/AMB (2026-10-19).
// Actualizar los PROMPTS es publicar un paquete y no toca el código. Si un cambio de prompts
// necesita una regla nueva en este archivo, es también un cambio de herramienta: se sube este
// número y el paquete declara el nuevo `appLevel`, para que una copia anterior diga «actualiza tu
// copia» en lugar de descartar el paquete por «no cumplir las reglas».
export const APP_LEVEL = 2;
export const SUPPORTED_RESPONSE_FORMATS = [1];

export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;

// Los bloques que el código calcula y la plantilla del prompt de sistema recibe.
export const SYSTEM_PLACEHOLDERS = [
  'GENRE_BRIEF',
  'DISCOVERY_BRIEF',
  'RESTRICTIONS_BRIEF',
  'TECHNICAL_BRIEF'
];
export const DESCRIPTION_PLACEHOLDER = 'DESCRIPTION';

// Topes por campo: un paquete no necesita más y uno hostil no debe poder inflar la memoria.
const LIMITS = {
  short: 300,
  tag: 40,
  tags: 12,
  rules: 2000,
  notes: 2000,
  prompt: 4000,
  systemTemplate: 60000,
  descriptionTemplate: 500,
  categories: 50,
  promptsPerCategory: 200,
  soundsPerGenre: 200
};

// Los avisos de `validatePrompt` que también invalidan el paquete. El resto de avisos no:
// en concreto, el marcador de identidad sin resolver es justo cómo se publica un prompt
// reutilizable (Artículo VII: la identidad temática es del proyecto, no del catálogo).
const BLOCKING_WARNINGS = ['few_components', 'missing_technical'];

const isBlocking = (problem) =>
  problem.level === 'error' || BLOCKING_WARNINGS.includes(problem.code);

const TECHNICAL_KEYS = TECHNICAL_PROFILES.map(p => p.key);
const SOURCE_GROUP_KEYS = SOURCE_GROUPS.map(g => g.key);
const BUILD_TYPE_KEYS = BUILD_TYPES.map(b => b.key);
const GENRE_KEYS = Object.keys(gameProfiles);

// --- Utilidades de validación ---

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const isString = (v, max) => typeof v === 'string' && v.length <= max;

const countOccurrences = (text, token) => text.split(token).length - 1;

// Duración de un prompt, tal como está escrita: la que lo abre («0.2 seconds. …») o, en una cama o
// un ambiente, que abren con la escena (03 §12), la que aparezca después.
const durationIn = (text, isBed) =>
  String(text).match(/^\s*(\d+(?:\.\d+)?)\s+seconds?/i)?.[1]
  || (isBed ? String(text).match(/(?<![\d.])(\d+(?:\.\d+)?)\s+seconds?\b/i)?.[1] : '')
  || '';

// `validatePrompt` compara la duración del texto con la del asset como CADENAS. Aquí lo que
// importa es que digan lo mismo, no cómo se escribe: «60» y «60.0» son la misma duración.
// Si coinciden numéricamente se le pasa la forma del texto; si no, la declarada, y es
// `validatePrompt` quien señala la diferencia.
const alignDuration = (declared, text, isBed) => {
  const lead = durationIn(text, isBed);
  return lead && parseFloat(lead) === parseFloat(declared) ? lead : String(declared ?? '');
};

const isRealDate = (text) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(text);
};

const fail = (reason, details = []) => ({ ok: false, reason, details: details.slice(0, 20) });

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

// --- Marcadores de las plantillas ---

const checkTemplate = (label, text, required, maxLength, errors) => {
  if (!isString(text, maxLength) || !text.trim()) {
    errors.push(`${label}: falta o es demasiado largo.`);
    return;
  }
  for (const key of required) {
    const n = countOccurrences(text, `{{${key}}}`);
    if (n !== 1) errors.push(`${label}: el marcador {{${key}}} debe aparecer una vez y aparece ${n}.`);
  }
  const stray = (text.match(/\{\{[^}]*\}\}/g) || [])
    .filter(token => !required.some(key => token === `{{${key}}}`));
  if (stray.length) errors.push(`${label}: marcadores que no existen (${stray.slice(0, 3).join(', ')}).`);
};

// --- Catálogo ---

const readCatalog = (raw, errors) => {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push('catálogo: vacío o no es una lista.');
    return [];
  }
  if (raw.length > LIMITS.categories) errors.push('catálogo: demasiadas categorías.');

  return raw.slice(0, LIMITS.categories).map((cat, i) => {
    const where = `catálogo[${i}]`;
    if (!isPlainObject(cat)) {
      errors.push(`${where}: no es un objeto.`);
      return null;
    }
    if (!isString(cat.categoria, LIMITS.short) || !cat.categoria.trim()) errors.push(`${where}: falta el nombre de la categoría.`);
    if (!isString(cat.template, LIMITS.tag) || !cat.template.trim()) errors.push(`${where}: falta la plantilla.`);
    if (!TECHNICAL_KEYS.includes(cat.profile)) errors.push(`${where}: perfil técnico desconocido.`);
    if (!isString(cat.reglas, LIMITS.rules)) errors.push(`${where}: las reglas faltan o son demasiado largas.`);

    const prompts = Array.isArray(cat.prompts) ? cat.prompts : [];
    if (prompts.length === 0) errors.push(`${where} (${cat.categoria}): no tiene ningún prompt.`);
    if (prompts.length > LIMITS.promptsPerCategory) errors.push(`${where}: demasiados prompts.`);

    return {
      categoria: cat.categoria,
      template: cat.template,
      profile: cat.profile,
      reglas: cat.reglas,
      prompts: prompts.slice(0, LIMITS.promptsPerCategory).map((p, j) => readCatalogPrompt(p, cat, `${where}.prompts[${j}]`, errors))
    };
  });
};

const readCatalogPrompt = (p, cat, where, errors) => {
  if (!isPlainObject(p)) {
    errors.push(`${where}: no es un objeto.`);
    return null;
  }
  const label = isString(p.nombre, LIMITS.short) ? p.nombre : where;

  if (!isString(p.nombre, LIMITS.short) || !p.nombre.trim()) errors.push(`${where}: falta el nombre.`);
  if (!isString(p.texto, LIMITS.prompt) || !p.texto.trim()) errors.push(`${label}: el texto falta o es demasiado largo.`);
  if (!isString(p.duracion, 20)) errors.push(`${label}: falta la duración.`);
  if (!CATEGORY_KEYS.includes(p.categoria_prefijo)) errors.push(`${label}: prefijo de nomenclatura desconocido.`);
  const tags = Array.isArray(p.tags) ? p.tags : null;
  if (!tags || tags.length > LIMITS.tags || tags.some(t => !isString(t, LIMITS.tag))) errors.push(`${label}: etiquetas no válidas.`);

  // Un prompt de música o ambiente con tratamiento seco es el error explícito del sistema,
  // aunque el texto no diga «zero reverb»: el perfil de la categoría ya lo declara mal.
  if (['BGM', 'AMB'].includes(p.categoria_prefijo) && cat.profile !== 'musical') {
    errors.push(`${label}: una BGM o un ambiente debe llevar el perfil musical.`);
  }

  if (typeof p.texto === 'string' && CATEGORY_KEYS.includes(p.categoria_prefijo) && TECHNICAL_KEYS.includes(cat.profile)) {
    // Se comprueba como un asset: la etiqueta de duración es la del sonido, y el texto
    // tiene que decir lo mismo.
    const asset = {
      category: p.categoria_prefijo,
      technical_profile: cat.profile,
      duration_seconds: Number.isFinite(parseFloat(p.duracion)) ? alignDuration(parseFloat(p.duracion), p.texto, ['BGM', 'AMB'].includes(p.categoria_prefijo)) : '',
      loop: /seamless loop/i.test(p.texto)
    };
    for (const problem of validatePrompt(p.texto, asset, {}).filter(isBlocking)) {
      errors.push(`${label}: ${problem.message}`);
    }
  }

  return {
    nombre: p.nombre,
    texto: p.texto,
    duracion: p.duracion,
    tags: tags ? [...tags] : [],
    categoria_prefijo: p.categoria_prefijo
  };
};

// --- Listas base por género ---

const SOUND_FIELDS = [
  'id', 'official_filename', 'category', 'subtype', 'game_event', 'usage', 'objective',
  'duration_seconds', 'priority', 'loop', 'source_group', 'single_or_stems',
  'technical_profile', 'prompt', 'notes'
];

const readTemplates = (raw, errors) => {
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) {
    errors.push('listas base: faltan.');
    return {};
  }
  const out = {};

  for (const genre of Object.keys(raw)) {
    if (!GENRE_KEYS.includes(genre)) {
      errors.push(`listas base: el género «${genre.slice(0, 40)}» no existe.`);
      continue;
    }
    const list = raw[genre];
    if (!Array.isArray(list) || list.length === 0 || list.length > LIMITS.soundsPerGenre) {
      errors.push(`listas base ${genre}: vacía, no es una lista o es demasiado larga.`);
      continue;
    }
    out[genre] = list.map((s, i) => readTemplateSound(s, i, genre, errors));
  }
  return out;
};

const readTemplateSound = (s, index, genre, errors) => {
  const where = `lista ${genre}[${index}]`;
  if (!isPlainObject(s)) {
    errors.push(`${where}: no es un objeto.`);
    return null;
  }
  const label = isString(s.official_filename, LIMITS.short) ? `${genre} ${s.official_filename}` : where;

  const sound = {};
  for (const field of SOUND_FIELDS) sound[field] = s[field];

  // Los identificadores son continuos y empiezan en 001: uno descartado nunca se reutiliza.
  if (sound.id !== String(index + 1).padStart(3, '0')) errors.push(`${label}: el identificador debe ser ${String(index + 1).padStart(3, '0')}.`);
  if (!CATEGORY_KEYS.includes(sound.category)) errors.push(`${label}: categoría desconocida.`);
  if (!isString(sound.official_filename, LIMITS.short)) {
    errors.push(`${where}: falta el nombre oficial.`);
  } else {
    for (const problem of validateFilename(sound.official_filename, sound.category)) errors.push(`${label}: ${problem}`);
  }
  for (const field of ['subtype', 'game_event', 'usage', 'objective', 'notes']) {
    if (!isString(sound[field], LIMITS.short * 3)) errors.push(`${label}: «${field}» falta o es demasiado largo.`);
  }
  if (!PRIORITIES.includes(sound.priority)) errors.push(`${label}: prioridad desconocida.`);
  if (typeof sound.loop !== 'boolean') errors.push(`${label}: «loop» debe ser verdadero o falso.`);
  if (!SOURCE_GROUP_KEYS.includes(sound.source_group)) errors.push(`${label}: grupo de origen desconocido.`);
  if (!BUILD_TYPE_KEYS.includes(sound.single_or_stems)) errors.push(`${label}: tipo de construcción desconocido.`);
  if (!TECHNICAL_KEYS.includes(sound.technical_profile)) errors.push(`${label}: perfil técnico desconocido.`);
  if (!isString(sound.duration_seconds, 10) || !Number.isFinite(parseFloat(sound.duration_seconds))) errors.push(`${label}: duración no válida.`);
  if (!isString(sound.prompt, LIMITS.prompt) || !sound.prompt.trim()) {
    errors.push(`${label}: el prompt falta o es demasiado largo.`);
  } else {
    const asset = { ...sound, duration_seconds: alignDuration(sound.duration_seconds, sound.prompt, ['BGM', 'AMB'].includes(sound.category)) };
    for (const problem of validatePrompt(sound.prompt, asset, {}).filter(isBlocking)) {
      errors.push(`${label}: ${problem.message}`);
    }
  }
  return sound;
};

// --- Validación ---

/**
 * Valida un paquete ya convertido de JSON. Devuelve `{ ok: true, pkg }` con una copia
 * reconstruida e inmutable, o `{ ok: false, reason, details }`.
 *
 * `reason`: 'bad_shape' · 'needs_newer_app' · 'unsupported_response_format' · 'invalid_content'.
 */
export const validatePackage = (raw) => {
  if (!isPlainObject(raw)) return fail('bad_shape', ['El paquete no es un objeto.']);

  // Primero, ¿es algo que esta copia entiende? Un paquete más nuevo puede traer una forma
  // que no se sabe leer: no se mira su contenido.
  if (!Number.isInteger(raw.formatVersion) || !Number.isInteger(raw.appLevel) || !Number.isInteger(raw.responseFormat)) {
    return fail('bad_shape', ['Faltan los números de compatibilidad.']);
  }
  if (raw.formatVersion > PACKAGE_FORMAT || raw.appLevel > APP_LEVEL) {
    return fail('needs_newer_app', [`Exige el nivel ${raw.appLevel} de la herramienta; esta copia es la ${APP_LEVEL}.`]);
  }
  if (raw.formatVersion !== PACKAGE_FORMAT) return fail('bad_shape', ['Formato de paquete desconocido.']);
  if (!SUPPORTED_RESPONSE_FORMATS.includes(raw.responseFormat)) {
    return fail('unsupported_response_format', [`Pide el formato de respuesta ${raw.responseFormat}, que esta copia no sabe leer.`]);
  }

  const errors = [];

  if (!isString(raw.version, 40) || !/^[0-9A-Za-z._-]+$/.test(raw.version)) errors.push('versión: falta o no es válida.');
  if (!isString(raw.publishedAt, 10) || !isRealDate(raw.publishedAt)) errors.push('fecha de publicación: debe ser AAAA-MM-DD.');
  if (!isString(raw.notes, LIMITS.notes)) errors.push('notas: faltan o son demasiado largas.');

  const catalog = readCatalog(raw.catalog, errors);
  const templates = readTemplates(raw.templates, errors);

  const analysis = isPlainObject(raw.analysis) ? raw.analysis : {};
  checkTemplate('instrucciones del análisis', analysis.systemTemplate, SYSTEM_PLACEHOLDERS, LIMITS.systemTemplate, errors);
  checkTemplate('mensaje de la descripción', analysis.descriptionTemplate, [DESCRIPTION_PLACEHOLDER], LIMITS.descriptionTemplate, errors);

  if (errors.length) return fail('invalid_content', errors);

  return {
    ok: true,
    pkg: deepFreeze({
      formatVersion: raw.formatVersion,
      version: raw.version,
      publishedAt: raw.publishedAt,
      appLevel: raw.appLevel,
      responseFormat: raw.responseFormat,
      notes: raw.notes,
      catalog,
      templates,
      analysis: {
        systemTemplate: analysis.systemTemplate,
        descriptionTemplate: analysis.descriptionTemplate
      }
    })
  };
};

/**
 * Lo mismo, partiendo del texto recibido: antes de interpretarlo comprueba el tamaño, porque
 * un archivo enorme no debe llegar a `JSON.parse`.
 */
export const parsePackage = (text) => {
  if (typeof text !== 'string') return fail('bad_shape', ['La respuesta no es texto.']);
  if (new TextEncoder().encode(text).length > MAX_PACKAGE_BYTES) {
    return fail('too_big', [`Pasa de ${MAX_PACKAGE_BYTES / 1024 / 1024} MB.`]);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('not_json', ['No es un JSON válido.']);
  }
  return validatePackage(parsed);
};

// --- Uso del paquete ---

// El catálogo como una lista plana de prompts, cada uno con los datos de su categoría.
export const flattenCatalog = (pkg) =>
  pkg.catalog.flatMap(({ categoria, reglas, template, profile, prompts }) =>
    prompts.map(prompt => ({ ...prompt, categoria, reglas, template, profile }))
  );

// Rellena la plantilla del prompt de sistema con los bloques que calcula el código.
// Una sola pasada y con FUNCIÓN: un `$&` dentro de un bloque no se interpreta como patrón
// de sustitución, y un bloque que contuviera otro marcador no se vuelve a sustituir.
export const fillSystemTemplate = (template, briefs) =>
  template.replace(/\{\{(\w+)\}\}/g, (token, key) =>
    SYSTEM_PLACEHOLDERS.includes(key) ? (briefs[key] ?? '') : token
  );

export const fillDescriptionTemplate = (template, description) =>
  template.replace(`{{${DESCRIPTION_PLACEHOLDER}}}`, () => description);
