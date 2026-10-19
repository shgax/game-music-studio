import { put, list, get } from '@vercel/blob';

// Acceso al almacén de proyectos en Vercel Blob.
//
// Vive aparte porque lo usan dos funciones: /api/db, que sirve a la aplicación
// del director, y /api/team, que sirve al equipo del juego. Duplicar la ruta del
// blob en dos sitios es la forma más rápida de que un día dejen de apuntar al
// mismo archivo.
//
// El guion bajo del nombre lo mantiene fuera de las rutas: Vercel solo publica
// como endpoint los archivos de api/ que no empiezan por él.

const BLOB_PATH = 'projects_db.json';

export const blobConfigurado = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const findBlob = async () => {
  const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
  return blobs.find(b => b.pathname === BLOB_PATH) || null;
};

// Marca de la última escritura, para detectar que alguien guardó por medio.
export const remoteUpdatedAt = async () => {
  const blob = await findBlob();
  return blob?.uploadedAt || null;
};

// Devuelve `projects: null` cuando el blob todavía no existe, que no es lo mismo
// que devolver una lista vacía: sin esa distinción, el primer arranque borraría
// el respaldo local en vez de sembrarse con él.
export const readProjects = async () => {
  const blob = await findBlob();
  if (!blob) return { projects: null, updatedAt: null };

  const file = await get(blob.url);
  const text = await new Response(file.body ?? file).text();

  return { projects: JSON.parse(text), updatedAt: blob.uploadedAt || null };
};

export const writeProjects = async (projects) => {
  const result = await put(BLOB_PATH, JSON.stringify(projects, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true
  });
  return result.uploadedAt || new Date().toISOString();
};
