import React, { useState, useEffect, useRef } from 'react';
import { BLOCKED, DRAFT_WARNING } from '../data/guideContent';
import { isOpenableLink } from '../data/deliveryRows';

// Una fila de la vista simple (feature 010): un sonido con su prompt, y lo que se
// puede hacer con él —aprobarlo, copiarlo y registrar dónde lo guardaste—.
//
// El flujo del estudio es manual: se copia el prompt, se genera el sonido en la página de
// ElevenLabs, se guarda en Drive y se pega aquí su enlace. Por eso COPIAR es la acción
// principal. Generar, escuchar el borrador y descargarlo solo existen si hay una clave de
// ElevenLabs (guardada antes o en .env): la herramienta ya no la pide, y sin ella no se ofrece
// nada ni se menciona ninguna clave (enmienda del 2026-10-19, FR-068 a FR-070).
//
// Es controlado: cada acción es una intención que decide el orquestador. El estado
// local es solo el de los campos de texto, para no guardar el proyecto entero con cada
// tecla; se confirma al salir del campo.
//
// Nunca se deja un botón apagado sin decir por qué (FR-054): la frase que lo
// desbloquea se escribe debajo.

const SoundPromptRow = ({
  sound,
  draft,
  generating,
  elevenLabsReady,
  included,
  onToggleInclude,
  onPromptChange,
  onApprove,
  onGenerate,
  onDownload,
  onLinkChange
}) => {
  const [promptText, setPromptText] = useState(sound.prompt || '');
  const [linkText, setLinkText] = useState(sound.audioSource || '');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  // Si el prompt o el enlace cambian desde fuera (otro análisis, otra vista), la fila
  // los refleja.
  useEffect(() => setPromptText(sound.prompt || ''), [sound.prompt]);
  useEffect(() => setLinkText(sound.audioSource || ''), [sound.audioSource]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const approved = sound.planning_status === 'approved_for_production';
  const hasPrompt = Boolean(promptText.trim());
  const markedGenerated = sound.production_status === 'generated';

  const blockedReason = !approved
    ? BLOCKED.needApproval
    : !hasPrompt
      ? BLOCKED.needPrompt
      : '';

  const commitPrompt = () => {
    if (promptText !== (sound.prompt || '')) onPromptChange(sound.id, promptText);
  };

  const commitLink = () => {
    if (linkText.trim() !== (sound.audioSource || '')) onLinkChange(sound.id, linkText.trim());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sin permiso para el portapapeles: el texto sigue ahí para seleccionarlo a mano.
    }
  };

  const openable = isOpenableLink(linkText);

  return (
    <article className={`simple-row ${approved ? 'is-approved' : ''}`} aria-label={sound.official_filename}>
      <header className="simple-row-head">
        <div>
          <span className="simple-row-file">{sound.official_filename}</span>
          <p className="simple-row-usage">{sound.usage}</p>
          <div className="simple-row-chips">
            {sound.duration_seconds && <span className="simple-chip">{sound.duration_seconds} s</span>}
            {sound.loop && <span className="simple-chip simple-chip-loop">Loop</span>}
            {approved
              ? <span className="simple-chip simple-chip-ok">Aprobado para producción</span>
              : <span className="simple-chip simple-chip-wait">Pendiente de validar</span>}
          </div>
        </div>

        <div className="simple-row-toggles">
          <label className="simple-check">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => onApprove(sound.id, e.target.checked)}
            />
            <span>Aprobar para producción</span>
          </label>
          <label className="simple-check simple-check-quiet">
            <input
              type="checkbox"
              checked={included}
              onChange={(e) => onToggleInclude(sound.id, e.target.checked)}
            />
            <span>Incluir en el documento</span>
          </label>
        </div>
      </header>

      <label className="simple-label" htmlFor={`prompt-${sound.id}`}>Prompt (en inglés, puedes editarlo)</label>
      <textarea
        id={`prompt-${sound.id}`}
        className="simple-prompt"
        rows={4}
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        onBlur={commitPrompt}
      />

      <div className="simple-row-actions">
        <button
          type="button"
          className={elevenLabsReady ? 'simple-secondary-btn' : 'simple-primary-btn'}
          onClick={copy}
          disabled={!hasPrompt}
        >
          {copied ? '✓ Copiado' : 'Copiar prompt'}
        </button>
        {elevenLabsReady && (
          <button
            type="button"
            className="simple-primary-btn"
            onClick={() => onGenerate(sound.id)}
            disabled={Boolean(blockedReason) || generating}
            aria-describedby={blockedReason ? `blocked-${sound.id}` : undefined}
          >
            {generating ? 'Generando…' : draft ? 'Generar de nuevo' : 'Generar'}
          </button>
        )}
      </div>
      {elevenLabsReady && blockedReason && <p className="simple-hint" id={`blocked-${sound.id}`}>{blockedReason}</p>}

      {elevenLabsReady && draft && (
        <div className="simple-draft">
          <audio controls src={draft.url} aria-label={`Escuchar ${sound.official_filename}`} />
          <button type="button" className="simple-secondary-btn" onClick={() => onDownload(sound.id)}>
            Descargar .{draft.extension}
          </button>
          <p className="simple-hint">{DRAFT_WARNING}</p>
        </div>
      )}
      {elevenLabsReady && !draft && markedGenerated && (
        <p className="simple-hint">
          Marcado como generado, pero el borrador ya no está en memoria. Genera de nuevo si lo necesitas.
        </p>
      )}

      <label className="simple-label" htmlFor={`link-${sound.id}`}>Enlace de dónde lo guardaste (por ejemplo, Drive)</label>
      <div className="simple-link-row">
        <input
          id={`link-${sound.id}`}
          type="text"
          className="modal-input"
          placeholder="Pega aquí el enlace del audio"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          onBlur={commitLink}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        {openable && (
          <a className="simple-secondary-btn" href={linkText.trim()} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
        )}
      </div>
      {linkText.trim() && !openable && (
        <p className="simple-hint">
          Es una ruta de tu equipo: se registra, pero no se podrá abrir desde el documento que compartas.
        </p>
      )}
    </article>
  );
};

export default SoundPromptRow;
