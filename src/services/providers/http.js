// Cliente HTTP común de los proveedores de IA.
//
// Una llamada a un proveedor puede fallar de muchas maneras y la persona necesita
// saber CUÁL, porque cada una se arregla en un sitio distinto: una clave rechazada se
// corrige en el panel; un saldo agotado, en la cuenta del proveedor; un servicio que
// no admite llamadas desde el navegador no lo arregla ella. Por eso los errores se
// clasifican (feature 010, FR-059) y el mensaje dice qué pasó y qué hacer, no solo un
// código.

export const PING_TIMEOUT_MS = 15_000;       // comprobar la conexión (FR-004)
export const ANALYSIS_TIMEOUT_MS = 180_000;   // un análisis largo, antes de rendirse

export const ERROR_KINDS = {
  MISSING_KEY: 'missing_key',
  INVALID_KEY: 'invalid_key',
  QUOTA: 'quota',
  MODEL_NOT_FOUND: 'model_not_found',
  BAD_REQUEST: 'bad_request',
  SERVER: 'server',
  TRUNCATED: 'truncated',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  INVALID_RESPONSE: 'invalid_response'
};

export class AIError extends Error {
  constructor(kind, message, { status = null, provider = '' } = {}) {
    super(message);
    this.name = 'AIError';
    this.kind = kind;
    this.status = status;
    this.provider = provider;
  }
}

const QUOTA_HINT = /insufficient_quota|quota|billing|credit balance|credits|exceeded your current|payment required|saldo/i;

// Convierte una respuesta HTTP de error en un AIError con un mensaje accionable.
export const classifyHttpError = (status, bodyText, providerLabel) => {
  const body = String(bodyText || '');
  const snippet = body.replace(/\s+/g, ' ').slice(0, 200);
  const base = { status, provider: providerLabel };

  if (status === 401 || status === 403) {
    return new AIError(ERROR_KINDS.INVALID_KEY,
      `${providerLabel} rechazó la clave (código ${status}). Revísala en ⚙️ Configuración. No la he borrado: puede ser un fallo pasajero.`, base);
  }
  if (status === 402 || ((status === 429 || status === 400) && QUOTA_HINT.test(body))) {
    return new AIError(ERROR_KINDS.QUOTA,
      `Tu cuenta de ${providerLabel} no tiene saldo o ha llegado a su límite. Revisa tu plan y tu saldo en el sitio de ${providerLabel}; la clave es correcta.`, base);
  }
  if (status === 429) {
    return new AIError(ERROR_KINDS.QUOTA,
      `${providerLabel} está limitando las peticiones ahora mismo. Espera un minuto y vuelve a intentarlo.`, base);
  }
  if (status === 404) {
    return new AIError(ERROR_KINDS.MODEL_NOT_FOUND,
      `${providerLabel} no encuentra el modelo elegido (código 404). Elige otro en ⚙️ Configuración y pulsa «Comprobar conexión».`, base);
  }
  if (status >= 500) {
    return new AIError(ERROR_KINDS.SERVER,
      `El servicio de ${providerLabel} falló (código ${status}). No es culpa tuya: reintenta en un momento.`, base);
  }
  return new AIError(ERROR_KINDS.BAD_REQUEST,
    `${providerLabel} no aceptó la petición (código ${status}).${snippet ? ` Detalle: ${snippet}` : ''}`, base);
};

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return 'el servicio';
  }
};

// `fetch` con plazo y con los fallos de red explicados.
//
// Un `fetch` que lanza TypeError significa que NO hubo respuesta: o no hay conexión, o
// el servidor no admite llamadas hechas desde un navegador (CORS). Desde aquí no se
// pueden distinguir, así que el mensaje cuenta las dos posibilidades.
export const request = async (url, options = {}, { timeoutMs = ANALYSIS_TIMEOUT_MS, providerLabel = '' } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new AIError(ERROR_KINDS.TIMEOUT,
        `${providerLabel || hostOf(url)} no respondió en ${Math.round(timeoutMs / 1000)} segundos. Comprueba tu conexión y vuelve a intentarlo.`,
        { provider: providerLabel });
    }
    throw new AIError(ERROR_KINDS.NETWORK,
      `No se obtuvo respuesta de ${hostOf(url)}. Puede ser tu conexión a internet o que ese servicio no admita llamadas directas desde el navegador. Si es un servicio propio, comprueba que permite peticiones desde esta dirección.`,
      { provider: providerLabel });
  } finally {
    clearTimeout(timer);
  }
};

// Si la respuesta no es correcta, lanza el error ya clasificado.
export const ensureOk = async (response, providerLabel) => {
  if (response.ok) return response;
  let text = '';
  try {
    text = await response.text();
  } catch {
    // Sin cuerpo: el código de estado basta.
  }
  throw classifyHttpError(response.status, text, providerLabel);
};

// Algunos motores envuelven el JSON en una valla de código o añaden una frase antes.
// Se extrae el objeto sin fiarse de que la respuesta venga limpia.
export const parseJsonLoose = (text, providerLabel = '') => {
  const raw = String(text || '').trim();
  const invalid = () => new AIError(ERROR_KINDS.INVALID_RESPONSE,
    `${providerLabel || 'La IA'} devolvió una respuesta que no se puede leer como lista de sonidos. No se ha cambiado nada: vuelve a intentarlo o prueba con otro modelo.`,
    { provider: providerLabel });

  if (!raw) throw invalid();

  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const first = unfenced.indexOf('{');
    const last = unfenced.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(unfenced.slice(first, last + 1));
      } catch {
        // Cae al error de abajo.
      }
    }
    throw invalid();
  }
};

export const truncatedError = (providerLabel) => new AIError(ERROR_KINDS.TRUNCATED,
  `La respuesta de ${providerLabel} se cortó antes de terminar la lista (el modelo llegó a su límite de longitud). No se ha cambiado nada. Prueba con un modelo que admita respuestas más largas.`,
  { provider: providerLabel });

export const missingKeyError = (providerLabel) => new AIError(ERROR_KINDS.MISSING_KEY,
  `Falta la clave de ${providerLabel}. Pégala en ⚙️ Configuración.`, { provider: providerLabel });
