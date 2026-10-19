// Preferencias de interfaz de la persona, guardadas en su navegador.
//
// Son comodidades, no datos del proyecto: nunca viajan a la nube ni a una
// exportación. Cada acceso a localStorage va protegido porque puede lanzar (ventana
// privada, datos del sitio bloqueados); la interfaz tiene que funcionar igual sin él.

const VIEW_KEY = 'view_mode';
const GUIDE_HIDDEN_KEY = 'guide_hidden';
const GENERATION_NOTICE_KEY = 'generation_notice_seen';
const ADVANCED_OPTIONS_KEY = 'advanced_options';

// Prompts vivos (feature 011). Ninguna de estas claves entra en `projects`, en el respaldo
// ni en una exportación: son del navegador de la persona.
const PROMPTS_REMOTE_KEY = 'prompts_remote_enabled';
const PROMPTS_NOTICE_KEY = 'prompts_notice_seen';
const PROMPTS_SAVED_KEY = 'prompts_saved';
const PROMPTS_NOTE_KEY = 'prompts_note_seen';

const read = (name) => {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
};

const write = (name, value) => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(name);
    else localStorage.setItem(name, value);
  } catch {
    // Sin almacenamiento la preferencia dura lo que dure la pestaña. No es grave.
  }
};

export const VIEW_MODES = ['simple', 'full'];

// La vista inicial la decide quien arma la copia (VITE_DEFAULT_VIEW=simple); lo que
// la persona elija después manda. Sin ninguna de las dos, es la vista completa: quien
// ya usaba la herramienta no ve ningún cambio (FR-064).
export const getViewMode = () => {
  const saved = read(VIEW_KEY);
  if (VIEW_MODES.includes(saved)) return saved;
  return import.meta.env?.VITE_DEFAULT_VIEW === 'simple' ? 'simple' : 'full';
};

export const setViewMode = (mode) => {
  if (VIEW_MODES.includes(mode)) write(VIEW_KEY, mode);
};

export const isGuideHidden = () => read(GUIDE_HIDDEN_KEY) === 'true';

export const setGuideHidden = (hidden) => write(GUIDE_HIDDEN_KEY, hidden ? 'true' : null);

// Antes de la primera generación se avisa una sola vez de que cada sonido gasta
// créditos de la cuenta de ElevenLabs de la persona (FR-057).
export const generationNoticeSeen = () => read(GENERATION_NOTICE_KEY) === 'true';

export const markGenerationNoticeSeen = () => write(GENERATION_NOTICE_KEY, 'true');

// --- Prompts vivos (feature 011) ---

// Activada por defecto; solo se guarda la decisión de apagarla.
export const isRemotePromptsEnabled = () => read(PROMPTS_REMOTE_KEY) !== 'false';

export const setRemotePromptsEnabled = (enabled) => write(PROMPTS_REMOTE_KEY, enabled ? null : 'false');

// El aviso de qué se consulta y a dónde se muestra una vez, ANTES de la primera consulta (FR-015).
export const promptsNoticeSeen = () => read(PROMPTS_NOTICE_KEY) === 'true';

export const markPromptsNoticeSeen = () => write(PROMPTS_NOTICE_KEY, 'true');

// La última versión válida descargada: `{ pkg, fetchedAt }`, o null. Si el navegador no deja
// guardar (cuota, ventana privada), no se lanza nada: simplemente no queda copia (FR-029).
export const getSavedPackage = () => {
  const raw = read(PROMPTS_SAVED_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
};

export const setSavedPackage = (pkg, fetchedAt) => write(PROMPTS_SAVED_KEY, JSON.stringify({ pkg, fetchedAt }));

export const clearSavedPackage = () => write(PROMPTS_SAVED_KEY, null);

// La nota de «qué cambió» se enseña una sola vez por versión (FR-019).
export const promptsNoteSeen = () => read(PROMPTS_NOTE_KEY);

export const markPromptsNoteSeen = (version) => write(PROMPTS_NOTE_KEY, version);

// Opciones avanzadas de la lista (feature 002, FR-001a): las columnas de revisión, mezcla y
// entrega, la acción «Revisar» de cada fila y las importaciones. Son cosas que el flujo de cada
// día no necesita, así que están ocultas salvo que la persona las pida. Ocultarlas solo cambia lo
// que se ve: el estado de cada asset no se toca (FR-001b).
export const areAdvancedOptionsShown = () => read(ADVANCED_OPTIONS_KEY) === 'true';

export const setAdvancedOptionsShown = (shown) => write(ADVANCED_OPTIONS_KEY, shown ? 'true' : null);
