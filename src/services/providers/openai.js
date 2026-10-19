// Adaptador de OpenAI y de los servicios compatibles con su API.
//
// «Compatible con OpenAI» es la misma API en otra dirección: Ollama, LM Studio, un
// servicio propio del estudio… La dirección se valida ANTES de enviarle la clave
// (aiEngineSettings.validateBaseUrl), porque la clave viaja hasta ella.
//
// No todos los servicios compatibles entienden `json_schema`, así que la forma se
// pide en tres escalones y se baja de uno al siguiente solo si el servicio dice que
// no lo soporta:
//   1. json_schema  — la forma exacta, validada por el servicio.
//   2. json_object  — JSON válido, con el esquema escrito dentro del prompt.
//   3. solo prompt  — el esquema en el prompt y un extractor tolerante.

import {
  request, ensureOk, classifyHttpError, parseJsonLoose, truncatedError, missingKeyError,
  AIError, ERROR_KINDS, PING_TIMEOUT_MS, ANALYSIS_TIMEOUT_MS
} from './http.js';

export const OFFICIAL_BASE = 'https://api.openai.com/v1';

const labelFor = (isCompatible) => (isCompatible ? 'El servicio compatible' : 'OpenAI');

const authHeaders = (key) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${key}`
});

const baseOf = (baseUrl) => String(baseUrl || OFFICIAL_BASE).replace(/\/+$/, '');

// El listado oficial mezcla modelos de texto con los de audio, imagen y embeddings.
const NOT_FOR_ANALYSIS = /embedding|tts|whisper|dall|audio|realtime|transcribe|moderation|image|search|davinci|babbage/i;

export const ping = async ({ key, baseUrl, compatible = false }) => {
  const label = labelFor(compatible);
  if (!key) throw missingKeyError(label);

  const res = await request(`${baseOf(baseUrl)}/models`, { headers: authHeaders(key) }, {
    timeoutMs: PING_TIMEOUT_MS, providerLabel: label
  });
  await ensureOk(res, label);

  const data = await res.json();
  const ids = (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean);
  return { models: compatible ? ids : ids.filter(id => /^(gpt|o\d|chatgpt)/i.test(id) && !NOT_FOR_ANALYSIS.test(id)) };
};

const schemaInstruction = (schema) =>
  `\n\nRespond with ONE JSON object and nothing else, matching exactly this JSON Schema:\n${JSON.stringify(schema)}`;

// Un 400 que habla del formato de respuesta significa «esto no lo soporto»: se baja
// de escalón. Cualquier otro error no tiene que ver y se propaga.
const rejectsResponseFormat = (status, text) =>
  status === 400 && /response_format|json_schema|json_object|structured/i.test(text);

// `images` son partes ya normalizadas: [{ mimeType, data }] con `data` en Base64.
export const run = async ({ key, model, baseUrl, compatible = false, system, description, images = [], schema }) => {
  const label = labelFor(compatible);
  if (!key) throw missingKeyError(label);
  if (!model) {
    throw new AIError(ERROR_KINDS.MODEL_NOT_FOUND,
      'Elige un modelo en ⚙️ Configuración.', { provider: label });
  }

  const userContent = [
    { type: 'text', text: description },
    ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } }))
  ];

  const strategies = [
    { name: 'json_schema', system, format: { type: 'json_schema', json_schema: { name: 'analysis', schema, strict: false } } },
    { name: 'json_object', system: system + schemaInstruction(schema), format: { type: 'json_object' } },
    { name: 'prompt', system: system + schemaInstruction(schema), format: null }
  ];

  let lastRejection = null;

  for (const strategy of strategies) {
    const body = {
      model,
      messages: [
        { role: 'system', content: strategy.system },
        { role: 'user', content: userContent }
      ]
    };
    if (strategy.format) body.response_format = strategy.format;

    const res = await request(`${baseOf(baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(body)
    }, { timeoutMs: ANALYSIS_TIMEOUT_MS, providerLabel: label });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (rejectsResponseFormat(res.status, text)) {
        lastRejection = classifyHttpError(res.status, text, label);
        continue;
      }
      throw classifyHttpError(res.status, text, label);
    }

    const result = await res.json();
    const choice = result.choices?.[0];

    if (choice?.finish_reason === 'length') throw truncatedError(label);
    if (choice?.message?.refusal) {
      throw new AIError(ERROR_KINDS.INVALID_RESPONSE,
        `${label} se negó a responder: ${String(choice.message.refusal).slice(0, 160)}`, { provider: label });
    }
    return parseJsonLoose(choice?.message?.content, label);
  }

  throw lastRejection || new AIError(ERROR_KINDS.BAD_REQUEST,
    `${label} no aceptó ninguno de los formatos de respuesta probados.`, { provider: label });
};
