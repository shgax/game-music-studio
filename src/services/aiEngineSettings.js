// Motor de IA elegido y claves de cada proveedor.
//
// Es el ÚNICO sitio que lee y escribe estos datos. Todo vive en el navegador de la
// persona (localStorage); nada de esto entra jamás en el proyecto, en el respaldo
// que va a la nube ni en ninguna exportación (feature 010, FR-007 y FR-008). Por eso
// las claves no se guardan dentro de `projects`, que es lo único que sale de aquí.
//
// Cada acceso a localStorage va protegido: en una ventana privada, con los datos del
// sitio bloqueados o fuera del navegador (scripts de prueba) puede lanzar, y la
// herramienta tiene que seguir funcionando sin él.

// Claves ya existentes: conservan su nombre para que quien ya usaba la herramienta
// no tenga que volver a pegar nada (FR-005).
const ENGINE_KEY = 'ai_engine';
const NOTICE_KEY = 'ai_notice_seen';
const GEMINI_MODEL_KEY = 'gemini_model';

export const ELEVENLABS = {
  id: 'elevenlabs',
  label: 'ElevenLabs',
  storageKey: 'elevenlabs_api_key',
  // Vite sustituye estas referencias al compilar: han de escribirse completas.
  env: () => import.meta.env?.VITE_ELEVENLABS_API_KEY
};

// Los proveedores del ANÁLISIS. Gemini conserva su clave y su variable de entorno;
// los nuevos solo admiten la clave pegada en el panel, porque todo `VITE_*` se
// incrusta en el JavaScript que sirve el servidor.
export const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    storageKey: 'gemini_api_key',
    env: () => import.meta.env?.VITE_GEMINI_API_KEY,
    defaultModel: '',
    needsBaseUrl: false
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    storageKey: 'anthropic_api_key',
    env: () => undefined,
    defaultModel: 'claude-sonnet-5-5',
    needsBaseUrl: false
  },
  {
    id: 'openai',
    label: 'OpenAI',
    storageKey: 'openai_api_key',
    env: () => undefined,
    defaultModel: 'gpt-4o',
    needsBaseUrl: false
  },
  {
    id: 'compatible',
    label: 'Compatible con OpenAI',
    storageKey: 'compatible_api_key',
    env: () => undefined,
    defaultModel: '',
    needsBaseUrl: true
  }
];

export const DEFAULT_PROVIDER = 'gemini';

export const getProvider = (id) => PROVIDERS.find(p => p.id === id) || PROVIDERS[0];

// --- localStorage protegido ---

const read = (name) => {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
};

const write = (name, value) => {
  try {
    if (value === null || value === undefined || value === '') localStorage.removeItem(name);
    else localStorage.setItem(name, value);
    return true;
  } catch {
    return false;
  }
};

const readJson = (name) => {
  try {
    const raw = read(name);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// --- Claves ---

const entryFor = (providerId) =>
  providerId === ELEVENLABS.id ? ELEVENLABS : getProvider(providerId);

const stored = (providerId) => (read(entryFor(providerId).storageKey) || '').trim();

const fromEnv = (providerId) => {
  const value = entryFor(providerId).env();
  return typeof value === 'string' ? value.trim() : '';
};

// La clave pegada manda; la del entorno (.env) es el respaldo de siempre (FR-066).
export const getKey = (providerId) => stored(providerId) || fromEnv(providerId);

export const hasKey = (providerId) => Boolean(getKey(providerId));

// De dónde sale la clave, para decírselo a la persona: «pegada» o «del .env».
export const keySource = (providerId) => {
  if (stored(providerId)) return 'stored';
  if (fromEnv(providerId)) return 'env';
  return 'none';
};

export const setKey = (providerId, value) => write(entryFor(providerId).storageKey, String(value ?? '').trim());

export const clearKey = (providerId) => write(entryFor(providerId).storageKey, null);

// Borra las claves PEGADAS de este equipo. Las del .env son un archivo del
// proyecto y no se pueden borrar desde aquí; la interfaz lo dice.
export const clearAllKeys = () => {
  [...PROVIDERS, ELEVENLABS].forEach(p => write(p.storageKey, null));
};

// Una clave nunca se muestra completa una vez guardada (FR-010).
export const maskKey = (key) => {
  const value = String(key || '');
  if (!value) return '';
  return value.length <= 8 ? '••••' : `••••••••${value.slice(-4)}`;
};

// --- Motor elegido ---

export const getEngine = () => {
  const saved = readJson(ENGINE_KEY) || {};
  const provider = getProvider(saved.provider);

  // El modelo de Gemini vive donde siempre ha vivido: su sondeo automático lo
  // recuerda ahí, y quien ya lo había fijado lo conserva.
  const model = provider.id === 'gemini'
    ? (read(GEMINI_MODEL_KEY) || '')
    : (saved.model || provider.defaultModel);

  return {
    provider: provider.id,
    model,
    baseUrl: provider.needsBaseUrl ? (saved.baseUrl || '') : '',
    // En un proveedor compatible no se puede saber si el modelo ve imágenes: lo dice
    // la persona. En el resto se infiere por el nombre del modelo.
    acceptsImages: provider.needsBaseUrl ? Boolean(saved.acceptsImages) : true
  };
};

export const setEngine = ({ provider, model = '', baseUrl = '', acceptsImages = false }) => {
  const chosen = getProvider(provider);

  if (chosen.id === 'gemini') setGeminiModel(model);

  return write(ENGINE_KEY, JSON.stringify({
    provider: chosen.id,
    model: chosen.id === 'gemini' ? '' : model,
    baseUrl: chosen.needsBaseUrl ? baseUrl : '',
    acceptsImages: chosen.needsBaseUrl ? Boolean(acceptsImages) : true
  }));
};

// El sondeo automático de Gemini recuerda aquí el modelo que le funcionó, y lo olvida
// si deja de existir. Es el mismo dato que ya guardaba antes de esta feature.
export const setGeminiModel = (model) => write(GEMINI_MODEL_KEY, model || null);

export const hasEngineKey = () => hasKey(getEngine().provider);

// «Claude (Anthropic) · claude-sonnet-5-5», para decir con qué se va a ejecutar
// el análisis (FR-006) en lugar de nombrar uno fijo (FR-065).
export const describeEngine = () => {
  const engine = getEngine();
  const provider = getProvider(engine.provider);
  return engine.model ? `${provider.label} · ${engine.model}` : provider.label;
};

// Nombre corto, para botones e indicadores: «Claude», «Gemini», «OpenAI».
export const engineShortName = () => getProvider(getEngine().provider).label.split(' ')[0];

// --- Dirección de un proveedor compatible ---

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// La clave viaja a esta dirección, así que se valida ANTES de enviar nada: solo
// https, o http contra la propia máquina para desarrollo (FR-011).
export const validateBaseUrl = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Escribe la dirección del servicio.' };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Esa dirección no es válida. Debe empezar por https://' };
  }

  if (url.username || url.password) {
    return { ok: false, error: 'La dirección no debe llevar usuario ni contraseña dentro.' };
  }

  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    return {
      ok: false,
      error: 'Por seguridad, la dirección debe empezar por https://. Solo se admite http:// si apunta a tu propio equipo (localhost).'
    };
  }

  return { ok: true, url: `${url.origin}${url.pathname}`.replace(/\/+$/, '') };
};

// --- Aviso «se envía a un tercero» (FR-019) ---

export const noticeSeen = (providerId) => Boolean((readJson(NOTICE_KEY) || {})[providerId]);

export const markNoticeSeen = (providerId) =>
  write(NOTICE_KEY, JSON.stringify({ ...(readJson(NOTICE_KEY) || {}), [providerId]: true }));
