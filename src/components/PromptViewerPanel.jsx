import React, { useState, useEffect, useRef } from 'react';

/**
 * Panel de solo lectura con el prompt completo de un sonido (feature 002, FR-019l): para
 * leerlo entero, con el nombre del sonido y para qué sirve, antes de copiarlo. No edita nada:
 * el prompt se corrige en la celda «Prompt final» de la fila.
 *
 * Es presentacional: recibe el sonido y emite el cierre por callback. Se cierra con Escape,
 * al pulsar fuera y con un botón explícito.
 */
const PromptViewerPanel = ({ sound, onClose }) => {
  const [copied, setCopied] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer.current);
    };
  }, [onClose]);

  const copy = async () => {
    let result = 'copied';
    try {
      await navigator.clipboard.writeText(sound.prompt);
    } catch {
      result = 'failed';
    }
    setCopied(result);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(''), 1800);
  };

  const hasPrompt = Boolean(String(sound.prompt || '').trim());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container prompt-viewer-modal"
        role="dialog"
        aria-label={`Prompt de ${sound.official_filename || sound.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{sound.official_filename || `Sonido ${sound.id}`}</h2>
            <p className="prompt-viewer-meta">
              {sound.usage || 'Sin momento de uso indicado'}
              {sound.duration_seconds && <span className="prompt-viewer-duration">{sound.duration_seconds} s</span>}
            </p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body">
          {hasPrompt
            ? <p className="prompt-viewer-text">{sound.prompt}</p>
            : <p className="prompt-viewer-empty">Este sonido todavía no tiene prompt. Escríbelo en la celda «Prompt final» o elige uno de la biblioteca.</p>}

          <div className="prompt-viewer-actions">
            <button type="button" className="prompts-live-btn prompts-live-btn-primary" onClick={copy} disabled={!hasPrompt}>
              {copied === 'copied' ? '✓ Copiado' : copied === 'failed' ? 'No se pudo copiar' : 'Copiar prompt'}
            </button>
            <button type="button" className="prompts-live-btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptViewerPanel;
