// Lectura de documentos de contexto del juego.
//
// El brief de un juego llega como documento: PDF del cliente, Word del diseño,
// notas en Markdown. Se admiten todos los que se pueden leer en el navegador.
//
// PDF usa pdfjs-dist, que pesa demasiado para el bundle principal: se carga
// dinámicamente solo cuando alguien abre un PDF. Quien no use PDF no lo descarga.
//
// DOCX no necesita librería: es un ZIP con XML dentro, y tanto la descompresión
// como el análisis se resuelven con APIs nativas del navegador.

export const READABLE_EXTENSIONS = [
  '.txt', '.md', '.markdown', '.csv', '.json', '.rtf', '.pdf', '.docx'
];

export const ACCEPT_ATTRIBUTE = READABLE_EXTENSIONS.join(',');

// Lo que se puede sugerir cuando llega un formato que no se puede abrir.
const FORMAT_HELP = {
  '.doc': 'Word antiguo. Ábrelo en Word y guárdalo como .docx, o exporta a PDF.',
  '.pages': 'Pages de Apple. Exporta a PDF o Word desde Archivo → Exportar.',
  '.odt': 'OpenDocument. Exporta a .docx o PDF desde tu editor.',
  '.rtfd': 'RTF con adjuntos. Exporta a PDF.',
  '.key': 'Keynote. Exporta a PDF.',
  '.pptx': 'PowerPoint. Exporta a PDF.',
  '.xlsx': 'Excel. Exporta la hoja a CSV.'
};

const extensionOf = (name = '') => {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
};

// --- Limpieza por formato ---

const stripRtf = (text) => text
  .replace(/\{\\\*?[^{}]*\}/g, ' ')
  .replace(/\\'[0-9a-f]{2}/gi, '')
  .replace(/\\[a-z]+-?\d*\s?/gi, '')
  .replace(/[{}]/g, '')
  .replace(/[ \t]+/g, ' ')
  .trim();

const stripMarkdown = (text) => text
  .replace(/^---[\s\S]*?---\n/, '')
  .replace(/```[\s\S]*?```/g, '')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>]/g, '')
  .replace(/^\s*[-+*]\s+/gm, '· ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const flattenJson = (value, depth = 0) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);

  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    return value.map(v => `${indent}· ${flattenJson(v, depth + 1).trim()}`).join('\n');
  }
  return Object.entries(value)
    .map(([k, v]) => {
      const inner = flattenJson(v, depth + 1);
      return inner.includes('\n') ? `${indent}${k}:\n${inner}` : `${indent}${k}: ${inner}`;
    })
    .join('\n');
};

// --- PDF ---

let pdfjsPromise = null;

const loadPdfjs = () => {
  // Una sola carga aunque se abran varios PDF.
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
};

const readPdf = async (file, onProgress) => {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();

  // Sin standardFontDataUrl, pdfjs avisa por cada fuente estándar del documento.
  // Solo se extrae texto, así que se desactivan las funciones de renderizado que
  // necesitarían esos recursos.
  const task = pdfjs.getDocument({
    data: buffer,
    disableFontFace: true,
    isEvalSupported: false
  });
  const doc = await task.promise;
  const numPages = doc.numPages;

  const pages = [];
  for (let n = 1; n <= numPages; n++) {
    onProgress?.(`Leyendo página ${n} de ${numPages}...`);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    // Los fragmentos vienen sueltos: se reconstruyen las líneas usando el salto
    // vertical entre ellos, o el PDF sale como un párrafo interminable.
    let text = '';
    let lastY = null;
    for (const item of content.items) {
      if (!item.str) continue;
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n';
      else if (text && !text.endsWith(' ') && !item.str.startsWith(' ')) text += ' ';
      text += item.str;
      lastY = y;
    }
    pages.push(text.trim());
  }

  // La liberación va en la tarea de carga, no en el documento.
  await task.destroy();
  return { text: pages.filter(Boolean).join('\n\n'), pages: numPages };
};

// --- DOCX ---
//
// Un .docx es un ZIP. Solo interesa word/document.xml. Se localiza recorriendo
// el directorio central y se descomprime con DecompressionStream, sin librería.

const findInZip = (bytes, targetName) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // El fin del directorio central está al final, tras un comentario opcional.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('El archivo no parece un .docx válido.');

  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  for (let n = 0; n < entries; n++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    if (name === targetName) {
      // El encabezado local repite las longitudes: hay que releerlas de ahí.
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      return {
        data: bytes.subarray(dataStart, dataStart + compressedSize),
        compressed: method === 8
      };
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error(`El .docx no contiene ${targetName}.`);
};

const inflate = async (data) => {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
};

const docxXmlToText = (xml) => xml
  // Cada párrafo y cada salto explícito se convierten en línea.
  .replace(/<\/w:p>/g, '\n')
  .replace(/<w:br\s*\/?>/g, '\n')
  .replace(/<w:tab\s*\/?>/g, '\t')
  // El texto vive en <w:t>; el resto del marcado sobra.
  .replace(/<[^>]+>/g, '')
  // Word escribe los acentos como entidades numéricas: &#225; es "á".
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  // &amp; al final, o desharía las entidades ya convertidas.
  .replace(/&amp;/g, '&')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const readDocx = async (file) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede descomprimir .docx. Exporta el documento a PDF o a texto.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entry = findInZip(bytes, 'word/document.xml');
  const xml = entry.compressed
    ? await inflate(entry.data)
    : new TextDecoder().decode(entry.data);
  return docxXmlToText(xml);
};

// --- Texto plano ---

const readAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  reader.readAsText(file);
});

// --- Entrada única ---

export const readDocument = async (file, onProgress) => {
  const ext = extensionOf(file.name);

  if (!READABLE_EXTENSIONS.includes(ext)) {
    const help = FORMAT_HELP[ext];
    throw new Error(
      `No puedo leer archivos ${ext || 'sin extensión'}.\n\n` +
      (help ? `${help}\n\n` : '') +
      `Formatos admitidos: ${READABLE_EXTENSIONS.join(', ')}`
    );
  }

  let text = '';
  let detail = '';

  if (ext === '.pdf') {
    onProgress?.('Cargando el lector de PDF...');
    const { text: pdfText, pages } = await readPdf(file, onProgress);
    text = pdfText;
    detail = `${pages} ${pages === 1 ? 'página' : 'páginas'}`;

    if (!text.trim()) {
      throw new Error(
        'El PDF no tiene texto seleccionable: probablemente sea un escaneo o esté hecho de imágenes.\n\n' +
        'Eso necesitaría OCR, que esta herramienta no hace. Copia el texto a mano o pide el original en Word.'
      );
    }
  } else if (ext === '.docx') {
    onProgress?.('Leyendo el documento...');
    text = await readDocx(file);
  } else {
    const raw = await readAsText(file);
    if (ext === '.rtf') text = stripRtf(raw);
    else if (ext === '.md' || ext === '.markdown') text = stripMarkdown(raw);
    else if (ext === '.json') {
      try { text = flattenJson(JSON.parse(raw)); } catch { text = raw; }
    } else text = raw;
  }

  text = text.replace(/\r\n/g, '\n').trim();

  if (!text) {
    throw new Error('El documento está vacío o no contiene texto legible.');
  }

  return { text, name: file.name, chars: text.length, detail };
};
