// Credenciales y sesión del equipo del juego.
//
// Todo con crypto.subtle, que el runtime de Vercel expone como global: una
// dependencia menos que auditar para tres usuarios y una contraseña.
//
// La constitución (Artículo X, desde 2.1.0) exige que las credenciales se
// definan en la configuración del despliegue y nunca en el repositorio, que no
// se guarden en claro y que no viajen al navegador. Aquí se cumple así:
//   · La contraseña se compara contra un PBKDF2 guardado en TEAM_PASSWORD_HASH.
//   · La sesión es una cookie firmada; el servidor no guarda nada.

const ITERACIONES = 100_000;
const enc = new TextEncoder();

const aHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

const deHex = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

// Comparación en tiempo constante: un `===` sobre cadenas termina en el primer
// carácter distinto y filtra cuánto acertó quien lo intenta.
const igualdadConstante = (a, b) => {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
};

export const derivar = async (clave, salHex) => {
  const material = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: deHex(salHex), iterations: ITERACIONES, hash: 'SHA-256' },
    material,
    256
  );
  return aHex(bits);
};

// Formato guardado: "sal$hash", ambos en hexadecimal.
export const verificarClave = async (clave, guardado) => {
  const [sal, hash] = String(guardado || '').split('$');
  if (!sal || !hash) return false;
  return igualdadConstante(await derivar(clave, sal), hash);
};

export const generarHash = async (clave) => {
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)));
  return `${sal}$${await derivar(clave, sal)}`;
};

// --- Miembros del equipo ---
//
// TEAM_MEMBERS = "hans:Hans,eddie:Eddie,juan:Juan"

export const miembros = () =>
  String(process.env.TEAM_MEMBERS || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const [usuario, nombre] = x.split(':');
      return { usuario: usuario.trim().toLowerCase(), nombre: (nombre || usuario).trim() };
    });

export const buscarMiembro = (usuario) =>
  miembros().find(m => m.usuario === String(usuario || '').trim().toLowerCase()) || null;

// --- Sesión ---
//
// La cookie es "usuario.emitidoEn.firma". Sin estado en el servidor: se verifica
// recalculando el HMAC. No caduca por tiempo (FR-006); se cierra vaciándola.

const firmar = async (texto) => {
  const secreto = process.env.TEAM_SESSION_SECRET;
  if (!secreto) throw new Error('TEAM_SESSION_SECRET sin definir');
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return aHex(await crypto.subtle.sign('HMAC', key, enc.encode(texto)));
};

export const crearSesion = async (usuario) => {
  const cuerpo = `${usuario}.${Date.now()}`;
  return `${cuerpo}.${await firmar(cuerpo)}`;
};

export const leerSesion = async (cookieHeader) => {
  const bruto = String(cookieHeader || '')
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('team_session='));
  if (!bruto) return null;

  const valor = decodeURIComponent(bruto.slice('team_session='.length));
  const partes = valor.split('.');
  if (partes.length !== 3) return null;

  const [usuario, emitidoEn, firma] = partes;
  let esperada;
  try {
    esperada = await firmar(`${usuario}.${emitidoEn}`);
  } catch {
    return null;
  }
  if (!igualdadConstante(firma, esperada)) return null;

  // Que la firma sea válida no basta: si el director quitó a alguien del equipo,
  // su cookie deja de servir en la siguiente petición.
  return buscarMiembro(usuario);
};

export const cookieSesion = (valor) => {
  const base = 'team_session=' + encodeURIComponent(valor) + '; Path=/; HttpOnly; SameSite=Lax; Secure';
  return valor ? `${base}; Max-Age=31536000` : `${base}; Max-Age=0`;
};
