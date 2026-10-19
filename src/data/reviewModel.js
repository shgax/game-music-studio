// Ficha de revisión de un asset.
//
// Implementa specs/reference/templates/SOUND_REVIEW.md y el Principio 10 del
// sistema: "Registrar feedback y decisiones de aprobación".
//
// Hasta ahora la aplicación guardaba el resultado de una revisión (el eje
// review_status) pero no el porqué. Un rechazo sin motivo anotado obliga a
// repetir el análisis en la siguiente iteración, y suele repetir el error.

// Los nueve criterios de evaluación de la plantilla.
export const REVIEW_CRITERIA = [
  { key: 'function', label: 'Función', hint: '¿Comunica lo que tiene que comunicar en el juego?' },
  { key: 'timing', label: 'Timing', hint: '¿El ataque y la cola encajan con la animación?' },
  { key: 'clarity', label: 'Claridad', hint: '¿Se distingue con el resto de la mezcla sonando?' },
  { key: 'impact', label: 'Impacto', hint: '¿Tiene el peso que le corresponde a su nivel?' },
  { key: 'identity', label: 'Identidad temática', hint: '¿Suena a este juego y no a otro?' },
  { key: 'repeatability', label: 'Repetibilidad', hint: '¿Aguanta oírse cientos de veces por sesión?' },
  { key: 'balance', label: 'Balance', hint: '¿El nivel es correcto frente a los demás assets?' },
  { key: 'compatibility', label: 'Compatibilidad', hint: '¿Convive con lo que suena a la vez?' },
  { key: 'restrictions', label: 'Restricciones', hint: '¿Respeta la política de voz y los rasgos prohibidos?' }
];

export const CRITERION_RESULTS = [
  { key: 'pass', label: 'Correcto', tone: 'ok' },
  { key: 'fail', label: 'Falla', tone: 'error' },
  { key: 'na', label: 'No aplica', tone: 'muted' }
];

// Las seis decisiones de la plantilla. Cada una mueve los ejes que le
// corresponden: registrar la decisión sin actualizar el estado dejaría la ficha
// y la tabla contando cosas distintas.
export const REVIEW_DECISIONS = [
  {
    key: 'approved',
    label: 'Aprobado',
    desc: 'Cumple. Pasa a mezcla o a entrega.',
    tone: 'ok',
    effect: { review_status: 'approved' }
  },
  {
    key: 'redo',
    label: 'Rehacer',
    desc: 'Hay que generarlo de nuevo con otro prompt.',
    tone: 'error',
    effect: { review_status: 'changes_requested', production_status: 'regenerate', prompt_status: 'needs_revision' }
  },
  {
    key: 'variant',
    label: 'Crear variante',
    desc: 'Sirve, pero hace falta más de una versión del mismo asset.',
    tone: 'warn',
    effect: { review_status: 'changes_requested', production_status: 'variants_created' }
  },
  {
    key: 'layers',
    label: 'Pasar a capas',
    desc: 'Una sola generación no da control suficiente: se construye por stems.',
    tone: 'warn',
    effect: { review_status: 'changes_requested', production_status: 'layered', single_or_stems: 'stems', mix_status: 'pending' }
  },
  {
    key: 'mix',
    label: 'Mezclar',
    desc: 'El material está bien; necesita trabajo de mezcla.',
    tone: 'warn',
    effect: { review_status: 'approved', mix_status: 'pending' }
  },
  {
    key: 'discard',
    label: 'Descartar',
    desc: 'No se va a usar. Sale del alcance pero su ID no se reutiliza.',
    tone: 'muted',
    effect: { review_status: 'discarded' }
  }
];

export const getDecision = (key) => REVIEW_DECISIONS.find(d => d.key === key) || null;

export const createReview = ({ version = '', reviewer = '', date } = {}) => ({
  date: date || new Date().toISOString(),
  version,
  reviewer,
  criteria: Object.fromEntries(REVIEW_CRITERIA.map(c => [c.key, { result: '', notes: '' }])),
  decision: '',
  feedback: ''
});

// Aplica la decisión a los ejes del asset y añade la ficha al historial.
export const applyReview = (sound, review) => {
  const decision = getDecision(review.decision);
  const history = [...(sound.reviews || []), review];

  return {
    ...sound,
    ...(decision?.effect || {}),
    reviews: history
  };
};

export const lastReview = (sound) => {
  const list = sound?.reviews || [];
  return list.length ? list[list.length - 1] : null;
};

// Criterios que fallaron en la última revisión: es lo que hay que corregir.
export const failedCriteria = (review) => {
  if (!review) return [];
  return REVIEW_CRITERIA.filter(c => review.criteria?.[c.key]?.result === 'fail');
};

// Una ficha sin feedback escrito no sirve para nada cuando se rehace el asset.
export const reviewProblems = (review) => {
  const problems = [];
  if (!review.decision) problems.push('Falta la decisión.');

  const evaluados = REVIEW_CRITERIA.filter(c => review.criteria?.[c.key]?.result).length;
  if (evaluados === 0) problems.push('Ningún criterio evaluado.');

  const fallos = failedCriteria(review);
  if (fallos.length && !review.feedback.trim()) {
    problems.push('Hay criterios que fallan pero no hay feedback escrito: sin él, la siguiente generación repetirá el error.');
  }
  if (['redo', 'variant', 'layers'].includes(review.decision) && !review.feedback.trim()) {
    problems.push('Una decisión de rehacer necesita cambios observables y accionables por escrito.');
  }

  return problems;
};
