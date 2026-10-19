import { blobConfigurado, readProjects, writeProjects, remoteUpdatedAt } from './_blob.js';

// Almacén de la base de proyectos, para la aplicación del director.
//
// Sustituye a Google Drive: no hay OAuth, ni pantalla de consentimiento, ni
// tokens que caduquen cada hora. El token de Blob vive en el servidor y nunca
// llega al navegador.
//
// El blob es privado: solo estas funciones lo leen y lo escriben.

export default async function handler(req, res) {
  // Sin token configurado la app sigue funcionando en Modo Local: se responde
  // con un código que el cliente interpreta como "no hay nube disponible".
  if (!blobConfigurado()) {
    return res.status(503).json({ error: 'blob_not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const { projects, updatedAt } = await readProjects();
      return res.status(200).json({ projects, updatedAt });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (!Array.isArray(body?.projects)) {
        return res.status(400).json({ error: 'projects debe ser un array' });
      }

      // Aviso de escritura concurrente: si el blob remoto cambió después de la
      // última lectura del cliente, se rechaza en vez de pisar el trabajo.
      // El cliente decide entonces si recargar o forzar.
      if (body.baseUpdatedAt !== undefined && !body.force) {
        const remoteAt = await remoteUpdatedAt();
        const remoteMs = remoteAt ? new Date(remoteAt).getTime() : 0;
        const baseMs = body.baseUpdatedAt ? new Date(body.baseUpdatedAt).getTime() : 0;

        if (remoteMs > baseMs) {
          return res.status(409).json({ error: 'conflict', remoteUpdatedAt: remoteAt });
        }
      }

      const updatedAt = await writeProjects(body.projects);
      return res.status(200).json({ ok: true, updatedAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'método no permitido' });
  } catch (e) {
    console.error('[api/db]', e);
    return res.status(500).json({ error: e.message });
  }
}
