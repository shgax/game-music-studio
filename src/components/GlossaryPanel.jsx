import React, { useEffect } from 'react';
import { GLOSSARY } from '../data/guideContent';

// Glosario en un panel lateral (feature 010, FR-053).
//
// Se abre desde cualquier paso SIN cambiar de pantalla: salir de ella perdería el
// contexto de lo que la persona estaba haciendo. Cerrarlo no altera nada.
// Es controlado: el padre decide si está abierto.

const GlossaryPanel = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="glossary-backdrop" onClick={onClose}>
      <aside
        className="glossary-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Glosario"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glossary-header">
          <h2>Glosario</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar el glosario">×</button>
        </div>
        <p className="glossary-intro">Las palabras que verás en la herramienta, explicadas sin jerga.</p>
        <dl className="glossary-list">
          {GLOSSARY.map(entry => (
            <div className="glossary-entry" key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
};

export default GlossaryPanel;
