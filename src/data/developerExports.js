import { buildDeliveryRows } from './deliveryRows.js';
import { writeXlsx } from './xlsxWriter.js';

// Herramientas de exportación directa para programadores y diseñadores de audio.
//
// Permite a los desarrolladores obtener sus especificaciones, copiar prompts
// para generadores de audio externos (Suno, Udio, ElevenLabs) y generar el
// HTML interactivo de entrega sin depender de comandos en la terminal.

export const downloadFile = (filename, content, mimeType = 'application/json') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Descarga un Blob que ya existe (por ejemplo el audio generado), sin volver a
// codificarlo. La dirección temporal se libera pasado un momento.
export const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// 1. Manifiesto completo en JSON (incluye prompts, notas y parámetros técnicos)
export const downloadFullProjectJSON = (project) => {
  if (!project) return;
  const nameSlug = (project.name || 'juego').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const payload = {
    gameName: project.name,
    gameType: project.type || 'Slot',
    exportedAt: new Date().toISOString(),
    config: project.config || {},
    analysis: project.analysis || null,
    sounds: project.sounds || []
  };
  downloadFile(`${nameSlug}_lista_completa.json`, JSON.stringify(payload, null, 2));
};

// 2. Manifiesto limpio para motores de juego (Godot, Unity, Pixi, Phaser)
export const downloadEngineManifest = (project) => {
  if (!project) return;
  const nameSlug = (project.name || 'juego').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const events = {};
  const sounds = (project.sounds || []).filter(s => s.category !== 'MIX');

  for (const s of sounds) {
    events[s.game_event] = {
      file: s.official_filename,
      category: s.category,
      duration: Number(s.duration_seconds) + (Number(s.tail_seconds) || 0),
      loop: Boolean(s.loop),
      priority: s.priority || 'medium',
      audioSource: s.audioSource || ''
    };
  }

  const payload = {
    game: project.name,
    type: project.type || 'Slot',
    version: '1.0.0',
    totalSounds: sounds.length,
    events
  };
  downloadFile(`${nameSlug}_engine_manifest.json`, JSON.stringify(payload, null, 2));
};

// 3. Copiar todos los prompts en formato estructurado para batch en generadores de IA
export const copyPromptsToClipboard = async (sounds = []) => {
  const validSounds = sounds.filter(s => s.category !== 'MIX' && s.prompt && s.prompt.trim());
  if (!validSounds.length) {
    throw new Error('No hay prompts válidos para copiar.');
  }

  const lines = validSounds.map(s => {
    const dur = s.duration_seconds ? `[${s.duration_seconds}s${s.loop ? ' loop' : ''}]` : '';
    return `# ${s.id} · ${s.official_filename} ${dur}\n# Evento: ${s.game_event}\n${s.prompt}\n`;
  });

  const fullText = lines.join('\n---\n\n');
  await navigator.clipboard.writeText(fullText);
  return validSounds.length;
};

// Estilos del documento de entrega. Se conservan los del entregable anterior.
const CSS = `
:root {
  color-scheme: dark light;
  --fondo:#0D1310; --fondo-2:#121A16; --panel:#16201B; --panel-2:#1B2721;
  --linea:#27352C; --linea-fuerte:#3A4C3F;
  --tinta:#E9F1EA; --tinta-2:#A2B4A7; --tinta-3:#728278;
  --ambar:#F3C63F; --ambar-hondo:#B08C11;
  --listo:#5FD98A;
  --sobre-ambar:#0D1310;
  --radio:9px;
  --display:"Avenir Next Condensed","HelveticaNeue-CondensedBold","Roboto Condensed","Arial Narrow",sans-serif;
  --texto:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
* { box-sizing:border-box; }
body { margin:0; background:var(--fondo); color:var(--tinta); font-family:var(--texto); line-height:1.55; }
.envoltura { max-width:1020px; margin:0 auto; padding:2rem 1.25rem 4rem; position:relative; z-index:1; }
.cabecera { border-bottom:2px solid var(--ambar-hondo); padding-bottom:1.2rem; }
.sobretitulo { font-family:var(--display); font-size:.75rem; letter-spacing:.24em; text-transform:uppercase; color:var(--ambar); margin:0 0 .3rem; font-weight:600; }
h1 { font-family:var(--display); font-size:clamp(2.1rem,6.5vw,3.4rem); line-height:.92; margin:0; font-weight:700; }
.subtitulo { color:var(--tinta-2); margin:.65rem 0 0; max-width:62ch; font-size:.95rem; }
.entrega { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; background:var(--panel); border:1px solid var(--linea); border-radius:var(--radio); padding:.9rem 1.1rem; margin:1.25rem 0 0; }
.entrega .cifra { font-family:var(--display); font-size:1.9rem; font-weight:700; color:var(--listo); font-variant-numeric:tabular-nums; }
.entrega .rotulo { font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:var(--tinta-3); }
.entrega .fecha { font-size:.85rem; color:var(--tinta-2); margin-left:auto; }
.aviso { background:var(--panel); border:1px solid var(--linea); border-left:3px solid var(--ambar); border-radius:var(--radio); padding:.9rem 1.1rem; margin:1.5rem 0 0; }
.aviso h3 { font-family:var(--display); font-size:.9rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ambar); margin:0 0 .5rem; font-weight:600; }
.aviso p { margin:0 0 .5rem; font-size:.9rem; color:var(--tinta-2); max-width:72ch; }
.aviso strong { color:var(--tinta); }
.controles { position:sticky; top:0; z-index:5; background:var(--fondo); padding:.85rem 0; border-bottom:1px solid var(--linea); display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; margin:1.5rem 0 .25rem; }
.chip { font-family:var(--display); font-size:.82rem; letter-spacing:.09em; text-transform:uppercase; background:transparent; color:var(--tinta-2); border:1px solid var(--linea); border-radius:999px; padding:.3rem .8rem; cursor:pointer; font-weight:600; }
.chip:hover { border-color:var(--ambar-hondo); color:var(--tinta); }
.chip[aria-pressed="true"] { background:var(--ambar); border-color:var(--ambar); color:var(--sobre-ambar); }
.chip .n { opacity:.62; margin-left:.35rem; }
.buscador { flex:1; min-width:170px; background:var(--panel); border:1px solid var(--linea); color:var(--tinta); border-radius:999px; padding:.42rem .95rem; font-family:var(--texto); font-size:.9rem; }
h2.grupo { font-family:var(--display); font-size:1.05rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ambar); margin:1.9rem 0 .5rem; font-weight:600; display:flex; gap:.6rem; align-items:baseline; }
h2.grupo small { font-family:var(--texto); font-size:.78rem; letter-spacing:0; text-transform:none; color:var(--tinta-3); font-weight:400; }
.lista { display:flex; flex-direction:column; gap:.4rem; }
.fila { background:var(--panel); border:1px solid var(--linea); border-radius:var(--radio); padding:.7rem .9rem; display:grid; grid-template-columns:1fr auto; gap:.5rem 1rem; align-items:center; }
.archivo { font-family:var(--mono); font-size:.98rem; font-weight:600; color:var(--tinta); }
.cuando { font-size:.86rem; color:var(--tinta-2); margin:.15rem 0 0; }
.marcas { display:flex; gap:.35rem; flex-wrap:wrap; margin:.3rem 0 0; }
.marca { font-size:.68rem; letter-spacing:.06em; text-transform:uppercase; border:1px solid var(--linea); border-radius:999px; padding:.1rem .5rem; color:var(--tinta-3); }
.marca.bucle { color:var(--ambar); border-color:var(--ambar-hondo); }
.descargar { font-family:var(--display); font-size:.8rem; letter-spacing:.1em; text-transform:uppercase; background:var(--listo); color:var(--sobre-ambar); border:1px solid var(--listo); border-radius:999px; padding:.35rem .95rem; font-weight:600; text-decoration:none; white-space:nowrap; }
.descargar:hover { filter:brightness(1.1); }
.vacio { color:var(--tinta-3); font-size:.9rem; padding:2rem 0; text-align:center; }
.pie { margin-top:2.5rem; padding-top:1.2rem; border-top:1px solid var(--linea); color:var(--tinta-3); font-size:.82rem; }
.marca.pendiente { color:var(--ambar); border-color:var(--ambar-hondo); }
.abrir { font-family:var(--display); font-size:.8rem; letter-spacing:.1em; text-transform:uppercase; background:var(--listo); color:var(--sobre-ambar); border:1px solid var(--listo); border-radius:999px; padding:.35rem .95rem; font-weight:600; text-decoration:none; white-space:nowrap; }
.abrir:hover { filter:brightness(1.1); }
.cuenta { font-size:.85rem; color:var(--tinta-2); }
`;

// 4. Documento de entrega para el equipo del videojuego (feature 010).
//
// Es un archivo suelto: se abre en cualquier navegador sin la herramienta, sin
// conexión a ningún servicio del estudio y sin cuentas. Solo los enlaces a Drive
// dependen de Drive, y es Drive quien decide quién los abre.
//
// Presenta lo que la persona REGISTRÓ, no una confirmación: no dice que algo esté
// aprobado, entregado ni integrado (Principio 6).

const ZONAS = [
  ['UI',  'Interfaz',   'Botonera, paneles y barra superior'],
  ['MEC', 'Mecánicas',  'Carretes, contador y la feature'],
  ['SYM', 'Símbolos',   'Lo que suena cuando un símbolo paga'],
  ['STG', 'Premios',    'Apertura, multiplicador y los niveles'],
  ['FX',  'Transición', 'Entre pantallas'],
  ['BGM', 'Música',     'Las camas'],
  ['AMB', 'Ambientes',  'Lechos continuos'],
  ['VO',  'Voz',        'Voz autorizada']
];

const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const slugOf = (name, separator) =>
  (name || 'juego').toLowerCase().replace(/[^a-z0-9]+/g, separator).replace(new RegExp(`^${separator}|${separator}$`, 'g'), '') || 'juego';

const todayLabel = () =>
  new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// `ids` limita el documento a los sonidos elegidos; sin él entra todo.
export const downloadEntregaHTML = (project, ids = null) => {
  if (!project) return;

  const rows = buildDeliveryRows(project, ids);
  const json = JSON.stringify({ sonidos: rows, zonas: ZONAS, fecha: todayLabel() })
    .replace(/</g, '\\u003c');
  const nombre = escapeHtml(project.name || 'Juego');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${nombre} · Sonidos</title>
<style>__CSS__</style>
</head>
<body>
<div class="envoltura">
  <header class="cabecera">
    <p class="sobretitulo">Solvers · Audio</p>
    <h1>${nombre}</h1>
    <p class="subtitulo">Lista de sonidos del juego y dónde está cada uno.</p>
    <div class="entrega">
      <div><div class="cifra" id="cifra">0</div><div class="rotulo">Sonidos en esta lista</div></div>
      <div class="cuenta" id="cuenta"></div>
      <div class="fecha" id="fecha"></div>
    </div>
  </header>

  <div class="aviso">
    <h3>Cómo leer esta lista</h3>
    <p>Muestra los sonidos que quien los produjo ha <strong>registrado</strong>, con el enlace donde los guardó. <strong>No confirma</strong> que estén aprobados ni integrados en el juego.</p>
    <p>Un sonido marcado como <strong>pendiente</strong> existe en la lista, pero todavía no tiene archivo registrado. Los enlaces se abren con la cuenta que Drive permita.</p>
  </div>

  <div class="controles" role="group" aria-label="Filtros">
    <div id="chips" style="display:flex;gap:.4rem;flex-wrap:wrap;"></div>
    <input class="buscador" id="buscador" type="search" placeholder="Buscar archivo o momento…" aria-label="Buscar">
  </div>

  <main id="salida"></main>

  <footer class="pie">
    <p>Generado con Sonidos Dashboard.</p>
  </footer>
</div>

<script id="datos" type="application/json">${json}</script>
<script>
const D = JSON.parse(document.getElementById('datos').textContent);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const conEnlace = D.sonidos.filter(s => !s.pendiente).length;
document.getElementById('cifra').textContent = D.sonidos.length;
document.getElementById('cuenta').textContent = conEnlace + ' con enlace · ' + (D.sonidos.length - conEnlace) + ' pendientes';
document.getElementById('fecha').textContent = D.fecha;

let filtro = 'todo', busca = '';
const cuenta = (k) => k === 'todo' ? D.sonidos.length : D.sonidos.filter(s => s.zona === k).length;
document.getElementById('chips').innerHTML =
  ['<button class="chip" type="button" data-k="todo" aria-pressed="true">Todo<span class="n">' + D.sonidos.length + '</span></button>']
    .concat(D.zonas.filter(z => cuenta(z[0])).map(z =>
      '<button class="chip" type="button" data-k="' + z[0] + '" aria-pressed="false">' + z[1] +
      '<span class="n">' + cuenta(z[0]) + '</span></button>')).join('');

const accion = (s) => {
  if (s.enlaceAbrible) {
    return '<a class="abrir" href="' + esc(s.enlace) + '" target="_blank" rel="noopener noreferrer">Abrir</a>';
  }
  if (s.enlace) {
    return '<span class="marca" title="' + esc(s.enlace) + '">Ruta local, no se puede abrir desde aquí</span>';
  }
  return '<span class="marca pendiente">Pendiente</span>';
};

const pintar = () => {
  const q = busca.trim().toLowerCase();
  const lista = D.sonidos.filter(s => {
    if (filtro !== 'todo' && s.zona !== filtro) return false;
    if (!q) return true;
    return s.archivo.toLowerCase().includes(q) || s.cuando.toLowerCase().includes(q) || s.evento.toLowerCase().includes(q);
  });
  if (!lista.length) {
    document.getElementById('salida').innerHTML = '<p class="vacio">No hay ningún sonido que coincida con la búsqueda.</p>';
    return;
  }
  const porZona = {};
  for (const s of lista) { (porZona[s.zona] = porZona[s.zona] || []).push(s); }
  let html = '';
  for (const [z, nombre, desc] of D.zonas) {
    const grupo = porZona[z];
    if (!grupo || !grupo.length) continue;
    html += '<section><h2 class="grupo">' + esc(nombre) + ' <small>· ' + esc(desc) + '</small></h2><div class="lista">';
    for (const s of grupo) {
      const dur = s.duracion ? s.duracion + ' s' : '';
      const b = s.loop ? '<span class="marca bucle">Loop</span>' : '';
      const d = dur ? '<span class="marca">' + esc(dur) + '</span>' : '';
      html += '<article class="fila"><div class="datos">' +
        '<span class="archivo">' + esc(s.archivo) + '</span>' +
        '<p class="cuando">' + esc(s.cuando) + '</p>' +
        '<div class="marcas">' + d + b + '</div>' +
        '</div><div class="accion">' + accion(s) + '</div></article>';
    }
    html += '</div></section>';
  }
  document.getElementById('salida').innerHTML = html;
};

document.getElementById('chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', 'true');
  filtro = b.dataset.k;
  pintar();
});
document.getElementById('buscador').addEventListener('input', (e) => { busca = e.target.value; pintar(); });
pintar();
</script>
</body>
</html>`;

  downloadFile(`${slugOf(project.name, '-')}_entrega.html`, html.replace('__CSS__', () => CSS), 'text/html;charset=utf-8');
};

// La misma lista, en hoja de cálculo. Una fila por sonido; el enlace es pulsable
// cuando es una dirección web, y la ruta local se muestra como texto.
export const downloadEntregaXLSX = (project, ids = null) => {
  if (!project) return;

  const rows = buildDeliveryRows(project, ids).map(r => [
    r.archivo,
    r.zona,
    r.cuando,
    r.duracion,
    r.loop ? 'Sí' : '',
    r.enlaceAbrible ? { text: 'Abrir', link: r.enlace } : (r.enlace || 'Pendiente')
  ]);

  const blob = writeXlsx({
    sheetName: 'Sonidos',
    headers: ['Archivo', 'Zona', 'Cuándo suena', 'Duración (s)', 'Loop', 'Enlace'],
    rows,
    widths: [34, 8, 56, 13, 8, 40]
  });

  downloadBlob(`${slugOf(project.name, '-')}_entrega.xlsx`, blob);
};
