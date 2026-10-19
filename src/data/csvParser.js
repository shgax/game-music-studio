// Analizador de CSV según RFC 4180.
//
// El anterior dividía el texto por líneas antes de analizar, lo que rompía dos
// casos habituales en hojas exportadas de Excel:
//   1. Comillas escapadas: "dice ""hola"" aquí"
//   2. Saltos de línea dentro de un campo entrecomillado
//
// Este recorre el texto completo carácter a carácter, así que el estado de
// "dentro de comillas" sobrevive a los saltos de línea.

const QUOTE = '"';
const CR = '\r';
const LF = '\n';

// Devuelve una matriz de filas, cada una con sus celdas ya sin comillas.
export const parseCSV = (text = '', delimiter = ',') => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let cellWasQuoted = false;

  const endCell = () => {
    // Solo se recortan los espacios de un campo sin comillas: dentro de
    // comillas el espacio puede ser intencionado.
    row.push(cellWasQuoted ? cell : cell.trim());
    cell = '';
    cellWasQuoted = false;
  };

  const endRow = () => {
    endCell();
    // Una fila totalmente vacía no aporta nada.
    if (row.some(c => c !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === QUOTE) {
        // Dos comillas seguidas dentro de un campo entrecomillado son una
        // comilla literal, no el cierre del campo.
        if (text[i + 1] === QUOTE) {
          cell += QUOTE;
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        // Incluye saltos de línea: dentro de comillas son parte del valor.
        cell += char;
      }
      continue;
    }

    if (char === QUOTE) {
      inQuotes = true;
      cellWasQuoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === LF) {
      endRow();
    } else if (char === CR) {
      // Se ignora: el LF que lo sigue cierra la fila.
    } else {
      cell += char;
    }
  }

  // Última fila si el archivo no termina en salto de línea.
  if (cell !== '' || row.length > 0) endRow();

  return rows;
};

// Analiza y descarta la cabecera. Devuelve solo las filas de datos.
export const parseCSVBody = (text = '', delimiter = ',') => {
  const rows = parseCSV(text, delimiter);
  return rows.length <= 1 ? [] : rows.slice(1);
};

// Detecta el delimitador más probable contando ocurrencias fuera de comillas en
// la primera línea. Excel exporta con punto y coma en configuraciones europeas.
export const detectDelimiter = (text = '') => {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const candidates = [',', ';', '\t'];

  let best = ',';
  let bestCount = 0;

  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i];
      if (c === QUOTE) inQuotes = !inQuotes;
      else if (c === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }

  return best;
};
