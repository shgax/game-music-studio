import { blobConfigurado, readProjects, writeProjects } from './_blob.js';
import { buscarMiembro, verificarClave, crearSesion, leerSesion, cookieSesion } from './_auth.js';

// Vista de entrega para el equipo del juego (feature 009).
//
// El Artículo X, desde la enmienda 2.1.0, admite un segundo uso del servidor:
// verificar el acceso de quien no es el director. Esta función es ese uso.
//
// Lo importante de este archivo es lo que NO devuelve. El equipo recibe ocho
// campos por asset y ninguno más: ni prompts, ni capas, ni motores, ni los otros
// cinco ejes de estado. Filtrar al pintar en React no serviría —los datos
// viajarían igual y bastaría abrir las herramientas de desarrollo—, así que el
// recorte se hace aquí, antes de responder.

// Un fallo de acceso siempre tarda lo mismo y dice lo mismo: qué falló, si el
// usuario o la clave, no es asunto de quien lo intenta.
const RETARDO_FALLO = 500;
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

const leerCuerpo = (req) =>
  typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

// Un asset se entrega si tiene nombre oficial y no es un recurso de mezcla: los
// MIX_ son automatizaciones del motor del juego, no archivos que descargar.
const esEntregable = (s) => Boolean(s?.official_filename) && s.category !== 'MIX';

const paraElEquipo = (s) => ({
  id: s.id,
  archivo: s.official_filename,
  categoria: s.category,
  evento: s.game_event || '',
  cuando: s.usage || '',
  para: s.objective || '',
  duracion: s.duration_seconds || '',
  loop: s.loop === true,
  enlace: s.audioSource || '',
  usado: s.delivery_status === 'loaded'
});

const juegoParaElEquipo = (p) => {
  const assets = (p.sounds || []).filter(esEntregable).map(paraElEquipo);
  return {
    id: p.id,
    nombre: p.name,
    total: assets.length,
    usados: assets.filter(a => a.usado).length,
    assets
  };
};

export default async function handler(req, res) {
  // Aquí no hay modo local que valga: esta vista existe para que dos personas
  // distintas vean el mismo dato. Sin almacén, se dice, no se disimula.
  if (!blobConfigurado()) {
    return res.status(503).json({ error: 'sin_almacenamiento' });
  }

  try {
    const cuerpo = req.method === 'POST' ? leerCuerpo(req) : {};

    // --- Entrar ---
    if (req.method === 'POST' && cuerpo.accion === 'login') {
      const miembro = buscarMiembro(cuerpo.usuario);
      const claveOk = await verificarClave(
        String(cuerpo.clave || ''),
        process.env.TEAM_PASSWORD_HASH || ''
      );

      if (!miembro || !claveOk) {
        await esperar(RETARDO_FALLO);
        return res.status(401).json({ error: 'credenciales' });
      }

      res.setHeader('Set-Cookie', cookieSesion(await crearSesion(miembro.usuario)));
      return res.status(200).json({ miembro: { usuario: miembro.usuario, nombre: miembro.nombre } });
    }

    // --- Salir ---
    if (req.method === 'POST' && cuerpo.accion === 'salir') {
      res.setHeader('Set-Cookie', cookieSesion(''));
      return res.status(200).json({ ok: true });
    }

    // A partir de aquí hace falta sesión. Se comprueba antes de leer el almacén:
    // sin credencial no se llega ni a tocar los datos.
    const miembro = await leerSesion(req.headers.cookie);
    if (!miembro) {
      return res.status(401).json({ error: 'sin_sesion' });
    }

    // --- Ver ---
    if (req.method === 'GET') {
      const { projects } = await readProjects();
      return res.status(200).json({
        miembro: { usuario: miembro.usuario, nombre: miembro.nombre },
        juegos: (projects || []).map(juegoParaElEquipo)
      });
    }

    // --- Marcar ---
    if (req.method === 'POST' && cuerpo.accion === 'marcar') {
      const { proyecto, asset, usado } = cuerpo;
      if (!proyecto || !asset) {
        return res.status(400).json({ error: 'faltan_datos' });
      }

      // Leer, modificar y escribir dentro de la misma invocación: la ventana en
      // la que otro podría escribir por medio se mide en milisegundos.
      const { projects } = await readProjects();
      if (!Array.isArray(projects)) {
        return res.status(409).json({ error: 'sin_datos' });
      }

      const juego = projects.find(p => p.id === proyecto);
      const sonido = juego?.sounds?.find(s => s.id === asset);
      if (!sonido || !esEntregable(sonido)) {
        return res.status(404).json({ error: 'asset_no_encontrado' });
      }

      // Solo este eje. Los otros cinco no se leen ni se escriben: un asset puede
      // estar integrado y seguir pendiente de mezcla, y eso es información.
      sonido.delivery_status = usado ? 'loaded' : 'delivered';

      juego.deliveryLog = [
        ...(juego.deliveryLog || []),
        { asset, miembro: miembro.usuario, usado: Boolean(usado), at: new Date().toISOString() }
      ];

      await writeProjects(projects);
      return res.status(200).json({ ok: true, usado: Boolean(usado) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'metodo_no_permitido' });
  } catch (e) {
    console.error('[api/team]', e);
    return res.status(500).json({ error: 'error_servidor' });
  }
}
