// Generación de efectos con la API de Sound Effects de ElevenLabs.
//
// La duración se envía como parámetro, no solo dentro del texto del prompt.
// Antes iba fija a 2.5 s para todos los assets: un click de UI de 0,15 s y una
// BGM de 60 s salían ambos con 2,5 segundos, y el texto del prompt decía otra
// cosa. Ante la contradicción, gana el parámetro.

import { getKey } from './aiEngineSettings.js';
import { request, classifyHttpError, AIError, ERROR_KINDS } from './providers/http.js';

const LABEL = 'ElevenLabs';

// Límites de la API. Fuera de este rango el valor no se puede enviar tal cual.
export const MIN_DURATION = 0.5;
export const MAX_DURATION = 22;

// Decide qué duración enviar y por qué, sin ocultar los ajustes.
export const resolveDuration = (declared) => {
  const value = Number(String(declared ?? '').replace(',', '.'));

  if (!Number.isFinite(value) || value <= 0) {
    return {
      seconds: null,
      note: 'Sin duración declarada: la decide el modelo a partir del prompt.'
    };
  }

  if (value < MIN_DURATION) {
    return {
      seconds: MIN_DURATION,
      adjusted: true,
      note: `La duración declarada (${value} s) está por debajo del mínimo de la API. Se generará con ${MIN_DURATION} s y habrá que recortar en el DAW.`
    };
  }

  if (value > MAX_DURATION) {
    return {
      seconds: null,
      adjusted: true,
      note: `La duración declarada (${value} s) supera el máximo de ${MAX_DURATION} s de la API. Se deja que el modelo decida, pero para un asset tan largo conviene componerlo en el DAW en vez de generarlo entero.`
    };
  }

  return { seconds: value };
};

// Un audio generado se descarga con la extensión del formato que REALMENTE se
// recibió (feature 010, FR-032): llamar .wav a un MP3 sería mentir sobre el archivo.
// ElevenLabs devuelve MP3 por defecto; el WAV de producción nace en el DAW.
const AUDIO_EXTENSIONS = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a'
};

export const audioExtension = (mimeType) => {
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return AUDIO_EXTENSIONS[base] || (base ? base.replace(/^audio\//, '').replace(/[^a-z0-9]/g, '') || 'mp3' : 'mp3');
};

// ElevenLabs responde 401 también cuando se agotan los créditos, con el motivo en el
// cuerpo. Sin mirarlo, «no te queda saldo» se leería como «tu clave es incorrecta».
const readError = async (response) => {
  const text = await response.text().catch(() => '');
  let detail = {};
  try {
    detail = JSON.parse(text)?.detail || {};
  } catch {
    // Cuerpo que no es JSON: se clasifica solo por el código.
  }

  const reason = `${detail.status || ''} ${detail.message || ''}`;
  if (/quota_exceeded|quota|credits|insufficient/i.test(reason)) {
    return new AIError(ERROR_KINDS.QUOTA,
      'Tu cuenta de ElevenLabs se ha quedado sin créditos. Revisa tu plan en el sitio de ElevenLabs; la clave es correcta.',
      { status: response.status, provider: LABEL });
  }
  return classifyHttpError(response.status, text, LABEL);
};

export const generateSoundEffect = async (prompt, declaredDuration) => {
  const apiKey = getKey('elevenlabs');
  if (!apiKey) {
    throw new AIError(ERROR_KINDS.MISSING_KEY,
      'Falta tu clave de ElevenLabs. Pégala en ⚙️ Configuración (o en un archivo .env con VITE_ELEVENLABS_API_KEY).',
      { provider: LABEL });
  }
  if (!prompt || !prompt.trim()) {
    throw new AIError(ERROR_KINDS.BAD_REQUEST,
      'Este sonido no tiene prompt: escríbelo antes de generar.', { provider: LABEL });
  }

  const duration = resolveDuration(declaredDuration);

  const body = {
    text: prompt,
    prompt_influence: 0.35 // Mayor fidelidad al prompt, menos deriva creativa.
  };
  // Omitir el parámetro es distinto de enviarlo a cero: significa "decide tú".
  if (duration.seconds !== null) body.duration_seconds = duration.seconds;

  const response = await request('https://api.elevenlabs.io/v1/sound-effects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify(body)
  }, { timeoutMs: 120_000, providerLabel: LABEL });

  if (!response.ok) throw await readError(response);

  const audioBlob = await response.blob();
  return { blob: audioBlob, duration, extension: audioExtension(audioBlob.type) };
};
