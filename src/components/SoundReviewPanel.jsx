import React, { useState } from 'react';
import {
  REVIEW_CRITERIA,
  CRITERION_RESULTS,
  REVIEW_DECISIONS,
  createReview,
  reviewProblems,
  failedCriteria,
  getDecision
} from '../data/reviewModel';
import { approvedVersion } from '../data/soundModel';

// Ficha de revisión (fase 6).
//
// Implementa specs/reference/templates/SOUND_REVIEW.md.
//
// La decisión no solo se anota: mueve los ejes del asset. Registrar "hay que
// rehacerlo" sin que la producción vuelva a "regenerar" dejaría la ficha y la
// tabla contando cosas distintas.

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const SoundReviewPanel = ({ sound, onSubmit, onClose }) => {
  const approved = approvedVersion(sound);
  const [review, setReview] = useState(() =>
    createReview({ version: approved?.label || '' })
  );
  const [showHistory, setShowHistory] = useState(false);

  const history = sound.reviews || [];
  const problems = reviewProblems(review);
  const fallos = failedCriteria(review);
  const decision = getDecision(review.decision);

  const setCriterion = (key, field, value) => {
    setReview(r => ({
      ...r,
      criteria: { ...r.criteria, [key]: { ...r.criteria[key], [field]: value } }
    }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>🎧 Revisión</h2>
            <p className="review-subtitle">
              <strong>{sound.official_filename || `asset ${sound.id}`}</strong>
              {review.version && ` · versión ${review.version}`}
              {history.length > 0 && ` · ${history.length} revisiones previas`}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body review-body">
          {/* Historial */}
          {history.length > 0 && (
            <div className="review-history">
              <button className="review-history-toggle" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? '▲' : '▼'} Revisiones anteriores ({history.length})
              </button>
              {showHistory && (
                <div className="review-history-list">
                  {[...history].reverse().map((r, i) => {
                    const d = getDecision(r.decision);
                    return (
                      <div className="review-history-item" key={i}>
                        <div className="review-history-head">
                          <span>{formatDate(r.date)}{r.version && ` · ${r.version}`}</span>
                          {d && <span className={`review-decision-badge review-${d.tone}`}>{d.label}</span>}
                        </div>
                        {r.feedback && <p className="review-history-feedback">{r.feedback}</p>}
                        {failedCriteria(r).length > 0 && (
                          <p className="review-history-failed">
                            Falló: {failedCriteria(r).map(c => c.label).join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Criterios */}
          <div className="review-section">
            <div className="review-section-head">
              <h3>Evaluación</h3>
              <span className="review-progress">
                {REVIEW_CRITERIA.filter(c => review.criteria[c.key]?.result).length} de {REVIEW_CRITERIA.length}
              </span>
            </div>

            <div className="review-criteria">
              {REVIEW_CRITERIA.map(criterion => {
                const current = review.criteria[criterion.key] || {};
                return (
                  <div className="review-criterion" key={criterion.key}>
                    <div className="review-criterion-head">
                      <span className="review-criterion-label">
                        {criterion.label}
                        <span className="review-criterion-hint">{criterion.hint}</span>
                      </span>
                      <div className="review-results">
                        {CRITERION_RESULTS.map(r => (
                          <button
                            key={r.key}
                            className={`review-result-btn review-${r.tone} ${current.result === r.key ? 'active' : ''}`}
                            onClick={() => setCriterion(criterion.key, 'result', current.result === r.key ? '' : r.key)}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {current.result === 'fail' && (
                      <input
                        type="text"
                        value={current.notes || ''}
                        onChange={(e) => setCriterion(criterion.key, 'notes', e.target.value)}
                        placeholder="Qué falla exactamente..."
                        className="review-criterion-notes"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decisión */}
          <div className="review-section">
            <div className="review-section-head">
              <h3>Decisión</h3>
            </div>
            <div className="review-decisions">
              {REVIEW_DECISIONS.map(d => (
                <button
                  key={d.key}
                  className={`review-decision review-${d.tone} ${review.decision === d.key ? 'active' : ''}`}
                  onClick={() => setReview(r => ({ ...r, decision: d.key }))}
                >
                  <span className="review-decision-label">{d.label}</span>
                  <span className="review-decision-desc">{d.desc}</span>
                </button>
              ))}
            </div>

            {decision && (
              <p className="review-effect">
                Al guardar se actualizará:{' '}
                {Object.entries(decision.effect).map(([k, v]) => (
                  <code key={k}>{k} → {v}</code>
                ))}
              </p>
            )}
          </div>

          {/* Feedback */}
          <div className="review-section">
            <div className="review-section-head">
              <h3>Feedback</h3>
              {fallos.length > 0 && (
                <span className="review-failed-count">{fallos.length} criterios fallan</span>
              )}
            </div>
            <p className="review-note">
              Cambios <strong>observables y accionables</strong>. Esto es lo que se lee al rehacer
              el asset: «suena mal» no sirve, «la cola es medio segundo larga y pisa el contador» sí.
            </p>
            <textarea
              value={review.feedback}
              onChange={(e) => setReview(r => ({ ...r, feedback: e.target.value }))}
              className="review-feedback"
              placeholder={
                fallos.length
                  ? `Qué corregir en: ${fallos.map(c => c.label.toLowerCase()).join(', ')}...`
                  : 'Observaciones para la siguiente iteración...'
              }
              rows={4}
            />
          </div>

          {problems.length > 0 && (
            <ul className="review-problems">
              {problems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancelar</button>
          <button
            className="save-btn"
            onClick={() => onSubmit(review)}
            disabled={problems.length > 0}
            title={problems.length ? problems[0] : 'Guardar la revisión y actualizar el estado'}
          >
            Guardar revisión
          </button>
        </div>
      </div>
    </div>
  );
};

export default SoundReviewPanel;
