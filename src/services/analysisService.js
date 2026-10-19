// Análisis multimodal con el motor de IA que haya elegido la persona.
//
// Sustituye al antiguo geminiService.js, que solo hablaba con Gemini. Aquí se
// orquesta; cada proveedor tiene su adaptador en providers/. Lo que NO cambia con el
// motor es lo importante: el prompt de sistema, el perfil del género, la ficha del
// juego y la forma de la respuesta son los mismos (feature 010, FR-013 y FR-014).
//
// Principio operativo: la lista que devuelve NO está aprobada. Quien llama la marca
// como 'pending_validation'; ningún motor decide un estado.

import { buildSystemPrompt, buildDescriptionMessage, RESPONSE_SCHEMA } from './analysisPrompt.js';
import { getEngine, getKey, getProvider, validateBaseUrl } from './aiEngineSettings.js';
import { getActivePackage } from './livePrompts.js';
import * as gemini from './providers/gemini.js';
import * as anthropic from './providers/anthropic.js';
import * as openai from './providers/openai.js';
import { AIError, ERROR_KINDS, missingKeyError } from './providers/http.js';

const ADAPTERS = { gemini, anthropic, openai, compatible: openai };

// --- Imágenes ---

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

// Los proveedores exigen el tipo exacto: `image/jpg` no existe, es `image/jpeg`.
const normalizeMime = (mime) => {
  const lower = String(mime || '').toLowerCase();
  if (lower === 'image/jpg' || lower === 'image/pjpeg') return 'image/jpeg';
  return lower || 'image/png';
};

// Acepta lo que llegue de la interfaz —una dirección de datos, un archivo o un objeto
// ya codificado— y lo deja como { mimeType, data } con `data` en Base64.
export const normalizeImages = async (items = []) => {
  const parts = [];
  for (const item of items || []) {
    if (!item) continue;
    if (typeof item === 'string' && item.startsWith('data:')) {
      const [header, data] = item.split(',');
      const match = header.match(/data:([^;]+);/);
      parts.push({ mimeType: normalizeMime(match ? match[1] : 'image/png'), data });
    } else if (item instanceof Blob || (typeof File !== 'undefined' && item instanceof File)) {
      parts.push({ mimeType: normalizeMime(item.type), data: await fileToBase64(item) });
    } else if (item.data && item.mimeType) {
      parts.push({ mimeType: normalizeMime(item.mimeType), data: item.data });
    }
  }
  return parts;
};

// --- ¿Ve imágenes el modelo elegido? (FR-018) ---

// 'yes' | 'no' | 'unknown'. El análisis nunca descarta las imágenes en silencio: con
// 'no' la interfaz avisa ANTES de lanzar, y con 'unknown' pide confirmar.
export const engineSupportsImages = (engine = getEngine()) => {
  const model = String(engine.model || '').toLowerCase();

  switch (engine.provider) {
    case 'gemini':
      return 'yes';
    case 'anthropic':
      return /claude-(2|instant)/.test(model) ? 'no' : 'yes';
    case 'openai':
      if (/^(gpt-4o|gpt-4\.1|gpt-4\.5|gpt-4-turbo|gpt-5|chatgpt-4o|o1(?!-mini)|o3(?!-mini)|o4)/.test(model)) return 'yes';
      if (/^(gpt-3\.5|gpt-4$|gpt-4-\d|o1-mini|o3-mini)/.test(model)) return 'no';
      return 'unknown';
    case 'compatible':
      // No hay forma de saberlo desde fuera: lo declara la persona al configurarlo.
      return engine.acceptsImages ? 'yes' : 'no';
    default:
      return 'unknown';
  }
};

// --- Resolución del motor ---

// Reúne todo lo que un adaptador necesita y falla SIN llamada de red si falta algo.
const resolveEngine = (overrides = {}) => {
  const engine = { ...getEngine(), ...overrides };
  const provider = getProvider(engine.provider);
  const key = overrides.key !== undefined ? String(overrides.key).trim() : getKey(provider.id);

  if (!key) throw missingKeyError(provider.label);

  let baseUrl = '';
  if (provider.needsBaseUrl) {
    const checked = validateBaseUrl(engine.baseUrl);
    // La clave viaja a esta dirección: si no es segura, no se envía a ninguna parte.
    if (!checked.ok) throw new AIError(ERROR_KINDS.BAD_REQUEST, checked.error, { provider: provider.label });
    baseUrl = checked.url;
  }

  return { engine, provider, key, baseUrl };
};

// --- Validación del resultado (R2) ---

const REPORT_SECTIONS = ['gameAnalysis', 'identity'];

// Un motor puede devolver «casi» lo pedido. Antes de tocar el proyecto se exige una
// lista de sonidos no vacía y las secciones principales del informe: guardar un
// resultado sin sonidos VACIARÍA la lista maestra de la persona.
export const validateAnalysis = (result, providerLabel = 'La IA') => {
  const fail = (why) => new AIError(ERROR_KINDS.INVALID_RESPONSE,
    `${providerLabel} devolvió un análisis incompleto (${why}). No se ha cambiado nada de tu proyecto: vuelve a intentarlo o prueba con otro modelo.`,
    { provider: providerLabel });

  if (!result || typeof result !== 'object' || Array.isArray(result)) throw fail('no es un objeto');
  if (!Array.isArray(result.sounds) || result.sounds.length === 0) throw fail('no incluye ningún sonido');
  for (const section of REPORT_SECTIONS) {
    if (!result[section] || typeof result[section] !== 'object') throw fail(`falta «${section}»`);
  }
  return result;
};

// --- API pública ---

// `options.sendImages` permite lanzar el análisis solo con texto cuando el modelo no
// ve imágenes y la persona lo ha confirmado.
export const analyzeGame = async (description, imageFiles = [], gameType = 'Slot', config = {}, discovery = {}, options = {}) => {
  const { engine, provider, key, baseUrl } = resolveEngine();
  const { sendImages = true } = options;

  // Instantánea: el análisis termina con la versión de prompts con la que empezó, aunque
  // llegue otra mientras espera al motor (feature 011, FR-022).
  const promptPackage = getActivePackage();

  const useImages = sendImages && engineSupportsImages(engine) !== 'no';
  const images = useImages ? await normalizeImages(imageFiles) : [];

  const adapter = ADAPTERS[provider.id];
  const result = await adapter.run({
    key,
    model: engine.model,
    baseUrl,
    compatible: provider.id === 'compatible',
    system: buildSystemPrompt(gameType, config, discovery, promptPackage),
    description: buildDescriptionMessage(description, promptPackage),
    images,
    schema: RESPONSE_SCHEMA
  });

  // La versión de prompts queda en el informe: si un resultado sale mal, el director sabe
  // con qué instrucciones se hizo (FR-020).
  return { ...validateAnalysis(result, provider.label), promptsVersion: promptPackage.version };
};

// Comprueba que la clave y el modelo responden, antes de gastar un análisis completo
// (FR-004). Acepta valores aún sin guardar, para poder probar lo que la persona acaba
// de escribir. Devuelve los modelos de la cuenta y si el elegido aparece en ellos.
export const testConnection = async (overrides = {}) => {
  const { engine, provider, key, baseUrl } = resolveEngine(overrides);
  const adapter = ADAPTERS[provider.id];

  const { models } = await adapter.ping({ key, baseUrl, compatible: provider.id === 'compatible' });

  const chosen = engine.model;
  return {
    provider: provider.label,
    models,
    // Un listado puede estar incompleto, así que esto es un aviso, no un error.
    modelListed: !chosen || models.length === 0 || models.includes(chosen)
  };
};
