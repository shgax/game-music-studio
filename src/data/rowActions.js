// Las acciones de una fila de la tabla maestra, como datos (feature 002, enmienda del
// 2026-10-19, revisada el mismo día).
//
// El flujo real del director es manual: copia el prompt, genera el sonido en ElevenLabs, lo
// guarda en su Drive y registra aquí el enlace. Por eso lo que hay a la vista es COPIAR EL
// PROMPT y REGISTRAR LA RUTA (que pasa a ABRIR EL ENLACE cuando ya existe), y el resto, incluida
// la generación dentro de la herramienta —que es opcional—, va en un menú «Más» con nombre en
// texto y una frase de qué hace cada una (FR-019g a FR-019q).
//
// Es una función pura para que se pueda comprobar sin navegador. Los manejadores no están aquí:
// quien pinta las acciones los enlaza por la `key` de cada una.

import { isOpenableLink } from './deliveryRows.js';

// Solo suena lo que el navegador sabe reproducir: un archivo de audio. Un enlace de Drive abre
// su propio reproductor, no el archivo, así que no es «reproducible» aunque sea una dirección web.
export const isDirectAudioUrl = (value) =>
  isOpenableLink(value) && /\.(wav|mp3|ogg|m4a|aac|flac)(?:[?#].*)?$/i.test(String(value).trim());

export const buildRowActions = (sound, { playing = false, generating = false, hasElevenLabsKey = false, showAdvanced = false } = {}) => {
  const hasPrompt = Boolean(String(sound.prompt || '').trim());
  const link = String(sound.audioSource || '').trim();
  const linkOpenable = isOpenableLink(link);
  const draft = Boolean(sound.localBlobUrl);
  const playable = draft || isDirectAudioUrl(link);
  const reviews = sound.reviews?.length || 0;

  const noPromptHint = 'Esta fila no tiene prompt. Escríbelo o elige uno de la biblioteca.';

  // Generar dentro de la herramienta es opcional y ya no se anuncia: solo se ofrece si hay una
  // clave de ElevenLabs (guardada antes o en .env). Sin clave NO aparece, ni apagada, porque la
  // herramienta ya no tiene dónde pedirla (FR-019k, feature 010 FR-068). Si se ofrece y no
  // puede, dice por qué en vez de fallar al pulsar.
  const generate = !hasElevenLabsKey ? null : (() => {
    const label = generating ? 'Generando…' : 'Generar boceto con ElevenLabs (opcional)';
    if (generating) return { key: 'generate', label, disabled: true, hint: 'Un momento: se está generando.' };
    if (!hasPrompt) return { key: 'generate', label, disabled: true, hint: noPromptHint };
    return { key: 'generate', label, hint: 'Crea un audio de prueba. Gasta créditos de tu cuenta de ElevenLabs.' };
  })();

  return {
    // Lo primero que se hace en cada fila.
    primary: {
      key: 'copy',
      label: 'Copiar prompt',
      disabled: !hasPrompt,
      hint: hasPrompt ? 'Copia el prompt tal como está en «Prompt final»' : noPromptHint
    },

    // Lo segundo: dejar anotado dónde quedó el archivo, y volver a él cuando ya está.
    second: !link
      ? { key: 'source', label: 'Registrar ruta', hint: 'Pega el enlace de Drive o la ruta del WAV' }
      : linkOpenable
        ? { key: 'open', label: '↗ Abrir enlace', hint: link, linked: true }
        : { key: 'source', label: 'Cambiar ruta', hint: `Ruta registrada: ${link}. Una ruta local no se puede abrir desde aquí.`, linked: true },

    menu: [
      { key: 'view', label: 'Ver prompt', hint: 'Léelo completo, con para qué sirve este sonido' },
      playable && { key: 'play', label: playing ? 'Parar' : 'Escuchar', hint: draft ? 'El boceto que tienes en memoria' : 'El audio del enlace registrado' },
      draft && { key: 'download', label: 'Descargar boceto', hint: 'Vive solo en memoria: guárdalo antes de cerrar la pestaña' },
      generate,
      {
        key: 'library',
        label: 'Elegir un prompt de la biblioteca',
        hint: hasPrompt ? 'Reemplaza el prompt de esta fila (te lo pregunta antes)' : 'Parte de uno ya probado en lugar de escribirlo desde cero'
      },
      { key: 'compose', label: 'Componer por partes', hint: 'Arma el prompt pieza a pieza, con el orden garantizado' },
      // Con un enlace web la ruta ya tiene su botón a la vista («Abrir enlace»): aquí solo se cambia.
      linkOpenable && { key: 'source', label: 'Cambiar ruta', hint: `Registrada: ${link}`, done: true },
      // Revisión, mezcla y entrega son estados avanzados: se ofrecen solo si se muestran (FR-001a).
      showAdvanced && {
        key: 'review',
        label: 'Revisar',
        hint: reviews ? `${reviews} ${reviews === 1 ? 'revisión anterior' : 'revisiones anteriores'}` : 'Anota qué se escuchó y qué se decide',
        done: reviews > 0
      },
      // Lo delicado va al final, aparte y señalado.
      { key: 'delete', label: 'Eliminar sonido', hint: 'Pide confirmación. El ID no se reutilizará', tone: 'danger', separated: true }
    ].filter(Boolean)
  };
};
