import React from 'react';
import { usePromptPackage } from './usePromptPackage';
import { acceptNotice, declineNotice, dismissNote, getPendingNote } from '../services/livePrompts';

/**
 * Franja bajo la barra superior para dos momentos de la feature 011:
 *
 *  - La PRIMERA vez, antes de consultar nada: dice qué se consulta, a qué dirección y cómo
 *    desactivarlo (FR-015). No bloquea el uso: la herramienta funciona con la copia
 *    incluida mientras la persona decide. Sin su «Entendido» no se hace ninguna petición.
 *  - Después de aplicar una versión nueva: la nota de qué cambió, UNA sola vez (FR-019).
 */
const LivePromptsNotice = () => {
  const { noticeSeen } = usePromptPackage();
  const note = getPendingNote();

  if (!noticeSeen) {
    return (
      <section className="prompts-live-banner" aria-label="Aviso sobre los prompts del estudio">
        <div className="prompts-live-banner-text">
          <strong>Los prompts se pueden mantener al día</strong>
          <p>
            Esta herramienta puede consultar, al abrirse, una dirección pública del repositorio del
            estudio (<code>raw.githubusercontent.com</code>) para traer las últimas mejoras de los
            prompts. <strong>Solo lee</strong>: no envía tus claves, tus imágenes ni tus proyectos.
            GitHub, que aloja esa dirección, puede ver la dirección de red de tu equipo. Puedes
            desactivarlo cuando quieras en ⚙️ Configuración. Mientras decides, trabajas con los
            prompts que vienen incluidos.
          </p>
        </div>
        <div className="prompts-live-banner-actions">
          <button type="button" className="prompts-live-btn prompts-live-btn-primary" onClick={acceptNotice}>
            Entendido
          </button>
          <button type="button" className="prompts-live-btn" onClick={declineNotice}>
            No consultar
          </button>
        </div>
      </section>
    );
  }

  if (note) {
    return (
      <section className="prompts-live-banner" aria-label="Novedades de los prompts">
        <div className="prompts-live-banner-text">
          <strong>Prompts actualizados a la versión {note.version}</strong>
          <p>{note.notes}</p>
        </div>
        <div className="prompts-live-banner-actions">
          <button type="button" className="prompts-live-btn" onClick={dismissNote}>
            Cerrar
          </button>
        </div>
      </section>
    );
  }

  return null;
};

export default LivePromptsNotice;
