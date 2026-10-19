import React, { useState, useRef } from 'react';
import { getProfile, evaluateScope } from '../data/gameProfiles';
import { COMPLEXITY_LEVELS } from '../data/soundModel';
import { readDocument, ACCEPT_ATTRIBUTE, READABLE_EXTENSIONS } from '../data/documentReader';

// Fase 1 — Descubrimiento.
//
// Implementa specs/reference/04_PRODUCTION_WORKFLOW.md, Fase 1:
//   "Recibir imágenes, video, GDD o explicación. Identificar tipo de videojuego.
//    Seleccionar perfil. Determinar complejidad preliminar. Registrar dudas.
//    No generar prompts todavía."
//
// La ficha del juego recoge las preguntas obligatorias del perfil. Responderlas
// antes del análisis cambia el resultado: la fórmula de conteo del perfil
// necesita saber cuántos símbolos se animan y cuántos niveles de premio hay.
// Sin esos datos la IA estima; con ellos, calcula.

const DiscoveryPanel = ({
  engineName = 'la IA',
  project,
  onUpdateProject,
  onAnalyze,
  analyzing,
  images,
  onImagesChange,
  description,
  onDescriptionChange,
  collapsed = false,
  onToggleCollapse
}) => {
  const profile = getProfile(project.type);
  const discovery = project.discovery || {};
  const complexity = project.config?.complexity_level || 'standard';
  const [min, max] = profile.ranges[complexity] || profile.ranges.standard;

  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const contextFileRef = useRef(null);
  const [docStatus, setDocStatus] = useState('');

  const handleContextDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocStatus('Abriendo...');
    try {
      const { text } = await readDocument(file, setDocStatus);
      const prev = (project.context || '').trim();
      onUpdateProject({ ...project, context: prev ? `${prev}\n\n${text}` : text });
    } catch (err) {
      alert(err.message);
    } finally {
      setDocStatus('');
    }
  };

  const answered = profile.questions.filter(q => {
    const v = discovery[q.key];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
  const missing = profile.questions.filter(q => !answered.includes(q));

  const setAnswer = (key, value) => {
    onUpdateProject({ ...project, discovery: { ...discovery, [key]: value } });
  };

  const setComplexity = (level) => {
    onUpdateProject({
      ...project,
      config: { ...(project.config || {}), complexity_level: level }
    });
  };

  const scope = evaluateScope(project.type, complexity, (project.sounds || []).length);

  // En modo colapsado solo se resume: el proyecto ya está analizado y la fase 1
  // deja de ser el foco, pero sus datos siguen siendo consultables y editables.
  if (collapsed) {
    return (
      <div className="dashboard-card discovery-card collapsed">
        <div className="discovery-header" onClick={onToggleCollapse}>
          <div>
            <h2>🔍 Fase 1 · Descubrimiento</h2>
            <p className="discovery-subtitle">
              {profile.label} · {COMPLEXITY_LEVELS.find(c => c.key === complexity)?.label} ·
              {' '}{answered.length} de {profile.questions.length} preguntas respondidas
              {!project.context && ' · sin contexto definido'}
            </p>
          </div>
          <button className="collapse-toggle-btn">▼ Mostrar</button>
        </div>
      </div>
    );
  }

  const renderField = (q) => {
    const value = discovery[q.key] ?? '';

    if (q.type === 'boolean') {
      return (
        <div className="discovery-bool">
          {[['yes', 'Sí'], ['no', 'No']].map(([v, label]) => (
            <button
              key={v}
              className={`discovery-bool-btn ${value === v ? 'active' : ''}`}
              onClick={() => setAnswer(q.key, value === v ? '' : v)}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }

    return (
      <input
        type={q.type === 'number' ? 'number' : 'text'}
        min={q.type === 'number' ? 0 : undefined}
        value={value}
        onChange={(e) => setAnswer(q.key, e.target.value)}
        className="discovery-input"
        placeholder={q.type === 'number' ? '0' : '—'}
      />
    );
  };

  const visibleQuestions = showAllQuestions
    ? profile.questions
    : profile.questions.slice(0, 8);

  return (
    <div className="dashboard-card discovery-card">
      <div className="discovery-header">
        <div>
          <h2>🔍 Fase 1 · Descubrimiento</h2>
          <p className="discovery-subtitle">
            Antes de analizar nada: qué juego es, qué tamaño tiene y qué sabes ya de él.
          </p>
        </div>
        {onToggleCollapse && (
          <button className="collapse-toggle-btn" onClick={onToggleCollapse}>▲ Ocultar</button>
        )}
      </div>

      {/* Contexto del juego: lo primero que se sabe */}
      <div className="discovery-section">
        <div className="discovery-section-head">
          <h3>Contexto del juego</h3>
        </div>
        <p className="discovery-note">
          De qué trata: temática, escenario, personajes. Es lo primero que se define y
          encabeza el análisis que recibe la IA.
        </p>
        <textarea
          value={project.context || ''}
          onChange={(e) => onUpdateProject({ ...project, context: e.target.value })}
          className="form-textarea"
          placeholder="Ej. Jungla con ruinas antiguas, un tucán explorador buscando tótems de oro"
        />
        <div className="switcher-doc-row">
          <button
            type="button"
            className="switcher-doc-btn"
            onClick={() => contextFileRef.current?.click()}
            disabled={Boolean(docStatus)}
            title={`Formatos admitidos: ${READABLE_EXTENSIONS.join(', ')}`}
          >
            {docStatus || '📄 Añadir desde documento'}
          </button>
        </div>
        <input
          type="file"
          ref={contextFileRef}
          onChange={handleContextDocument}
          accept={ACCEPT_ATTRIBUTE}
          style={{ display: 'none' }}
        />
      </div>

      {/* Perfil y alcance */}
      <div className="discovery-section">
        <div className="discovery-section-head">
          <h3>Perfil y alcance</h3>
          <span className="discovery-profile-badge">{profile.label}</span>
        </div>
        <p className="discovery-note">{profile.objective}</p>

        <div className="config-radio-group">
          {COMPLEXITY_LEVELS.map(c => {
            const [cmin, cmax] = profile.ranges[c.key];
            return (
              <button
                key={c.key}
                className={`config-radio ${complexity === c.key ? 'active' : ''}`}
                onClick={() => setComplexity(c.key)}
              >
                <span className="config-radio-label">{c.label}</span>
                <span className="config-radio-meta">{cmin}–{cmax} assets</span>
              </button>
            );
          })}
        </div>

        <p className="discovery-note">
          Alcance esperado: <strong>{min}–{max} assets oficiales</strong>.
          {' '}{scope.level !== 'empty' && scope.message}
        </p>
      </div>

      {/* Ficha del juego */}
      <div className="discovery-section">
        <div className="discovery-section-head">
          <h3>Ficha del juego</h3>
          <span className={`discovery-progress ${missing.length === 0 ? 'complete' : ''}`}>
            {answered.length} de {profile.questions.length} respondidas
          </span>
        </div>
        <p className="discovery-note">
          Son las preguntas que el perfil <strong>{profile.label}</strong> necesita responder para
          dimensionar el trabajo. Lo que respondas aquí lo usa la IA para calcular en vez de estimar.
        </p>

        <div className="discovery-grid">
          {visibleQuestions.map(q => (
            <div className="discovery-field" key={q.key}>
              <label className="discovery-label">
                {q.label}
                {q.hint && <span className="discovery-hint">{q.hint}</span>}
              </label>
              {renderField(q)}
            </div>
          ))}
        </div>

        {profile.questions.length > 8 && (
          <button
            className="discovery-more-btn"
            onClick={() => setShowAllQuestions(!showAllQuestions)}
          >
            {showAllQuestions
              ? '▲ Mostrar menos'
              : `▼ Ver las ${profile.questions.length - 8} preguntas restantes`}
          </button>
        )}

        {missing.length > 0 && (
          <div className="discovery-warning">
            <strong>⚠ {missing.length} sin responder.</strong> La IA tendrá que estimarlas a partir
            de las imágenes: {missing.map(q => q.label.replace('¿', '').replace('?', '')).join(', ')}.
          </div>
        )}
      </div>

      {/* Material */}
      <div className="discovery-section">
        <div className="discovery-section-head">
          <h3>Material del juego y contexto visual</h3>
        </div>

        {/* Arte del juego / Capturas cargadas */}
        {project.coverImage && (
          <div className="discovery-cover-preview">
            <div className="discovery-cover-thumb-wrapper">
              <img src={project.coverImage} alt="Arte del juego" className="discovery-cover-img" />
              <div className="discovery-cover-badge">
                <span>🎨 Contexto visual activo</span>
                <span className="discovery-cover-hint">Esta imagen se enviará a {engineName} para contextualizar el audio</span>
              </div>
            </div>
          </div>
        )}

        <div className="discovery-field">
          <label className="discovery-label">
            {project.coverImage ? 'Añadir más imágenes o capturas' : 'Imágenes del juego'}
            <span className="discovery-hint">Capturas de pantalla, símbolos, logo o bocetos</span>
          </label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={onImagesChange}
            className="form-input"
          />
          {images && images.length > 0 && (
            <div className="discovery-selected-images">
              <span className="file-info">{images.length} imagen(es) seleccionada(s) para este análisis</span>
            </div>
          )}
        </div>

        <div className="discovery-field">
          <label className="discovery-label">
            Descripción y notas de diseño
            <span className="discovery-hint">Mecánica, ritmo, sensación y momentos clave</span>
          </label>
          <textarea
            value={description}
            onChange={onDescriptionChange}
            className="form-textarea"
            placeholder={
              project.context
                ? `Contexto del proyecto activo: "${project.context.slice(0, 100)}..."\n\nAñade detalles adicionales si lo deseas (opcional si ya subiste imagen o contexto).`
                : "Describe el ambiente, la jugabilidad, el ritmo y lo que ocurre en las imágenes..."
            }
          />
        </div>
      </div>

      {/* Riesgos del perfil */}
      {profile.risks?.length > 0 && (
        <details className="discovery-risks">
          <summary>Errores frecuentes en {profile.label}</summary>
          <ul>
            {profile.risks.map(r => <li key={r}>{r}</li>)}
          </ul>
        </details>
      )}

      {(() => {
        const hasContext = Boolean(
          description.trim() ||
          (project.context && project.context.trim()) ||
          (images && images.length > 0) ||
          project.coverImage
        );

        return (
          <div className="discovery-actions">
            <button
              onClick={onAnalyze}
              disabled={analyzing || !hasContext}
              className="analyze-btn"
              title={!hasContext ? 'Añade una descripción, contexto del proyecto o sube una imagen para analizar' : 'Analizar y proponer la lista maestra'}
            >
              {analyzing ? (
                <><span className="spinner"></span> Analizando con {engineName}...</>
              ) : (
                '🔍 Analizar y proponer lista maestra →'
              )}
            </button>
            <span className="discovery-actions-note">
              {project.coverImage || (images && images.length > 0) ? (
                <span>🎨 <strong>Análisis multimodal activo:</strong> {engineName} examinará la imagen para extraer materiales y paleta sonora.</span>
              ) : (
                <span>El análisis <strong>propone</strong>: nada se produce hasta que valides la lista.</span>
              )}
            </span>
          </div>
        );
      })()}
    </div>
  );
};

export default DiscoveryPanel;
