#!/usr/bin/env node
//
// Comprueba el paquete de prompts antes de publicarlo o compilarlo (feature 011).
//
//   node scripts/validar-paquete.mjs            valida prompts/paquete.json
//   node scripts/validar-paquete.mjs --probar   además, lo ataca con variantes hostiles
//
// Usa EXACTAMENTE la misma validación que la herramienta (src/data/promptPackage.js): lo que
// aquí pasa, pasa en el navegador de cada compañero, y al revés.
//
// Además de la validación, comprueba lo que la herramienta no puede saber estando en el
// navegador: que el texto de las instrucciones siga listando las mismas categorías,
// prioridades y perfiles que el código, y que el paquete no nombre ningún proyecto o cliente
// real (esto último solo si existe analisis/, que nunca se publica).
//
// ACORDARSE: si el código cambia de forma incompatible con lo que un paquete puede traer
// (un marcador nuevo, otro formato de respuesta), hay que subir APP_LEVEL o los formatos
// admitidos en src/data/promptPackage.js. Un clon antiguo ignorará entonces los paquetes
// nuevos y avisará de que hay que actualizar la copia.
//
// Sale con código distinto de 0 si algo falla; `npm run build` lo ejecuta antes de compilar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePackage,
  fillSystemTemplate,
  SYSTEM_PLACEHOLDERS,
  MAX_PACKAGE_BYTES
} from '../src/data/promptPackage.js';
import { CATEGORY_KEYS, PRIORITIES, TECHNICAL_PROFILES } from '../src/data/soundModel.js';
import { evaluateScope } from '../src/data/gameProfiles.js';
import { leerNombresPrivados, buscarNombres } from './nombres-privados.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivo = path.join(raiz, 'prompts', 'paquete.json');

let fallos = 0;
const falla = (mensaje) => { fallos++; console.error(`  ✗ ${mensaje}`); };
const bien = (mensaje) => console.log(`  ✓ ${mensaje}`);

// --- 1. Validación y coherencia del paquete real ---

const validar = () => {
  console.log(`Paquete: ${path.relative(raiz, archivo)}`);
  const texto = fs.readFileSync(archivo, 'utf8');
  const resultado = parsePackage(texto);

  if (!resultado.ok) {
    falla(`el paquete es inválido (${resultado.reason}):`);
    resultado.details.forEach(d => console.error(`      ${d}`));
    return null;
  }
  const { pkg } = resultado;
  const prompts = pkg.catalog.reduce((n, c) => n + c.prompts.length, 0);
  bien(`válido · versión ${pkg.version} · ${pkg.catalog.length} categorías, ${prompts} prompts`);
  bien(`listas base: ${Object.entries(pkg.templates).map(([g, l]) => `${g} ${l.length}`).join(', ')}`);

  comprobarEnumeraciones(pkg.analysis.systemTemplate);
  avisarAlcance(pkg);
  comprobarNombres(texto);
  return pkg;
};

// El texto de las instrucciones enumera valores que el código también conoce. Si los dos se
// separan, el modelo recibiría una categoría que la herramienta no acepta.
const comprobarEnumeraciones = (plantilla) => {
  const enumeraciones = [
    ['category', CATEGORY_KEYS],
    ['priority', PRIORITIES],
    ['technical_profile', TECHNICAL_PROFILES.map(p => p.key)]
  ];
  for (const [campo, claves] of enumeraciones) {
    const linea = plantilla.match(new RegExp(`"${campo}" is one of: ([^\\n]+)`))?.[1];
    if (!linea) { falla(`las instrucciones no enumeran «${campo}».`); continue; }
    const escritas = linea.replace(/\.$/, '').split(',').map(s => s.trim());
    const sobran = escritas.filter(c => !claves.includes(c));
    const faltan = claves.filter(c => !escritas.includes(c));
    if (sobran.length || faltan.length) {
      falla(`«${campo}» en las instrucciones no coincide con el código (sobran: ${sobran.join(', ') || '—'}; faltan: ${faltan.join(', ') || '—'}).`);
    } else {
      bien(`«${campo}» coincide con el código`);
    }
  }
  const sinPrefijo = CATEGORY_KEYS.filter(k => !plantilla.includes(`${k}_`));
  if (sinPrefijo.length) falla(`las instrucciones no mencionan los prefijos: ${sinPrefijo.map(k => `${k}_`).join(', ')}.`);
  else bien('los nueve prefijos aparecen en las instrucciones');
};

// Aviso, no bloqueo: una lista base fuera del rango del perfil da un alcance incoherente.
const avisarAlcance = (pkg) => {
  for (const [genero, lista] of Object.entries(pkg.templates)) {
    const e = evaluateScope(genero, 'standard', lista.length);
    if (e.level !== 'ok') console.log(`  ! aviso · ${genero}: ${e.message}`);
  }
};

const comprobarNombres = (texto) => {
  const { hayAnalisis, nombres } = leerNombresPrivados(raiz);
  if (!hayAnalisis) {
    console.log('  · sin analisis/: se omite la comprobación de nombres de proyectos reales');
    return;
  }
  const hallados = buscarNombres(texto, nombres);
  if (hallados.length) falla(`el paquete nombra proyectos o clientes reales: ${hallados.join(', ')}.`);
  else bien(`ningún nombre real (${nombres.length} comprobados)`);
};

// --- 2. Autoprueba hostil ---
//
// Fabrica variantes del paquete válido y exige que cada una sea rechazada, o aceptada
// cuando debe serlo, con el motivo esperado.

const probar = (pkg, textoOriginal) => {
  console.log('\nAutoprueba hostil');
  const clonar = () => JSON.parse(textoOriginal);
  const primera = (p, prefijo) => p.catalog.flatMap(c => c.prompts.map(x => ({ c, x }))).find(({ x }) => x.categoria_prefijo === prefijo);

  const rechazados = [
    ['falta la versión', 'invalid_content', p => { delete p.version; }],
    ['falta formatVersion', 'bad_shape', p => { delete p.formatVersion; }],
    ['formatVersion futuro', 'needs_newer_app', p => { p.formatVersion = 2; }],
    ['appLevel futuro', 'needs_newer_app', p => { p.appLevel = 99; }],
    ['responseFormat desconocido', 'unsupported_response_format', p => { p.responseFormat = 99; }],
    ['fecha imposible', 'invalid_content', p => { p.publishedAt = '2026-13-45'; }],
    ['catálogo vacío', 'invalid_content', p => { p.catalog = []; }],
    ['categoría sin prompts', 'invalid_content', p => { p.catalog[0].prompts = []; }],
    ['listas base ausentes', 'invalid_content', p => { delete p.templates; }],
    ['género inexistente', 'invalid_content', p => { p.templates.Inventado = p.templates.Slot; }],
    ['prefijo de nomenclatura desconocido', 'invalid_content', p => { p.catalog[0].prompts[0].categoria_prefijo = 'ZZ'; }],
    ['perfil técnico desconocido', 'invalid_content', p => { p.catalog[0].profile = 'humedo'; }],
    ['BGM con zero reverb', 'invalid_content', p => { const { x } = primera(p, 'BGM'); x.texto += ' Completely dry, zero reverb.'; }],
    ['BGM con perfil seco', 'invalid_content', p => { primera(p, 'BGM').c.profile = 'dry'; }],
    ['fórmula con menos de cinco componentes', 'invalid_content', p => { const { x } = primera(p, 'UI'); x.duracion = '0.2 s'; x.texto = '0.2 seconds. Click. Clean.'; }],
    ['sin tratamiento técnico', 'invalid_content', p => { const { x } = primera(p, 'UI'); x.duracion = '0.2 s'; x.texto = '0.2 seconds. Uno. Dos. Tres. Cuatro. Cinco. Seis.'; }],
    ['sin duración al inicio', 'invalid_content', p => { const { x } = primera(p, 'UI'); x.texto = 'Click. ' + x.texto; }],
    ['etiqueta de duración distinta del texto', 'invalid_content', p => { primera(p, 'UI').x.duracion = '9.9 s'; }],
    ['cama cuya duración no coincide con su etiqueta', 'invalid_content', p => { const { x } = primera(p, 'BGM'); x.texto = x.texto.replace(/[\d.]+ seconds seamless loop/, '9.9 seconds seamless loop'); }],
    ['prompt demasiado largo', 'invalid_content', p => { primera(p, 'UI').x.texto += ' x'.repeat(3000); }],
    ['id no continuo', 'invalid_content', p => { p.templates.Slot[1].id = '009'; }],
    ['nombre oficial inválido', 'invalid_content', p => { p.templates.Slot[0].official_filename = 'Nombre malo.wav'; }],
    ['prioridad desconocida', 'invalid_content', p => { p.templates.Slot[0].priority = 'urgente'; }],
    ['marcador duplicado', 'invalid_content', p => { p.analysis.systemTemplate += ' {{GENRE_BRIEF}}'; }],
    ['marcador ausente', 'invalid_content', p => { p.analysis.systemTemplate = p.analysis.systemTemplate.replace('{{TECHNICAL_BRIEF}}', ''); }],
    ['marcador que no existe', 'invalid_content', p => { p.analysis.systemTemplate += ' {{OTRO}}'; }],
    ['mensaje de descripción sin marcador', 'invalid_content', p => { p.analysis.descriptionTemplate = 'Sin marcador'; }]
  ];

  for (const [nombre, motivo, mutar] of rechazados) {
    const p = clonar();
    mutar(p);
    const r = parsePackage(JSON.stringify(p));
    if (r.ok) falla(`se aceptó «${nombre}»`);
    else if (r.reason !== motivo) falla(`«${nombre}»: se rechazó, pero por ${r.reason} y se esperaba ${motivo}`);
    else bien(`rechaza ${nombre}`);
  }

  const crudos = [
    ['JSON roto', 'not_json', textoOriginal.slice(0, -7)],
    ['más de 2 MB', 'too_big', textoOriginal + ' '.repeat(MAX_PACKAGE_BYTES)],
    ['no es un objeto', 'bad_shape', '[1, 2, 3]']
  ];
  for (const [nombre, motivo, texto] of crudos) {
    const r = parsePackage(texto);
    if (r.ok || r.reason !== motivo) falla(`«${nombre}»: esperaba ${motivo} y fue ${r.ok ? 'aceptado' : r.reason}`);
    else bien(`rechaza ${nombre}`);
  }

  // Lo que SÍ debe aceptarse: el contenido es dato, aunque parezca código.
  const original = parsePackage(textoOriginal);
  if (original.ok) bien('acepta el paquete original'); else falla('rechazó el paquete original');

  // Una cama abre con la escena y puede no llevar duración (03 §12): eso es válido.
  const sinDuracion = clonar();
  const cama = primera(sinDuracion, 'BGM');
  cama.x.texto = cama.x.texto.replace(/[\d.]+ seconds seamless loop\. /, '');
  const rs = parsePackage(JSON.stringify(sinDuracion));
  if (!rs.ok) falla(`rechazó una cama sin duración, que es válida: ${rs.details[0]}`);
  else bien('acepta una cama que abre con la escena y no lleva duración');

  const hostil = clonar();
  const carga = '<script>alert(1)</script> "onerror=x\' ${1+1} $& `';
  hostil.notes = carga;
  hostil.catalog[0].reglas = carga;
  hostil.catalog[0].prompts[0].nombre = carga.slice(0, 80);
  hostil.templates.Slot[0].usage = carga;
  const r = parsePackage(JSON.stringify(hostil));
  if (!r.ok) falla(`rechazó texto con etiquetas, que es dato válido: ${r.details[0]}`);
  else if (r.pkg.notes !== carga || r.pkg.templates.Slot[0].usage !== carga) falla('alteró el texto hostil en lugar de conservarlo literal');
  else bien('conserva literal el texto con etiquetas y comillas (se muestra, no se ejecuta)');

  const sucio = textoOriginal.replace(/^\{/, '{"__proto__":{"contaminado":true},"constructor":{"x":1},');
  const rp = parsePackage(sucio);
  if (!rp.ok) falla('rechazó un paquete con __proto__, que debía ignorarse');
  else if (Object.hasOwn(rp.pkg, '__proto__') || ({}).contaminado || Object.hasOwn(rp.pkg, 'constructor')) falla('el campo __proto__ se coló');
  else bien('ignora __proto__ y campos desconocidos');

  if (!Object.isFrozen(original.pkg) || !Object.isFrozen(original.pkg.catalog[0].prompts[0])) falla('el paquete aceptado no es inmutable');
  else bien('el paquete aceptado es inmutable');

  const rellenado = fillSystemTemplate('A {{GENRE_BRIEF}} B {{DISCOVERY_BRIEF}} C {{OTRO}}', {
    GENRE_BRIEF: 'x $& y {{DISCOVERY_BRIEF}} $1',
    DISCOVERY_BRIEF: 'd'
  });
  if (rellenado !== 'A x $& y {{DISCOVERY_BRIEF}} $1 B d C {{OTRO}}') falla(`fillSystemTemplate interpretó un patrón: «${rellenado}»`);
  else bien('rellena las plantillas sin interpretar patrones ni volver a sustituir');

  if (SYSTEM_PLACEHOLDERS.length !== 4) falla('cambió el número de marcadores del prompt de sistema; revisa las plantillas');
};

// --- Ejecución ---

const pkg = validar();
if (process.argv.includes('--probar') && pkg) probar(pkg, fs.readFileSync(archivo, 'utf8'));

console.log(fallos ? `\n✗ ${fallos} problema${fallos > 1 ? 's' : ''}.` : '\n✓ Todo en orden.');
process.exit(fallos ? 1 : 0);
