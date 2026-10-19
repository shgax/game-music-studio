// Adaptador de Gemini (Google).
//
// Es el código que antes vivía en geminiService.js, movido y sin cambiar de
// comportamiento: mismas llamadas, mismo sondeo de modelos, mismo `responseSchema`.
// Lo único nuevo es que recibe el prompt y el esquema ya hechos, y que traduce el
// esquema estándar al dialecto de Gemini (tipos en mayúsculas).

import { getEngine, setGeminiModel } from '../aiEngineSettings.js';
import {
  request, ensureOk, parseJsonLoose, truncatedError, missingKeyError,
  AIError, ERROR_KINDS, PING_TIMEOUT_MS, ANALYSIS_TIMEOUT_MS
} from './http.js';

export const LABEL = 'Gemini';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// El nombre del modelo cambia con el tiempo y no todas las cuentas tienen los
// mismos disponibles. Se prueba en orden hasta que uno responda, y el que funciona
// se recuerda para no repetir el sondeo.
export const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-1.5-flash'
];

// JSON Schema estándar → dialecto de Gemini (`type` en mayúsculas). Solo conserva lo
// que Gemini entiende.
export const toGeminiSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { type: String(schema.type).toUpperCase() };
  if (schema.enum) out.enum = schema.enum;
  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  return out;
};

// Pregunta a la cuenta qué modelos tiene realmente disponibles.
export const listModels = async (key) => {
  if (!key) throw missingKeyError(LABEL);
  const res = await request(`${API_BASE}/models?key=${encodeURIComponent(key)}`, {}, {
    timeoutMs: PING_TIMEOUT_MS, providerLabel: LABEL
  });
  await ensureOk(res, LABEL);
  const data = await res.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
};

// Elige el modelo recordado, o el primer candidato que la cuenta tenga, o el primero
// de la familia flash.
const resolveModel = async (key) => {
  const preferred = getEngine().provider === 'gemini' ? getEngine().model : '';
  if (preferred) return preferred;

  const available = await listModels(key);
  const found = MODEL_CANDIDATES.find(c => available.includes(c))
    || available.find(m => /flash/.test(m) && !/thinking|image|tts|live/.test(m))
    || available[0];

  if (!found) {
    throw new AIError(ERROR_KINDS.MODEL_NOT_FOUND,
      'Esta clave de Gemini no tiene ningún modelo disponible para analizar. Comprueba en tu cuenta de Google que el servicio está activado.',
      { provider: LABEL });
  }
  setGeminiModel(found);
  return found;
};

export const ping = async ({ key }) => {
  const models = await listModels(key);
  if (!models.length) {
    throw new AIError(ERROR_KINDS.MODEL_NOT_FOUND,
      'La clave es válida, pero no tiene modelos disponibles para analizar.', { provider: LABEL });
  }
  return { models };
};

// `images` son partes ya normalizadas: [{ mimeType, data }] con `data` en Base64.
export const run = async ({ key, system, description, images = [], schema }) => {
  if (!key) throw missingKeyError(LABEL);
  const model = await resolveModel(key);

  const res = await request(`${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: system },
          { text: description },
          ...images.map(img => ({ inlineData: { data: img.data, mimeType: img.mimeType } }))
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema)
      }
    })
  }, { timeoutMs: ANALYSIS_TIMEOUT_MS, providerLabel: LABEL });

  try {
    await ensureOk(res, LABEL);
  } catch (e) {
    // Si el modelo recordado dejó de existir, se olvida para que el siguiente
    // intento vuelva a sondear en vez de fallar siempre igual.
    if (e.kind === ERROR_KINDS.MODEL_NOT_FOUND) {
      setGeminiModel('');
      throw new AIError(ERROR_KINDS.MODEL_NOT_FOUND,
        `El modelo «${model}» ya no está disponible con esta clave. He olvidado la preferencia: vuelve a intentarlo y se buscará otro automáticamente.`,
        { status: 404, provider: LABEL });
    }
    throw e;
  }

  const result = await res.json();
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') throw truncatedError(LABEL);

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new AIError(ERROR_KINDS.INVALID_RESPONSE,
      'Gemini no devolvió contenido. Puede que haya bloqueado la petición; prueba con otra descripción o con otro modelo.',
      { provider: LABEL });
  }
  return parseJsonLoose(text, LABEL);
};
