import React, { useState } from 'react';
import {
  PROMPT_PARTS,
  composePrompt,
  decomposePrompt,
  validatePrompt,
  promptSeverity
} from '../data/promptComposer';
import { getTechnicalProfile } from '../data/soundModel';
import { applyTheme, NEUTRAL_THEME } from '../data/analysisModel';
import { resolveDuration } from '../services/elevenLabsService';

// Compositor de prompts por partes.
//
// El orden de la fórmula queda garantizado por construcción: la duración
// encabeza siempre porque se toma del campo del asset, y los tres componentes
// derivados (identidad, restricciones y tratamiento técnico) se añaden al final
// sin que nadie pueda olvidarlos ni cambiarlos de sitio.

const PromptComposerPanel = ({ sound, config = {}, themeTag, onApply, onClose }) => {
  const [parts, setParts] = useState(() => decomposePrompt(sound.prompt));

  const preview = composePrompt(parts, { sound, config, themeTag });
  const problems = validatePrompt(preview, sound, config);
  const severity = promptSeverity(problems);
  const profile = getTechnicalProfile(sound.technical_profile);
  const duration = resolveDuration(sound.duration_seconds);

  const setPart = (key, value) => setParts(p => ({ ...p, [key]: value }));

  const derivedValue = (key) => {
    if (key === 'duration') {
      const d = String(sound.duration_seconds || '').trim();
      if (!d) return 'sin declarar';
      return sound.loop ? `${d} seconds seamless loop` : `${d} seconds`;
    }
    if (key === 'theme') return applyTheme('[THEME]', themeTag);
    if (key === 'restrictions') {
      const m = preview.match(/\.\s*([^.]*no [^.]*)\.\s*[^.]*$/);
      return m ? m[1].trim() : '—';
    }
    if (key === 'technical') return profile.chain;
    return '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container prompt-composer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>🧩 Componer prompt</h2>
            <p className="composer-subtitle">
              <strong>{sound.official_filename || `asset ${sound.id}`}</strong>
              {' · '}{profile.label}
              {sound.loop && ' · loop'}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body composer-body">
          <p className="composer-note">
            El orden lo fija la fórmula, no tú: la duración encabeza siempre porque los motores
            de generación la deducen mal si aparece en medio del texto.
          </p>

          <div className="composer-parts">
            {PROMPT_PARTS.map(part => (
              <div className={`composer-part ${part.derived ? 'derived' : ''}`} key={part.key}>
                <div className="composer-part-head">
                  <span className="composer-part-order">{part.order}</span>
                  <span className="composer-part-label">
                    {part.label}
                    <span className="composer-part-hint">{part.hint}</span>
                  </span>
                  {part.derived && <span className="composer-part-source">{part.derived}</span>}
                </div>

                {part.derived ? (
                  <div className="composer-derived-value">{derivedValue(part.key)}</div>
                ) : (
                  <textarea
                    value={parts[part.key] || ''}
                    onChange={(e) => setPart(part.key, e.target.value)}
                    placeholder={part.placeholder}
                    className="composer-input"
                    rows={2}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Resultado */}
          <div className="composer-section">
            <div className="composer-section-head">
              <h3>Resultado</h3>
              <span className={`composer-severity composer-${severity}`}>
                {severity === 'ok' ? '✓ Estructura correcta'
                  : severity === 'error' ? `${problems.filter(p => p.level === 'error').length} problemas`
                    : `${problems.length} avisos`}
              </span>
            </div>

            <p className="composer-preview">{preview}</p>

            {!themeTag && (
              <p className="composer-warning">
                Sin etiqueta temática: se usará «{NEUTRAL_THEME}». Defínela en el informe de análisis.
              </p>
            )}

            {problems.length > 0 && (
              <ul className="composer-problems">
                {problems.map((p, i) => (
                  <li key={i} className={`composer-problem-${p.level}`}>{p.message}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Qué se enviará a la API */}
          <div className="composer-section">
            <div className="composer-section-head">
              <h3>Al generar</h3>
            </div>
            <p className="composer-note">
              Se enviará <strong>duration_seconds: {duration.seconds ?? 'sin especificar'}</strong>
              {duration.adjusted && ' (ajustado)'}
            </p>
            {duration.note && <p className="composer-warning">{duration.note}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancelar</button>
          <button
            className="save-btn"
            onClick={() => onApply(preview)}
            disabled={severity === 'error'}
            title={severity === 'error' ? 'Corrige los problemas antes de aplicar' : 'Escribir en el asset'}
          >
            Usar este prompt
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptComposerPanel;
