import React, { useState } from 'react';
import { ANALYSIS_SECTIONS, DOUBT_LEVELS, countDoubts } from '../data/analysisModel';
import { getProfile } from '../data/gameProfiles';

// Informe de análisis visual (fase 2).
//
// Implementa specs/reference/templates/VISUAL_ANALYSIS.md.
//
// Lo rellena la IA y lo corrige el director de audio. Que sea editable no es un
// extra: el modelo se equivoca al leer imágenes, y este informe alimenta las
// decisiones de todas las fases siguientes. Un error aquí se propaga.

const DoubtList = ({ level, items, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };

  return (
    <div className={`doubt-level doubt-${level.tone}`}>
      <div className="doubt-level-head">
        <span className="doubt-level-label">{level.label}</span>
        <span className="doubt-level-count">{items.length}</span>
      </div>
      <p className="doubt-level-desc">{level.desc}</p>

      <ul className="doubt-items">
        {items.map((item, i) => (
          <li key={`${item}-${i}`}>
            <span>{item}</span>
            <button
              className="doubt-remove"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              title="Quitar"
            >
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="doubt-empty">Nada aquí</li>}
      </ul>

      <div className="doubt-add-row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Añadir..."
          className="doubt-input"
        />
        <button className="doubt-add" onClick={add} disabled={!draft.trim()}>+</button>
      </div>
    </div>
  );
};

const AnalysisReport = ({ project, analysis, onUpdateAnalysis, collapsed, onToggleCollapse }) => {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const profile = getProfile(project.type);
  const discovery = project.discovery || {};

  // Preguntas del perfil que siguen sin respuesta. Son dudas reales de la fase 1
  // que el informe debe recoger, no ruido: cada una es un dato que la IA tuvo
  // que estimar.
  const unanswered = (profile.questions || []).filter(q => {
    const v = discovery[q.key];
    return v === undefined || v === null || String(v).trim() === '';
  });

  const totalDoubts = countDoubts(analysis) + unanswered.length;

  const startEdit = (sectionKey, fieldKey, value) => {
    setEditingField(`${sectionKey}.${fieldKey}`);
    setEditValue(value || '');
  };

  const commit = (sectionKey, fieldKey) => {
    onUpdateAnalysis({
      ...analysis,
      [sectionKey]: { ...analysis[sectionKey], [fieldKey]: editValue }
    });
    setEditingField(null);
  };

  const setDoubts = (levelKey, items) => {
    onUpdateAnalysis({
      ...analysis,
      doubts: { ...(analysis.doubts || {}), [levelKey]: items }
    });
  };

  if (collapsed) {
    return (
      <div className="dashboard-card analysis-report-card collapsed">
        <div className="report-header" onClick={onToggleCollapse}>
          <div>
            <h2>📋 Fase 2 · Análisis visual</h2>
            <p className="report-subtitle">
              {analysis.gameAnalysis?.theme || 'Sin tema definido'}
              {totalDoubts > 0 && ` · ${totalDoubts} dudas por resolver`}
            </p>
          </div>
          <button className="collapse-toggle-btn">▼ Mostrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card analysis-report-card">
      <div className="report-header">
        <div>
          <h2>📋 Fase 2 · Análisis visual</h2>
          <p className="report-subtitle">
            Doble clic en cualquier campo para corregirlo. La IA lee imágenes: revisa antes de producir.
          </p>
          {analysis.promptsVersion && (
            <p className="report-subtitle prompts-live-used">
              Análisis hecho con los prompts {analysis.promptsVersion}.
            </p>
          )}
        </div>
        <button className="collapse-toggle-btn" onClick={onToggleCollapse}>▲ Ocultar</button>
      </div>

      <div className="report-content">
        {ANALYSIS_SECTIONS.map(section => (
          <div className="report-section" key={section.key}>
            <div className="report-section-head">
              <h3>
                <span className="report-section-number">{section.number}</span>
                {section.title}
              </h3>
              <span className="report-section-desc">{section.desc}</span>
            </div>

            <div className="report-fields">
              {section.fields.map(field => {
                const id = `${section.key}.${field.key}`;
                const value = analysis[section.key]?.[field.key] || '';
                const isEditing = editingField === id;

                return (
                  <div
                    className={`report-field ${field.multiline ? 'wide' : ''} ${field.danger ? 'danger' : ''}`}
                    key={field.key}
                  >
                    <span className="report-field-label">
                      {field.label}
                      {field.hint && <span className="report-field-hint">{field.hint}</span>}
                    </span>

                    {isEditing ? (
                      field.multiline ? (
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commit(section.key, field.key)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingField(null); }}
                          className="report-field-textarea"
                          autoFocus
                        />
                      ) : (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commit(section.key, field.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commit(section.key, field.key);
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                          className="report-field-input"
                          autoFocus
                        />
                      )
                    ) : (
                      <span
                        className={`report-field-value ${!value ? 'empty' : ''}`}
                        onDoubleClick={() => startEdit(section.key, field.key, value)}
                        title="Doble clic para editar"
                      >
                        {value || 'Sin definir'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sección 5 — Dudas */}
        <div className="report-section">
          <div className="report-section-head">
            <h3>
              <span className="report-section-number">5</span>
              Dudas
            </h3>
            <span className="report-section-desc">
              Qué está confirmado y qué hay que validar antes de producir.
            </span>
          </div>

          {unanswered.length > 0 && (
            <div className="doubt-from-discovery">
              <strong>⚠ {unanswered.length} preguntas del perfil sin responder en la fase 1.</strong>
              <p>
                La IA tuvo que estimarlas: {unanswered.map(q => q.label.replace('¿', '').replace('?', '')).join(', ')}.
                Respóndelas en Descubrimiento y vuelve a analizar para que el alcance se calcule
                en vez de estimarse.
              </p>
            </div>
          )}

          <div className="doubt-grid">
            {DOUBT_LEVELS.map(level => (
              <DoubtList
                key={level.key}
                level={level}
                items={analysis.doubts?.[level.key] || []}
                onChange={(items) => setDoubts(level.key, items)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisReport;
