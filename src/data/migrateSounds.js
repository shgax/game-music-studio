// Migración del modelo antiguo (un solo campo `status`) al modelo del Audio
// Production System (seis ejes de estado independientes).
//
// El modelo viejo colapsaba seis dimensiones en una: 'Mezclado' decía algo del
// eje de mezcla pero nada de la entrega, y 'Cargado' no distinguía entre
// exportado, entregado e integrado en el juego. La migración reconstruye los
// seis ejes con el estado más conservador que sea consistente con el valor
// antiguo: nunca inventa un avance que no se pueda deducir (Principio 6).

import { createSound, defaultProfileForCategory } from './soundModel.js';
import { normalizeAnalysis } from './analysisModel.js';

// Cada estado viejo implica un punto del recorrido. Lo que no se puede deducir
// se deja en su valor inicial.
const STATUS_MAP = {
  'Pendiente': {
    planning_status: 'pending_validation',
    prompt_status: 'not_created',
    production_status: 'not_generated',
    review_status: 'not_reviewed',
    mix_status: 'not_required',
    delivery_status: 'not_delivered'
  },
  'Prompt creado': {
    planning_status: 'approved_for_production',
    prompt_status: 'created',
    production_status: 'not_generated',
    review_status: 'not_reviewed',
    mix_status: 'not_required',
    delivery_status: 'not_delivered'
  },
  'Generado': {
    planning_status: 'approved_for_production',
    prompt_status: 'created',
    production_status: 'generated',
    review_status: 'not_reviewed',
    mix_status: 'not_required',
    delivery_status: 'not_delivered'
  },
  'Rehacer': {
    planning_status: 'approved_for_production',
    prompt_status: 'needs_revision',
    production_status: 'regenerate',
    review_status: 'changes_requested',
    mix_status: 'not_required',
    delivery_status: 'not_delivered'
  },
  'Por capas': {
    planning_status: 'approved_for_production',
    prompt_status: 'created',
    production_status: 'layered',
    review_status: 'in_review',
    mix_status: 'pending',
    delivery_status: 'not_delivered'
  },
  'Mezclado': {
    planning_status: 'approved_for_production',
    prompt_status: 'created',
    production_status: 'generated',
    review_status: 'in_review',
    mix_status: 'mixed',
    delivery_status: 'not_delivered'
  },
  'Aprobado': {
    planning_status: 'approved_for_production',
    prompt_status: 'approved',
    production_status: 'generated',
    review_status: 'approved',
    mix_status: 'approved',
    delivery_status: 'not_delivered'
  },
  // 'Cargado' en el modelo viejo se marcaba al subir el WAV a Drive, que en el
  // sistema es `exported`, no `loaded`: cargado significa integrado en el juego.
  'Cargado': {
    planning_status: 'approved_for_production',
    prompt_status: 'approved',
    production_status: 'generated',
    review_status: 'approved',
    mix_status: 'approved',
    delivery_status: 'exported'
  }
};

// Los tipos viejos (5) se reparten entre las nueve categorías oficiales.
// FX es ambiguo: se resuelve mirando la clave de evento y el nombre.
const TYPE_MAP = {
  'UI': 'UI',
  'BGM': 'BGM',
  'Stinger': 'STG',
  'Ambiente': 'AMB'
};

// Señales para desambiguar los antiguos 'FX'.
const MECHANIC_HINTS = /reel|spin|wheel|ball_roll|ball_drop|shuffle|deal|card|chip|countdown|launch|engine|multiplier|crash|rocket|tension|drop|bounce|roll/i;
const SYMBOL_HINTS = /wild|scatter|symbol|monkey|animal|character|mascot|creature|reveal/i;

const inferCategory = (sound) => {
  const explicitPrefix = String(sound.eventKey || '').match(/^(UI|MEC|SYM|STG|FX|BGM|AMB|VO|MIX)_/);
  if (explicitPrefix && explicitPrefix[1] !== 'SFX') return explicitPrefix[1];

  const mapped = TYPE_MAP[sound.type];
  if (mapped) return mapped;

  // Antiguo 'FX': repartir entre MEC, SYM y FX según la semántica del evento.
  const haystack = `${sound.eventKey || ''} ${sound.filename || ''} ${sound.moment || ''}`;
  if (SYMBOL_HINTS.test(haystack)) return 'SYM';
  if (MECHANIC_HINTS.test(haystack)) return 'MEC';
  return 'FX';
};

const PRIORITY_MAP = { 'Alta': 'high', 'Media': 'medium', 'Baja': 'low' };

// Deriva el nombre oficial con prefijo a partir del nombre antiguo, que solía
// venir como sfx_algo.wav / bgm_algo.wav / ui_algo.wav.
const inferOfficialFilename = (sound, category) => {
  if (sound.official_filename) return sound.official_filename;

  const base = String(sound.filename || '')
    .replace(/\.wav$/i, '')
    .replace(/^(sfx|bgm|ui|stg|amb|mec|sym|fx|vo|mix)[_-]/i, '');

  if (!base) return '';
  return `${category}_${base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}.wav`;
};

// Reparto por defecto de Core/Shared/Skin según categoría, como punto de
// partida revisable. UI genérica es Core; símbolos y música son del proyecto.
const inferSourceGroup = (category) => {
  if (category === 'UI') return 'core_global';
  if (category === 'MEC') return 'shared_themed_core';
  return 'project_skin';
};

// Un asset con contador numérico de versión pero sin lista viene del modelo
// anterior: se reconstruye la lista con esa cantidad, aprobando la última.
export const migrateVersions = (sound) => {
  if (Array.isArray(sound.versions)) return sound;
  const n = Number(sound.version) || 0;
  if (n <= 0) return { ...sound, versions: [] };

  const versions = Array.from({ length: n }, (_, i) => ({
    label: `v${String(i + 1).padStart(2, '0')}`,
    status: i === n - 1 ? 'approved' : 'discarded',
    notes: ''
  }));
  // Se descarta el contador plano: la lista lo sustituye.
  const rest = { ...sound };
  delete rest.version;
  return { ...rest, versions };
};

const isLegacySound = (sound) =>
  'status' in sound || 'reuseMod' in sound || 'eventKey' in sound || 'driveLink' in sound;

// Artículo XII: un solo nombre por concepto. Cuando un nombre oficial cambia, el
// viejo se apunta aquí y el asset guardado se corrige al cargarlo.
//
// Es idempotente porque solo el nombre VIEJO es clave del mapa: un asset ya
// renombrado no encuentra entrada y sale intacto.
const RENAMED_FILENAMES = {
  // Contaba equipos —round of 16— mientras sus cuatro hermanos nombran la ronda.
  // El salto hacía buscar un 'round8' inexistente; ahora la serie de fracciones
  // está completa: eighth, quarter, semi, final.
  'STG_phase_round16.wav': 'STG_phase_eighth.wav'
};

const applyRenames = (sound) => {
  const renamed = RENAMED_FILENAMES[sound?.official_filename];
  if (!renamed) return sound;

  const before = sound.official_filename.replace(/\.wav$/i, '');
  const after = renamed.replace(/\.wav$/i, '');
  const migrated = { ...sound, official_filename: renamed };

  // Los stems heredan el nombre del asset: '<base>__<capa>_v01.wav'.
  if (Array.isArray(sound.layers)) {
    migrated.layers = sound.layers.map(layer =>
      typeof layer?.file === 'string' && layer.file.startsWith(`${before}__`)
        ? { ...layer, file: after + layer.file.slice(before.length) }
        : layer);
  }
  return migrated;
};

// El audio generado es un borrador en memoria, no un dato del proyecto. Las
// versiones anteriores lo guardaban dentro del asset: el Blob se serializaba como
// '{}' y la dirección 'blob:' dejaba de existir al recargar, así que tabla y
// tablero intentaban reproducir algo que ya no estaba.
//
// Es idempotente: si los campos no están, el asset sale intacto.
const dropDraftAudio = (sound) => {
  if (!sound || !('audioBlob' in sound || 'localBlobUrl' in sound)) return sound;
  const clean = { ...sound };
  delete clean.audioBlob;
  delete clean.localBlobUrl;
  return clean;
};

export const migrateSound = (legacy) => {
  if (!isLegacySound(legacy)) return dropDraftAudio(applyRenames(migrateVersions(legacy)));

  const category = inferCategory(legacy);
  const axes = STATUS_MAP[legacy.status] || STATUS_MAP['Pendiente'];

  return applyRenames(createSound(legacy.id, {
    official_filename: inferOfficialFilename(legacy, category),
    category,
    subtype: '',
    game_event: legacy.eventKey || '',
    usage: legacy.moment || '',
    objective: legacy.target || '',
    duration_seconds: legacy.duration || '',
    priority: PRIORITY_MAP[legacy.priority] || 'medium',
    loop: Boolean(legacy.loop),
    source_group: inferSourceGroup(category),
    single_or_stems: legacy.status === 'Por capas' ? 'stems' : 'single',
    technical_profile: defaultProfileForCategory(category),

    ...axes,

    versions: [],
    variant_count: 0,
    stem_count: 0,

    prompt: legacy.prompt || '',
    // 'modulation' (antes 'reuseMod') no tiene campo propio en el sistema:
    // su contenido son directrices de reuso, que pertenecen a observaciones.
    notes: [legacy.notes, legacy.modulation || legacy.reuseMod]
      .filter(v => v && v !== '—')
      .join(' · '),
    audioSource: legacy.audioSource || legacy.driveLink || ''
  }));
};

export const migrateProject = (project) => {
  if (!project || !Array.isArray(project.sounds)) return project;

  return {
    ...project,
    // El informe se normaliza a la plantilla completa: los proyectos guardados
    // antes traían solo cuatro bloques y las dudas como lista plana.
    analysis: project.analysis ? normalizeAnalysis(project.analysis) : null,
    // Configuración de proyecto del sistema (templates/PROJECT_CONFIG.md).
    config: project.config || {
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
        forbidden_audio_traits: [],
        forbidden_visual_themes: [],
        mandatory_prompt_phrases: [],
        forbidden_prompt_phrases: []
      }
    },
    sounds: project.sounds.map(migrateSound)
  };
};

export const migrateDatabase = (db) =>
  Array.isArray(db) ? db.map(migrateProject) : db;
