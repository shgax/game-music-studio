// Estructura del informe de análisis visual.
//
// Implementa specs/reference/templates/VISUAL_ANALYSIS.md, sus cinco secciones
// completas. El informe lo rellena la IA y lo corrige el director de audio:
// es un documento de trabajo, no una salida de solo lectura.

export const ANALYSIS_SECTIONS = [
  {
    key: 'gameAnalysis',
    number: 1,
    title: 'Identificación',
    desc: 'Qué juego es, en una lectura.',
    fields: [
      { key: 'name', label: 'Nombre' },
      { key: 'type', label: 'Tipo de juego' },
      { key: 'theme', label: 'Tema' },
      { key: 'scenario', label: 'Escenario' },
      { key: 'visualStyle', label: 'Estilo visual' },
      { key: 'energy', label: 'Energía' },
      { key: 'feeling', label: 'Sensación' },
      { key: 'narrative', label: 'Tono narrativo', multiline: true }
    ]
  },
  {
    key: 'context',
    number: 2,
    title: 'Contexto',
    desc: 'Qué hay en pantalla que pueda o deba sonar.',
    fields: [
      { key: 'mainCharacter', label: 'Personajes' },
      { key: 'animals', label: 'Criaturas' },
      { key: 'symbols', label: 'Símbolos' },
      { key: 'objects', label: 'Objetos' },
      { key: 'background', label: 'Fondo' },
      { key: 'elementsToSound', label: 'Elementos animables', multiline: true },
      { key: 'materials', label: 'Materiales' },
      { key: 'magicElements', label: 'Elementos mágicos' },
      { key: 'mechanicalElements', label: 'Elementos mecánicos' },
      { key: 'naturalElements', label: 'Elementos naturales' },
      { key: 'techElements', label: 'Elementos tecnológicos' },
      { key: 'colors', label: 'Colores' },
      { key: 'interface', label: 'Interfaz' },
      { key: 'modes', label: 'Modos' },
      { key: 'moments', label: 'Momentos probables', multiline: true }
    ]
  },
  {
    key: 'soundDetails',
    number: 3,
    title: 'Traducción sonora',
    desc: 'Lo que se ve, convertido en decisiones de audio.',
    fields: [
      { key: 'materials', label: 'Materiales principales' },
      { key: 'ui', label: 'UI' },
      { key: 'sfx', label: 'FX' },
      { key: 'loops', label: 'Loops' },
      { key: 'bgm', label: 'BGM' },
      { key: 'stingers', label: 'Stingers' },
      { key: 'bigWins', label: 'Premios', multiline: true },
      { key: 'layers', label: 'Capas', multiline: true, hint: 'Qué eventos necesitan stems' },
      { key: 'exclusions', label: 'Sonidos prohibidos', multiline: true, danger: true },
      { key: 'restrictions', label: 'Restricciones', multiline: true }
    ]
  },
  {
    key: 'identity',
    number: 4,
    title: 'Identidad sonora',
    desc: 'La regla que hace que todo suene al mismo juego.',
    fields: [
      { key: 'summary', label: 'Identidad sonora', multiline: true },
      { key: 'palette', label: 'Paleta principal', multiline: true },
      { key: 'rules', label: 'Reglas específicas', multiline: true },
      {
        key: 'themeTag',
        label: 'Etiqueta temática (inglés)',
        hint: 'Se inserta literalmente en cada prompt. Corta y en inglés: "jungle temple theme"'
      }
    ]
  }
];

// Sección 5. Los cuatro niveles de certeza de VISUAL_ANALYSIS.md §5.
export const DOUBT_LEVELS = [
  { key: 'confirmed', label: 'Confirmado', desc: 'Visible sin ambigüedad en las imágenes.', tone: 'ok' },
  { key: 'probable', label: 'Probable', desc: 'Deducido con alta confianza, pero no explícito.', tone: 'warn' },
  { key: 'notVisible', label: 'No visible', desc: 'No aparece en el material recibido.', tone: 'muted' },
  { key: 'needsValidation', label: 'Requiere validación', desc: 'Debe confirmarlo el cliente o el diseñador.', tone: 'danger' }
];

// Informe vacío con todas las claves presentes, para que la edición no dependa
// de que la IA haya devuelto cada campo.
export const emptyAnalysis = () => {
  const analysis = {};
  for (const section of ANALYSIS_SECTIONS) {
    analysis[section.key] = Object.fromEntries(section.fields.map(f => [f.key, '']));
  }
  analysis.doubts = Object.fromEntries(DOUBT_LEVELS.map(l => [l.key, []]));
  analysis.openQuestions = [];
  return analysis;
};

// Combina lo que devolvió la IA con la estructura completa.
export const normalizeAnalysis = (raw = {}) => {
  const base = emptyAnalysis();

  for (const section of ANALYSIS_SECTIONS) {
    const incoming = raw[section.key] || {};
    for (const field of section.fields) {
      if (incoming[field.key]) base[section.key][field.key] = incoming[field.key];
    }
  }

  // La IA puede devolver las dudas ya clasificadas o como lista plana. Una lista
  // plana sin clasificar es, por definición, algo que requiere validación.
  if (raw.doubts && typeof raw.doubts === 'object' && !Array.isArray(raw.doubts)) {
    for (const level of DOUBT_LEVELS) {
      const v = raw.doubts[level.key];
      if (Array.isArray(v)) base.doubts[level.key] = v.filter(Boolean);
    }
  }
  if (Array.isArray(raw.openQuestions) && raw.openQuestions.length) {
    base.doubts.needsValidation = [
      ...base.doubts.needsValidation,
      ...raw.openQuestions.filter(Boolean)
    ];
  }

  // Con qué versión del paquete de prompts se hizo el análisis (feature 011). Opcional: los
  // informes anteriores no la tienen y siguen siendo válidos.
  if (typeof raw.promptsVersion === 'string' && raw.promptsVersion) {
    base.promptsVersion = raw.promptsVersion;
  }

  return base;
};

// Cuenta cuántas dudas hay sin resolver, para avisar sin abrir el informe.
export const countDoubts = (analysis) => {
  const d = analysis?.doubts || {};
  return DOUBT_LEVELS.reduce((n, l) => n + (d[l.key]?.length || 0), 0);
};


// --- Identidad temática en los prompts ---
//
// El componente [identidad temática] de la fórmula (Artículo VII) es propio de
// cada proyecto: es lo que hace que todos los sonidos suenen al mismo juego.
// Por eso los prompts reutilizables llevan el marcador THEME_PLACEHOLDER en vez
// de un tema fijo, y se resuelve al insertarlos en un proyecto concreto.

export const THEME_PLACEHOLDER = '[THEME]';

// Etiqueta neutra para proyectos que aún no han definido su identidad.
export const NEUTRAL_THEME = 'neutral game theme';

export const resolveThemeTag = (project) => {
  const tag = project?.analysis?.identity?.themeTag;
  return typeof tag === 'string' && tag.trim() ? tag.trim() : null;
};

// Sustituye el marcador por la identidad del proyecto. Sin identidad definida
// usa la neutra, pero quien llama debería avisar de que falta.
export const applyTheme = (text = '', themeTag) => {
  const tag = themeTag && themeTag.trim() ? themeTag.trim() : NEUTRAL_THEME;
  // Se normaliza para no acabar con "jungle temple theme theme."
  const clean = /\btheme\b\s*$/i.test(tag) ? tag : `${tag} theme`;
  return text.split(THEME_PLACEHOLDER).join(clean);
};

export const hasThemePlaceholder = (text = '') => text.includes(THEME_PLACEHOLDER);
