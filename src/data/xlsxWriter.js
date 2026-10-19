// Escritor mínimo de .xlsx con APIs nativas.
//
// Un .xlsx es un ZIP de archivos XML. Para una hoja de unas decenas de filas no
// compensa una librería (la constitución pide no añadir dependencias sin
// justificarlo), y comprimir no aporta nada a ese tamaño: el ZIP se escribe con el
// método «stored» (sin compresión) y su CRC-32 se calcula aquí.
//
// Es la mitad que ya existe en documentReader.js, que lee ZIP con
// DecompressionStream; esta escribe.
//
// Excel rechaza el archivo ENTERO ante un error de forma, así que el contenido se
// limita a lo imprescindible y todo texto se escapa.

const encoder = new TextEncoder();

// --- CRC-32 ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// --- ZIP «stored» ---

const dosDateTime = (date) => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
});

// `files` es [{ name, content }] con content en texto. Devuelve un Uint8Array.
export const zipStored = (files, now = new Date()) => {
  const { time, date } = dosDateTime(now);
  const entries = files.map(f => {
    const name = encoder.encode(f.name);
    const data = encoder.encode(f.content);
    return { name, data, crc: crc32(data) };
  });

  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);

  let pos = 0;
  const offsets = [];

  for (const e of entries) {
    offsets.push(pos);
    view.setUint32(pos, 0x04034B50, true);       // firma de cabecera local
    view.setUint16(pos + 4, 20, true);           // versión necesaria
    view.setUint16(pos + 6, 0x0800, true);       // nombres en UTF-8
    view.setUint16(pos + 8, 0, true);            // método 0: sin compresión
    view.setUint16(pos + 10, time, true);
    view.setUint16(pos + 12, date, true);
    view.setUint32(pos + 14, e.crc, true);
    view.setUint32(pos + 18, e.data.length, true);
    view.setUint32(pos + 22, e.data.length, true);
    view.setUint16(pos + 26, e.name.length, true);
    view.setUint16(pos + 28, 0, true);           // sin campo extra
    out.set(e.name, pos + 30);
    out.set(e.data, pos + 30 + e.name.length);
    pos += 30 + e.name.length + e.data.length;
  }

  const centralStart = pos;
  entries.forEach((e, i) => {
    view.setUint32(pos, 0x02014B50, true);       // firma del directorio central
    view.setUint16(pos + 4, 20, true);           // versión que lo creó
    view.setUint16(pos + 6, 20, true);           // versión necesaria
    view.setUint16(pos + 8, 0x0800, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, time, true);
    view.setUint16(pos + 14, date, true);
    view.setUint32(pos + 16, e.crc, true);
    view.setUint32(pos + 20, e.data.length, true);
    view.setUint32(pos + 24, e.data.length, true);
    view.setUint16(pos + 28, e.name.length, true);
    view.setUint16(pos + 30, 0, true);           // campo extra
    view.setUint16(pos + 32, 0, true);           // comentario
    view.setUint16(pos + 34, 0, true);           // disco
    view.setUint16(pos + 36, 0, true);           // atributos internos
    view.setUint32(pos + 38, 0, true);           // atributos externos
    view.setUint32(pos + 42, offsets[i], true);
    out.set(e.name, pos + 46);
    pos += 46 + e.name.length;
  });

  view.setUint32(pos, 0x06054B50, true);         // fin del directorio central
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, entries.length, true);
  view.setUint16(pos + 10, entries.length, true);
  view.setUint32(pos + 12, pos - centralStart, true);
  view.setUint32(pos + 16, centralStart, true);
  view.setUint16(pos + 20, 0, true);

  return out;
};

// --- Hoja de cálculo ---

// XML 1.0 solo admite tabulador, salto de línea, retorno y los caracteres desde
// U+0020 (menos los sustitutos sueltos y U+FFFE/U+FFFF). El resto no se puede ni
// escapar: un solo carácter así invalida el archivo entero. Se descartan.
const isValidXmlChar = (code) =>
  code === 0x9 || code === 0xA || code === 0xD ||
  (code >= 0x20 && code <= 0xD7FF) ||
  (code >= 0xE000 && code <= 0xFFFD) ||
  (code >= 0x10000 && code <= 0x10FFFF);

const stripInvalidXml = (value) =>
  Array.from(String(value ?? '')).filter(ch => isValidXmlChar(ch.codePointAt(0))).join('');

const escapeXml = (value) => stripInvalidXml(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Letra de columna: 0 → A, 25 → Z, 26 → AA.
const columnName = (index) => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

// Excel limita a 255 caracteres el destino de HYPERLINK. Un enlace más largo se
// escribe como texto: peor que pulsable, pero el archivo sigue siendo válido.
const MAX_LINK = 255;

// Estilos: 0 normal · 1 cabecera en negrita · 2 enlace (azul subrayado).
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

const textCell = (ref, text, style = 0) =>
  `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;

// Un enlace pulsable usa la función HYPERLINK, que evita escribir el archivo de
// relaciones de la hoja. Las comillas del destino se duplican dentro de la fórmula
// y después se escapa el XML. El texto visible va como valor en caché.
const linkCell = (ref, text, url) => {
  const target = stripInvalidXml(url);
  if (!/^https?:\/\//i.test(target) || target.length > MAX_LINK) return textCell(ref, url);
  const formula = `HYPERLINK("${target.replace(/"/g, '""')}","${String(text).replace(/"/g, '""')}")`;
  return `<c r="${ref}" t="str" s="2"><f>${escapeXml(formula)}</f><v>${escapeXml(text)}</v></c>`;
};

// `rows` es una lista de filas; cada celda es un texto o { text, link }.
// Todo texto se escribe como texto: nunca como fórmula, aunque empiece por «=».
const buildSheet = (headers, rows, widths) => {
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');

  const headRow = `<row r="1">${headers.map((h, c) => textCell(`${columnName(c)}1`, h, 1)).join('')}</row>`;

  const bodyRows = rows.map((cells, r) => {
    const rowNumber = r + 2;
    const rendered = cells.map((cell, c) => {
      const ref = `${columnName(c)}${rowNumber}`;
      if (cell && typeof cell === 'object' && cell.link) return linkCell(ref, cell.text, cell.link);
      return textCell(ref, cell && typeof cell === 'object' ? cell.text : cell);
    }).join('');
    return `<row r="${rowNumber}">${rendered}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${headRow}${bodyRows}</sheetData>
</worksheet>`;
};

// El nombre de una hoja no admite : \ / ? * [ ] y tiene un máximo de 31 caracteres.
const safeSheetName = (name) =>
  (String(name || 'Hoja').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31)) || 'Hoja';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const writeXlsx = ({ sheetName = 'Hoja', headers, rows, widths }) => {
  const columnWidths = widths || headers.map(() => 24);

  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    { name: 'xl/styles.xml', content: STYLES },
    { name: 'xl/worksheets/sheet1.xml', content: buildSheet(headers, rows, columnWidths) }
  ];

  return new Blob([zipStored(files)], { type: XLSX_TYPE });
};
