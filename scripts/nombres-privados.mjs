// Nombres de proyectos y clientes reales del estudio, para comprobar que no se cuelan en
// nada que se publique (feature 011).
//
// No hay ninguna lista en el código: viajaría con él. Los nombres se leen, en el momento de
// ejecutar, de lo que ya está en analisis/ (que nunca se publica):
//   · el nombre de cada carpeta de análisis;
//   · el nombre del juego en cada lista maestra (gameAnalysis.name);
//   · analisis/nombres-privados.txt, uno por línea, para clientes sin carpeta propia.
//
// Si analisis/ no existe (un clon público), no hay nada que comprobar: se dice y se sigue.

import fs from 'node:fs';
import path from 'node:path';

// Minúsculas, sin acentos y con guiones y barras bajas como espacios: así «mi-juego»,
// «Mi Juego» y «mi_juego» son el mismo nombre.
export const normalizar = (texto) =>
  String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const MIN_LARGO = 4;

export const leerNombresPrivados = (raiz) => {
  const carpeta = path.join(raiz, 'analisis');
  if (!fs.existsSync(carpeta)) return { hayAnalisis: false, nombres: [] };

  const nombres = new Set();
  const añadir = (n) => {
    const limpio = normalizar(n);
    if (limpio.length >= MIN_LARGO) nombres.add(limpio);
  };

  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    añadir(entrada.name);
    for (const archivo of fs.readdirSync(path.join(carpeta, entrada.name))) {
      if (!/^lista-maestra.*\.json$/.test(archivo)) continue;
      try {
        const datos = JSON.parse(fs.readFileSync(path.join(carpeta, entrada.name, archivo), 'utf8'));
        if (datos?.gameAnalysis?.name) añadir(datos.gameAnalysis.name);
      } catch {
        // Una lista que no se puede leer no impide comprobar las demás.
      }
    }
  }

  const extra = path.join(carpeta, 'nombres-privados.txt');
  if (fs.existsSync(extra)) {
    fs.readFileSync(extra, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(añadir);
  }

  return { hayAnalisis: true, nombres: [...nombres].sort() };
};

// Los nombres de la lista que aparecen en el texto, como palabra completa.
export const buscarNombres = (texto, nombres) => {
  const plano = normalizar(texto);
  return nombres.filter(n => new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(plano));
};
