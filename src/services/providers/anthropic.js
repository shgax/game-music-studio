// Adaptador de Claude (Anthropic).
//
// La forma se fuerza con una HERRAMIENTA de salida: se le da al modelo una única
// herramienta cuyo esquema de entrada es el esquema de respuesta, y se le obliga a
// usarla. Así lo que vuelve ya es un objeto con la forma exacta, no un texto que haya
// que esperar que sea JSON.
//
// Anthropic admite llamadas desde el navegador solo con una cabecera explícita. Es la
// forma correcta de usar una clave PROPIA desde el propio equipo de la persona, que es
// el caso de esta herramienta: la clave nunca pasa por un servidor del estudio.

import {
  request, ensureOk, parseJsonLoose, truncatedError, missingKeyError,
  AIError, ERROR_KINDS, PING_TIMEOUT_MS, ANALYSIS_TIMEOUT_MS
} from './http.js';

export const LABEL = 'Claude';

const API_BASE = 'https://api.anthropic.com/v1';
const TOOL_NAME = 'submit_analysis';

// Una lista de 20-60 sonidos con prompts largos es una respuesta grande. Si el modelo
// admite menos, la API lo dice y se reintenta con su tope.
const DEFAULT_MAX_TOKENS = 32_000;

const headers = (key) => ({
  'Content-Type': 'application/json',
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true'
});

export const ping = async ({ key }) => {
  if (!key) throw missingKeyError(LABEL);
  const res = await request(`${API_BASE}/models?limit=100`, { headers: headers(key) }, {
    timeoutMs: PING_TIMEOUT_MS, providerLabel: LABEL
  });
  await ensureOk(res, LABEL);
  const data = await res.json();
  return { models: (data.data || []).map(m => m.id) };
};

// «max_tokens: 32000 > 8192, which is the maximum allowed…» → 8192
const limitFromError = (text) => {
  const match = String(text || '').match(/max_tokens[^0-9]*\d+\s*>\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

const call = async (key, body) => request(`${API_BASE}/messages`, {
  method: 'POST',
  headers: headers(key),
  body: JSON.stringify(body)
}, { timeoutMs: ANALYSIS_TIMEOUT_MS, providerLabel: LABEL });

// `images` son partes ya normalizadas: [{ mimeType, data }] con `data` en Base64.
export const run = async ({ key, model, system, description, images = [], schema }) => {
  if (!key) throw missingKeyError(LABEL);
  if (!model) {
    throw new AIError(ERROR_KINDS.MODEL_NOT_FOUND,
      'Elige un modelo de Claude en ⚙️ Configuración.', { provider: LABEL });
  }

  const build = (maxTokens) => ({
    model,
    max_tokens: maxTokens,
    system,
    tools: [{
      name: TOOL_NAME,
      description: 'Entrega el análisis visual, la identidad sonora y la lista maestra de sonidos.',
      input_schema: schema
    }],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{
      role: 'user',
      content: [
        ...images.map(img => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mimeType, data: img.data }
        })),
        { type: 'text', text: description }
      ]
    }]
  });

  let res = await call(key, build(DEFAULT_MAX_TOKENS));

  if (res.status === 400) {
    const detail = await res.clone().text();
    const limit = limitFromError(detail);
    if (limit && limit < DEFAULT_MAX_TOKENS) res = await call(key, build(limit));
  }

  await ensureOk(res, LABEL);
  const result = await res.json();

  if (result.stop_reason === 'max_tokens') throw truncatedError(LABEL);

  const tool = (result.content || []).find(block => block.type === 'tool_use');
  if (tool?.input && typeof tool.input === 'object') return tool.input;

  // Por si el modelo contestó con texto en vez de usar la herramienta.
  const text = (result.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseJsonLoose(text, LABEL);
};
