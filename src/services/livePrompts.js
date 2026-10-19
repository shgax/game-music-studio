// El paquete de prompts activo y su consulta al repositorio del autor (feature 011).
//
// La herramienta lleva incluida una copia completa del paquete (prompts/paquete.json) y
// funciona con solo ella, sin red ni claves. Además puede leer la versión más reciente de
// una dirección pública del repositorio. Orden de preferencia (FR-005):
//
//   1. la última versión publicada VÁLIDA,
//   2. la última versión válida que se descargó antes (copia guardada),
//   3. la copia incluida.
//
// Lo que llega de fuera es dato, nunca código: pasa por `parsePackage`, que lo valida entero
// o lo descarta entero. La consulta es de SOLO LECTURA: un GET anónimo, sin cuerpo, sin
// cabeceras propias y sin credenciales. Nada de la persona viaja (FR-013).
//
// El estado se reemplaza ENTERO cada vez que cambia, así que quien lo lee nunca ve dos
// versiones mezcladas (FR-023). Los componentes lo leen con `usePromptPackage`; el análisis
// toma una instantánea con `getActivePackage()` al empezar y la mantiene hasta terminar.

import bundledRaw from '../../prompts/paquete.json';
import { parsePackage, validatePackage } from '../data/promptPackage.js';
import {
  isRemotePromptsEnabled,
  setRemotePromptsEnabled,
  promptsNoticeSeen,
  markPromptsNoticeSeen,
  getSavedPackage,
  setSavedPackage,
  clearSavedPackage,
  promptsNoteSeen,
  markPromptsNoteSeen
} from './uiPreferences.js';

// La dirección es UNA y fija (FR-030): la persona no puede cambiarla desde la interfaz.
// Solo se acepta una respuesta que siga en este mismo servidor.
export const PROMPTS_SOURCE_URL = 'https://raw.githubusercontent.com/shgax/game-music-studio/main/prompts/paquete.json';
const SOURCE_ORIGIN = new URL(PROMPTS_SOURCE_URL).origin;

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;

// Cómo se llama, para la persona, cada origen del paquete en uso (FR-018).
export const SOURCE_LABELS = { remote: 'publicada', saved: 'guardada', bundled: 'incluida' };

// Lo que se le dice a la persona cuando la consulta no pudo aplicar nada (FR-028). Poco
// alarmante a propósito: la herramienta sigue funcionando con la versión que tenía.
export const REASON_MESSAGES = {
  disabled: 'La consulta está desactivada.',
  network: 'No hay conexión con el repositorio de prompts.',
  timeout: 'El repositorio de prompts tardó demasiado en responder.',
  not_found: 'La dirección de los prompts ya no responde. Se sigue con la versión que tienes.',
  http: 'El repositorio de prompts devolvió un error.',
  bad_origin: 'La respuesta no vino de la dirección esperada y se descartó.',
  too_big: 'El paquete de prompts es demasiado grande y se descartó.',
  not_json: 'El paquete de prompts publicado está dañado y se descartó.',
  bad_shape: 'El paquete de prompts publicado está dañado y se descartó.',
  invalid_content: 'El paquete de prompts publicado no cumple las reglas del método y se descartó.',
  needs_newer_app: 'Hay prompts nuevos, pero necesitan una versión más reciente de la herramienta. Actualiza tu copia.',
  unsupported_response_format: 'Hay prompts nuevos, pero necesitan una versión más reciente de la herramienta. Actualiza tu copia.'
};

// --- Estado ---

const validated = validatePackage(bundledRaw);
if (!validated.ok) {
  // `npm run build` valida el paquete antes de compilar, así que esto solo ocurre en
  // desarrollo, editando prompts/paquete.json: que se vea, no que falle en silencio.
  throw new Error(`El paquete de prompts incluido no es válido: ${validated.details.join(' · ')}`);
}
const bundled = validated.pkg;

let state = {
  pkg: bundled,
  source: 'bundled',      // 'remote' | 'saved' | 'bundled'
  fetchedAt: null,
  status: 'idle',         // 'idle' | 'checking'
  lastResult: null,       // { status, reason?, version?, at }
  noteVersion: null,      // versión recién aplicada cuya nota aún no se ha enseñado
  enabled: isRemotePromptsEnabled(),
  noticeSeen: promptsNoticeSeen()
};

const listeners = new Set();

const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
};

export const getState = () => state;

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Instantánea: quien la guarda sigue con esa versión aunque llegue otra después.
export const getActivePackage = () => state.pkg;

// --- Arranque ---

let started = false;

// Se llama una vez al abrir. Es síncrona en lo que importa: elige el paquete inicial y la
// aplicación ya puede pintarse. La consulta va después, en segundo plano, y solo si la
// persona no la desactivó y ya vio el aviso (FR-003, FR-015).
export const initLivePrompts = () => {
  if (started) return;
  started = true;

  const saved = getSavedPackage();
  if (saved) {
    // La copia guardada se revalida: pudo escribirla una versión anterior de la herramienta
    // o alterarse en el navegador.
    const result = validatePackage(saved.pkg);
    if (result.ok) {
      setState({ pkg: result.pkg, source: 'saved', fetchedAt: saved.fetchedAt || null });
    } else {
      clearSavedPackage();
    }
  }

  if (state.enabled && state.noticeSeen) refresh();
};

// --- Consulta ---

let inFlight = null;

const failure = (reason, details = []) => {
  const result = { status: 'failed', reason, details, at: new Date().toISOString() };
  setState({ status: 'idle', lastResult: result });
  if (details.length) console.warn('[prompts] paquete descartado:', details);
  return result;
};

const classifyFetchError = (error) =>
  error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network';

const download = async (manual) => {
  let response;
  try {
    response = await fetch(PROMPTS_SOURCE_URL, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      // «Buscar ahora» pide revalidar; al abrir basta la caché normal del navegador.
      cache: manual ? 'no-cache' : 'default',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    return { reason: classifyFetchError(error) };
  }

  if (response.status === 404) return { reason: 'not_found' };
  if (!response.ok) return { reason: 'http' };
  if (response.url && new URL(response.url).origin !== SOURCE_ORIGIN) return { reason: 'bad_origin' };
  if (Number(response.headers.get('content-length')) > MAX_BYTES) return { reason: 'too_big' };

  try {
    return { text: await response.text() };
  } catch (error) {
    return { reason: classifyFetchError(error) };
  }
};

const doRefresh = async (manual) => {
  if (!state.enabled) return { status: 'failed', reason: 'disabled', details: [], at: new Date().toISOString() };

  setState({ status: 'checking' });

  const { text, reason } = await download(manual);
  if (reason) return failure(reason);

  const parsed = parsePackage(text);
  if (!parsed.ok) return failure(parsed.reason, parsed.details);

  const { pkg } = parsed;
  const at = new Date().toISOString();

  // Una versión anterior a la guardada también se acepta: lo publicado manda, y así el
  // director puede deshacer un cambio publicando la versión anterior (D13).
  const changed = pkg.version !== state.pkg.version;
  setSavedPackage(pkg, at);

  const result = { status: changed ? 'updated' : 'up_to_date', version: pkg.version, at };
  setState({
    pkg: changed ? pkg : state.pkg,
    source: 'remote',
    fetchedAt: at,
    status: 'idle',
    lastResult: result,
    noteVersion: changed && pkg.version !== promptsNoteSeen() ? pkg.version : state.noteVersion
  });
  return result;
};

// Una consulta a la vez: si ya hay una en curso, se devuelve la misma.
export const refresh = ({ manual = false } = {}) => {
  if (!inFlight) inFlight = doRefresh(manual).finally(() => { inFlight = null; });
  return inFlight;
};

// --- Decisiones de la persona ---

// «Entendido» en el aviso de primera vez: desde aquí empieza a consultarse.
export const acceptNotice = () => {
  markPromptsNoticeSeen();
  setState({ noticeSeen: true });
  if (state.enabled) refresh();
};

// «No consultar» en el aviso: queda desactivada y el aviso no vuelve a salir.
export const declineNotice = () => {
  markPromptsNoticeSeen();
  setRemotePromptsEnabled(false);
  setState({ noticeSeen: true, enabled: false });
};

export const setRemoteEnabled = (enabled) => {
  setRemotePromptsEnabled(enabled);
  setState({ enabled });
  if (enabled && state.noticeSeen) refresh();
};

// Descarta lo descargado y vuelve a la copia incluida (FR-017). Si la consulta sigue
// activada, la próxima vez que se abra volverá a buscar novedades.
export const resetToBundled = () => {
  clearSavedPackage();
  setState({ pkg: bundled, source: 'bundled', fetchedAt: null, lastResult: null, noteVersion: null });
};

// --- Nota de «qué cambió» ---

export const getPendingNote = () =>
  state.noteVersion && state.noteVersion === state.pkg.version && state.pkg.notes
    ? { version: state.pkg.version, notes: state.pkg.notes }
    : null;

export const dismissNote = () => {
  if (state.noteVersion) markPromptsNoteSeen(state.noteVersion);
  setState({ noteVersion: null });
};
