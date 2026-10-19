#!/usr/bin/env node
//
// Genera el valor de TEAM_PASSWORD_HASH para la vista de entrega del equipo.
//
//   node scripts/hash-clave.mjs
//
// La contraseña se escribe cuando el script la pide, no como argumento: un
// argumento queda en el historial del shell y en la lista de procesos. Tampoco
// se imprime al teclearla.
//
// El resultado se pega en Vercel:
//   vercel env add TEAM_PASSWORD_HASH

import readline from 'node:readline';
import { generarHash } from '../api/_auth.js';

const preguntar = (texto) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Sin eco: se sustituye la escritura por nada mientras se teclea.
  const salida = process.stdout;
  rl.output = { write: (c) => { if (!/\n/.test(c)) return; salida.write(c); } };
  salida.write(texto);

  rl.question('', (respuesta) => {
    salida.write('\n');
    rl.close();
    resolve(respuesta);
  });
});

const clave = (await preguntar('Contraseña del equipo: ')).trim();

if (clave.length < 8) {
  console.error('\nDemasiado corta: mínimo 8 caracteres.');
  process.exit(1);
}

const repetida = (await preguntar('Repítela: ')).trim();

if (clave !== repetida) {
  console.error('\nNo coinciden.');
  process.exit(1);
}

console.log('\nTEAM_PASSWORD_HASH=' + await generarHash(clave));
console.log('\nPégalo en Vercel con:  vercel env add TEAM_PASSWORD_HASH');
console.log('No guardes la contraseña en ningún archivo del repositorio.\n');
