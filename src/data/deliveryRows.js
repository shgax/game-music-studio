// Filas del documento que se comparte con el equipo del videojuego.
//
// El HTML y el Excel salen de las mismas filas, para que no puedan contar cosas
// distintas. Aquí se decide QUÉ entra en el documento; los exportadores solo
// deciden cómo se ve.
//
// Lo que NUNCA entra (feature 010, FR-039): prompts, claves ni ningún eje de
// estado. El documento presenta lo que la persona registró, no una confirmación
// de que algo esté aprobado, entregado o integrado (FR-040).

import { isDiscarded } from './soundModel.js';

// Solo una dirección web se puede abrir desde un documento ajeno. Una ruta local
// (/Users/…, C:\…) se muestra, pero no se enlaza. Tampoco `javascript:`, `data:` ni
// cualquier otro esquema: el enlace lo escribe una persona y lo abre otra.
export const isOpenableLink = (value) => /^https?:\/\/\S+$/i.test(String(value ?? '').trim());

const totalDuration = (sound) => {
  const body = Number(String(sound.duration_seconds ?? '').replace(',', '.'));
  const tail = Number(String(sound.tail_seconds ?? '').replace(',', '.')) || 0;
  if (!Number.isFinite(body) || body <= 0) return '';
  return String(Math.round((body + tail) * 10) / 10);
};

// `ids` limita el documento a los sonidos elegidos (FR-043); sin él entra todo lo
// que sigue vivo. Un recurso de mezcla (MIX_) no es un archivo que integrar, y un
// sonido descartado ya no forma parte del trabajo.
export const buildDeliveryRows = (project, ids = null) => {
  const wanted = ids ? new Set(ids) : null;

  return (project?.sounds || [])
    .filter(s => s.category !== 'MIX' && !isDiscarded(s))
    .filter(s => !wanted || wanted.has(s.id))
    .map(s => {
      const enlace = String(s.audioSource ?? '').trim();
      return {
        id: s.id,
        archivo: s.official_filename || '',
        zona: s.category,
        evento: s.game_event || '',
        cuando: s.usage || '',
        duracion: totalDuration(s),
        loop: Boolean(s.loop),
        enlace,
        enlaceAbrible: isOpenableLink(enlace),
        pendiente: !enlace
      };
    });
};

export const countLinked = (rows) => rows.filter(r => !r.pendiente).length;
