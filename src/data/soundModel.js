// Modelo de datos de un asset de audio.
//
// Implementa specs/reference/05_DATA_MODEL_AND_STATUSES.md y
// specs/reference/02_NAMING_AND_VERSIONING.md.
//
// La regla central (Artículo V de la constitución): un asset NO tiene un estado,
// tiene SEIS que avanzan por separado. Un sonido puede estar mezclado pero no
// entregado, o generado con el prompt pendiente de revisión. Colapsarlos en un
// campo único destruye esa información.

// --- Categorías y prefijos oficiales (02_NAMING_AND_VERSIONING §1) ---

export const CATEGORIES = [
  { prefix: 'UI_', key: 'UI', label: 'Interfaz' },
  { prefix: 'MEC_', key: 'MEC', label: 'Mecánicas' },
  { prefix: 'SYM_', key: 'SYM', label: 'Símbolos y personajes' },
  { prefix: 'STG_', key: 'STG', label: 'Stingers' },
  { prefix: 'FX_', key: 'FX', label: 'Efectos especiales' },
  { prefix: 'BGM_', key: 'BGM', label: 'Música' },
  { prefix: 'AMB_', key: 'AMB', label: 'Ambientes' },
  { prefix: 'VO_', key: 'VO', label: 'Voz autorizada' },
  { prefix: 'MIX_', key: 'MIX', label: 'Mezclas finales internas' }
];

export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

// --- Los seis ejes de estado (05_DATA_MODEL_AND_STATUSES §2) ---

export const STATUS_AXES = [
  {
    field: 'planning_status',
    label: 'Planificación',
    short: 'Plan',
    values: ['detected', 'pending_validation', 'approved_for_production', 'rejected'],
    labels: {
      detected: 'Detectado',
      pending_validation: 'Pendiente de validar',
      approved_for_production: 'Aprobado para producción',
      rejected: 'Rechazado'
    },
    colors: {
      detected: '#9ca3af',
      pending_validation: '#eab308',
      approved_for_production: '#4ade80',
      rejected: '#ef4444'
    }
  },
  {
    field: 'prompt_status',
    label: 'Prompt',
    short: 'Prompt',
    values: ['not_created', 'draft', 'created', 'approved', 'needs_revision'],
    labels: {
      not_created: 'Sin crear',
      draft: 'Borrador',
      created: 'Creado',
      approved: 'Aprobado',
      needs_revision: 'Necesita revisión'
    },
    colors: {
      not_created: '#9ca3af',
      draft: '#eab308',
      created: '#bd00ff',
      approved: '#4ade80',
      needs_revision: '#ef4444'
    }
  },
  {
    field: 'production_status',
    label: 'Producción',
    short: 'Prod',
    values: ['not_generated', 'generated', 'regenerate', 'layered', 'variants_created'],
    labels: {
      not_generated: 'Sin generar',
      generated: 'Generado',
      regenerate: 'Regenerar',
      layered: 'Por capas',
      variants_created: 'Variantes creadas'
    },
    colors: {
      not_generated: '#9ca3af',
      generated: '#f5a623',
      regenerate: '#ef4444',
      layered: '#eab308',
      variants_created: '#00b8ff'
    }
  },
  {
    field: 'review_status',
    label: 'Revisión',
    short: 'Rev',
    values: ['not_reviewed', 'in_review', 'approved', 'changes_requested', 'discarded'],
    labels: {
      not_reviewed: 'Sin revisar',
      in_review: 'En revisión',
      approved: 'Aprobado',
      changes_requested: 'Cambios solicitados',
      discarded: 'Descartado'
    },
    colors: {
      not_reviewed: '#9ca3af',
      in_review: '#eab308',
      approved: '#4ade80',
      changes_requested: '#ef4444',
      discarded: '#6b7280'
    }
  },
  {
    field: 'mix_status',
    label: 'Mezcla',
    short: 'Mix',
    values: ['not_required', 'pending', 'in_progress', 'mixed', 'approved'],
    labels: {
      not_required: 'No requiere',
      pending: 'Pendiente',
      in_progress: 'En progreso',
      mixed: 'Mezclado',
      approved: 'Aprobado'
    },
    colors: {
      not_required: '#6b7280',
      pending: '#9ca3af',
      in_progress: '#eab308',
      mixed: '#00b8ff',
      approved: '#4ade80'
    }
  },
  {
    field: 'delivery_status',
    label: 'Entrega',
    short: 'Entrega',
    values: ['not_delivered', 'exported', 'delivered', 'loaded'],
    labels: {
      not_delivered: 'Sin entregar',
      exported: 'Exportado',
      delivered: 'Entregado',
      loaded: 'Cargado en el juego'
    },
    colors: {
      not_delivered: '#9ca3af',
      exported: '#eab308',
      delivered: '#00b8ff',
      loaded: '#00ffcc'
    }
  }
];

export const getAxis = (field) => STATUS_AXES.find(a => a.field === field);

// --- Origen del asset (00_SYSTEM_OVERVIEW §5) ---

export const SOURCE_GROUPS = [
  { key: 'core_global', label: 'Core Global', desc: 'Clicks, confirmaciones, errores, toggles y contadores genéricos reutilizables en cualquier proyecto.' },
  { key: 'shared_themed_core', label: 'Shared Themed Core', desc: 'Familia temática reutilizable: UI de madera, casino futurista, jungla, fantasía.' },
  { key: 'project_skin', label: 'Project Skin', desc: 'Exclusivo del proyecto: mascotas, WILD, SCATTER, bonus, BGM, stingers tematizados.' }
];

export const BUILD_TYPES = [
  { key: 'single', label: 'Single' },
  { key: 'stems', label: 'Stems' }
];

// --- Perfiles técnicos de mezcla (01_GLOBAL_AUDIO_RULES §8) ---
// No existe tratamiento universal: aplicar zero reverb a una BGM es un error
// explícito del sistema (03_PROMPT_ENGINEERING §9).

export const TECHNICAL_PROFILES = [
  {
    key: 'dry',
    label: 'Seco',
    chain: 'clean, isolated, completely dry, zero reverb',
    usage: 'SFX y stems'
  },
  {
    key: 'spatial',
    label: 'Espacial controlado',
    chain: 'clean game-ready mix, controlled spatial depth, short polished reverb, no muddy tail',
    usage: 'Stingers y premios'
  },
  {
    key: 'musical',
    label: 'Musical',
    chain: 'polished game-ready mix, balanced dynamics, controlled low end, clean stereo image, seamless loop',
    usage: 'BGM y ambientes'
  }
];

export const getTechnicalProfile = (key) =>
  TECHNICAL_PROFILES.find(p => p.key === key) || TECHNICAL_PROFILES[0];

// Perfil por defecto según la categoría del asset.
export const defaultProfileForCategory = (category) => {
  if (category === 'BGM' || category === 'AMB') return 'musical';
  if (category === 'STG') return 'spatial';
  return 'dry';
};

// --- Versiones (02_NAMING_AND_VERSIONING §4) ---
//
// El asset oficial NO lleva sufijo de versión: STG_mega_win.wav es el
// entregable. Las versiones son archivos de trabajo: STG_mega_win__v01.wav.
// Solo una puede estar aprobada a la vez: es la que se entrega.

export const VERSION_STATES = [
  { key: 'draft', label: 'En revisión', color: '#eab308' },
  { key: 'approved', label: 'Aprobada', color: '#4ade80' },
  { key: 'discarded', label: 'Descartada', color: '#6b7280' }
];

export const versionLabel = (n) => `v${String(n).padStart(2, '0')}`;

export const createVersion = (n, status = 'draft', notes = '') => ({
  label: versionLabel(n),
  status,
  notes
});

export const approvedVersion = (sound) =>
  (sound?.versions || []).find(v => v.status === 'approved') || null;

// Aprobar una versión descarta cualquier otra que lo estuviera: el entregable
// es uno solo.
export const approveVersion = (versions = [], label) =>
  versions.map(v => ({
    ...v,
    status: v.label === label ? 'approved' : (v.status === 'approved' ? 'discarded' : v.status)
  }));

export const nextVersion = (versions = []) => {
  const max = versions.reduce((n, v) => {
    const num = parseInt(String(v.label).replace(/\D/g, ''), 10);
    return isNaN(num) ? n : Math.max(n, num);
  }, 0);
  return createVersion(max + 1);
};

export const PRIORITIES = ['high', 'medium', 'low'];
export const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' };

export const COMPLEXITY_LEVELS = [
  { key: 'basic', label: 'Básico' },
  { key: 'standard', label: 'Estándar' },
  { key: 'advanced', label: 'Avanzado' }
];

// --- Fábrica de assets ---

export const createSound = (id, overrides = {}) => {
  const category = overrides.category || 'FX';

  return {
    id,
    official_filename: '',
    category,
    subtype: '',
    game_event: '',
    usage: '',
    objective: '',
    duration_seconds: '',
    priority: 'medium',
    loop: false,
    source_group: 'project_skin',
    single_or_stems: 'single',
    technical_profile: defaultProfileForCategory(category),

    // Los seis ejes, todos en su valor inicial. No se asume nada (Principio 6).
    planning_status: 'detected',
    prompt_status: 'not_created',
    production_status: 'not_generated',
    review_status: 'not_reviewed',
    mix_status: 'not_required',
    delivery_status: 'not_delivered',

    // Versiones de trabajo. El entregable es official_filename sin sufijo.
    versions: [],
    // Historial de revisiones. El Principio 10 exige registrar el feedback y
    // las decisiones de aprobación, no solo su resultado.
    reviews: [],
    variant_count: 0,
    stem_count: 0,

    prompt: '',
    notes: '',
    // Dónde vive el WAV masterizado: ruta local o URL. La app no almacena
    // binarios, solo registra la ubicación.
    audioSource: '',

    ...overrides
  };
};

// --- Conteos (00_SYSTEM_OVERVIEW §4) ---
// Un Mega Win puede ser 1 asset oficial, 4 stems, 3 versiones y 1 mezcla final.
// No son 9 sonidos del alcance. Por eso hay seis contadores, no uno.

// Un asset descartado sigue existiendo: su ID no se reutiliza y queda el
// registro de que se consideró. Pero no cuenta para el alcance, porque el
// alcance mide el trabajo vivo.
export const isDiscarded = (sound) =>
  sound?.planning_status === 'rejected' || sound?.review_status === 'discarded';

export const countAssets = (sounds = []) => {
  const official = sounds.filter(s => !isDiscarded(s));

  return {
    planned_asset_count: sounds.length,
    discarded_asset_count: sounds.length - official.length,
    official_asset_count: official.length,
    variant_count: sounds.reduce((n, s) => n + (Number(s.variant_count) || 0), 0),
    version_count: sounds.reduce((n, s) => n + (s.versions?.length || 0), 0),
    stem_count: sounds.reduce((n, s) => n + (Number(s.stem_count) || 0), 0),
    generated_file_count: sounds.filter(s =>
      ['generated', 'layered', 'variants_created'].includes(s.production_status)
    ).length,
    approved_asset_count: sounds.filter(s => s.review_status === 'approved').length,
    delivered_asset_count: sounds.filter(s =>
      ['delivered', 'loaded'].includes(s.delivery_status)
    ).length
  };
};

// --- Nomenclatura (02_NAMING_AND_VERSIONING) ---

export const officialFilename = (category, descriptiveName) => {
  const clean = String(descriptiveName || '')
    .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // sin acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${category}_${clean}.wav`;
};

export const versionedFilename = (official, version) =>
  official.replace(/\.wav$/, `__v${String(version).padStart(2, '0')}.wav`);

export const variantFilename = (official, n) =>
  official.replace(/\.wav$/, `__var${String(n).padStart(2, '0')}.wav`);

export const stemFilename = (official, layer, version = 1) =>
  official.replace(/\.wav$/, `__${layer}_v${String(version).padStart(2, '0')}.wav`);

// Sufijos prohibidos en un nombre oficial (02_NAMING_AND_VERSIONING §3).
const FORBIDDEN_NAME_TOKENS = ['final', 'new', 'good', 'approved'];

export const validateFilename = (filename, category) => {
  const problems = [];
  if (!filename) return ['Falta el nombre oficial.'];

  if (category && !filename.startsWith(`${category}_`)) {
    problems.push(`Debe empezar por el prefijo ${category}_ de su categoría.`);
  }
  if (!filename.endsWith('.wav')) {
    problems.push('Debe terminar en .wav');
  }
  if (/\s/.test(filename)) {
    problems.push('No puede contener espacios.');
  }
  if (/[^\x20-\x7E]/.test(filename)) {
    problems.push('No puede contener acentos ni caracteres especiales.');
  }
  if (/\d{4}[-_]?\d{2}[-_]?\d{2}/.test(filename)) {
    problems.push('El nombre oficial no lleva fechas.');
  }

  // La prohibición es sobre el SUFIJO, no sobre cualquier posición: el sistema
  // veta nombres como reel_stop_final, pero final_stop describe legítimamente
  // el último rodillo. Solo se comprueba el último segmento.
  const body = filename.replace(/\.wav$/, '').split('__')[0].toLowerCase();
  const segments = body.split('_');
  const lastSegment = segments[segments.length - 1];
  if (FORBIDDEN_NAME_TOKENS.includes(lastSegment)) {
    problems.push(`No se permite terminar el nombre en "${lastSegment}".`);
  }

  return problems;
};

// --- Saneamiento de datos externos ---
//
// Todo lo que llega de la IA o de un CSV pasa por aquí antes de entrar al
// modelo. `responseSchema` ya restringe la forma en Gemini, pero esto es la
// segunda línea de defensa: un valor fuera del modelo rompería los desplegables
// de la tabla y haría que un asset desapareciera de las columnas del tablero.

const pick = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

// Traduce las etiquetas en español que un CSV o un modelo despistado puede
// devolver, en vez de descartarlas.
const PRIORITY_ALIASES = { alta: 'high', media: 'medium', baja: 'low' };
const PROFILE_ALIASES = { seco: 'dry', espacial: 'spatial', musical: 'musical' };

export const sanitizeSound = (raw = {}, index = 0) => {
  const id = String(raw.id ?? '').trim() || String(index + 1).padStart(3, '0');

  const category = pick(
    String(raw.category ?? '').toUpperCase(),
    CATEGORY_KEYS,
    'FX'
  );

  const priorityRaw = String(raw.priority ?? '').toLowerCase();
  const priority = pick(PRIORITY_ALIASES[priorityRaw] || priorityRaw, PRIORITIES, 'medium');

  const profileRaw = String(raw.technical_profile ?? '').toLowerCase();
  const technical_profile = pick(
    PROFILE_ALIASES[profileRaw] || profileRaw,
    TECHNICAL_PROFILES.map(p => p.key),
    defaultProfileForCategory(category)
  );

  // Un nombre sin el prefijo de su categoría se corrige en vez de dejarse mal:
  // la nomenclatura es obligatoria (Artículo VI).
  let official_filename = String(raw.official_filename ?? '').trim();
  if (official_filename && !official_filename.startsWith(`${category}_`)) {
    const body = official_filename
      .replace(/\.wav$/i, '')
      .replace(/^(UI|MEC|SYM|STG|FX|BGM|AMB|VO|MIX|SFX)[_-]/i, '');
    official_filename = officialFilename(category, body);
  }

  return createSound(id, {
    official_filename,
    category,
    subtype: String(raw.subtype ?? ''),
    game_event: String(raw.game_event ?? ''),
    usage: String(raw.usage ?? ''),
    objective: String(raw.objective ?? ''),
    duration_seconds: String(raw.duration_seconds ?? ''),
    priority,
    loop: raw.loop === true || raw.loop === 'true' || raw.loop === 'Sí',
    source_group: pick(raw.source_group, SOURCE_GROUPS.map(g => g.key), 'project_skin'),
    single_or_stems: pick(raw.single_or_stems, BUILD_TYPES.map(b => b.key), 'single'),
    technical_profile,

    // Cuántas capas y cuántas variantes describen cómo se construye el asset,
    // igual que single_or_stems. Copiar "va por capas" y tirar "son tres" deja
    // dos de los seis conteos (§4) marcando cero para siempre.
    // No son estados: nada aquí da por generado ni por entregado nada.
    stem_count: Math.max(0, Math.trunc(Number(raw.stem_count) || 0)),
    variant_count: Math.max(0, Math.trunc(Number(raw.variant_count) || 0)),

    prompt: String(raw.prompt ?? ''),
    notes: String(raw.notes ?? ''),

    // Dónde vive el máster. Tirarlo al importar obligaría a volver a pegar cada
    // ubicación a mano, y es el dato de la Fase 7. Registrarlo no entrega nada:
    // los seis ejes siguen donde estaban (Principio 6).
    audioSource: String(raw.audioSource ?? '')
  });
};

// Los IDs deben ser únicos y continuos (Artículo VI). Un modelo puede repetirlos
// o saltárselos; aquí se renumeran conservando el orden propuesto.
export const sanitizeSoundList = (list = []) => {
  if (!Array.isArray(list)) return [];
  return list.map((raw, i) => ({
    ...sanitizeSound(raw, i),
    id: String(i + 1).padStart(3, '0')
  }));
};
