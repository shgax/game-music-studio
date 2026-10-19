import React, { useState } from 'react';
import PromptLibraryPanel from './PromptLibraryPanel';
import { hasKey } from '../services/aiEngineSettings';
import {
  STATUS_AXES,
  getAxis,
  SOURCE_GROUPS,
  PRIORITIES,
  PRIORITY_LABELS,
  getTechnicalProfile,
  VERSION_STATES,
  approveVersion,
  nextVersion,
  approvedVersion
} from '../data/soundModel';

// Tablero de producción.
//
// A diferencia del modelo antiguo (cuatro columnas fijas sobre un estado único),
// aquí el eje se elige: un asset recorre seis ejes independientes y cada uno
// responde a una pregunta distinta sobre el trabajo pendiente.

const PRIORITY_COLORS = { high: '#bd00ff', medium: '#00b8ff', low: '#6b7280' };

const SoundKanbanBoard = ({
  sounds = [],
  onUpdateSound,
  onGenerateSound,
  onSetAudioSource,
  onDeleteSound,
  generatingSoundId,
  themeTag,
  onComposePrompt,
  onReviewSound
}) => {
  const [activeAxisField, setActiveAxisField] = useState('production_status');
  const [activeAudio, setActiveAudio] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [libraryTarget, setLibraryTarget] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const axis = getAxis(activeAxisField) || STATUS_AXES[0];

  // Solo suena lo que el navegador sabe abrir: audio en memoria o una URL.
  const playableUrl = (sound) => {
    if (sound.localBlobUrl) return sound.localBlobUrl;
    const src = sound.audioSource || '';
    return /^https?:\/\//i.test(src) ? src : null;
  };

  const playSound = (sound) => {
    const url = playableUrl(sound);
    if (!url) return;

    if (playingId === sound.id) {
      if (activeAudio) activeAudio.pause();
      setActiveAudio(null);
      setPlayingId(null);
      return;
    }
    if (activeAudio) activeAudio.pause();

    const audio = new Audio(url);
    audio.play();
    setActiveAudio(audio);
    setPlayingId(sound.id);
    audio.onended = () => {
      setPlayingId(null);
      setActiveAudio(null);
    };
  };

  // Mover una tarjeta avanza o retrocede un paso dentro del eje activo.
  const moveSound = (sound, direction) => {
    const current = axis.values.indexOf(sound[axis.field]);
    const next = current + direction;
    if (next < 0 || next >= axis.values.length) return;
    onUpdateSound(sound.id, axis.field, axis.values[next]);
  };

  const copyEvent = async (sound) => {
    try {
      await navigator.clipboard.writeText(sound.game_event || sound.official_filename || '');
      setCopiedId(sound.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(null);
    }
  };

  const handleInsertPrompt = (texto) => {
    if (libraryTarget) onUpdateSound(libraryTarget.soundId, 'prompt', texto);
    setLibraryTarget(null);
  };

  return (
    <div className="kanban-container">
      <div className="kanban-axis-selector">
        <span className="kanban-axis-label">Ver por eje:</span>
        {STATUS_AXES.map(a => (
          <button
            key={a.field}
            className={`kanban-axis-btn ${a.field === activeAxisField ? 'active' : ''}`}
            onClick={() => setActiveAxisField(a.field)}
            title={`Agrupar por ${a.label.toLowerCase()}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="kanban-board" style={{ gridTemplateColumns: `repeat(${axis.values.length}, minmax(230px, 1fr))` }}>
        {axis.values.map(value => {
          const colSounds = sounds.filter(s => (s[axis.field] || axis.values[0]) === value);
          const color = axis.colors[value];

          return (
            <div className="kanban-column" key={value}>
              <div className="kanban-column-header" style={{ borderTopColor: color }}>
                <span className="kanban-column-title" style={{ color }}>{axis.labels[value]}</span>
                <span className="kanban-column-count">{colSounds.length}</span>
              </div>

              <div className="kanban-column-body">
                {colSounds.map(sound => {
                  const isOpen = expandedCardId === sound.id;
                  const index = axis.values.indexOf(sound[axis.field] || axis.values[0]);
                  const profile = getTechnicalProfile(sound.technical_profile);

                  return (
                    <div className="kanban-card" key={sound.id} style={{ borderLeftColor: color }}>
                      <div className="kanban-card-head">
                        <span className="kanban-card-id">{sound.id}</span>
                        <span
                          className="kanban-card-priority"
                          style={{ color: PRIORITY_COLORS[sound.priority] || PRIORITY_COLORS.medium }}
                        >
                          {PRIORITY_LABELS[sound.priority] || 'Media'}
                        </span>
                      </div>

                      <div className="kanban-card-name">{sound.official_filename || '(sin nombre oficial)'}</div>

                      <button
                        className="kanban-card-event"
                        onClick={() => copyEvent(sound)}
                        title="Copiar la clave de evento al portapapeles"
                      >
                        {copiedId === sound.id ? '✓ copiado' : (sound.game_event || '—')}
                      </button>

                      <div className="kanban-card-tags">
                        <span className="kanban-tag">{sound.category}</span>
                        <span className="kanban-tag">{sound.single_or_stems === 'stems' ? 'Stems' : 'Single'}</span>
                        <span className="kanban-tag" title={profile.usage}>{profile.label}</span>
                        {approvedVersion(sound) && (
                          <span className="kanban-tag kanban-tag-version" title="Versión aprobada">
                            {approvedVersion(sound).label}
                          </span>
                        )}
                      </div>

                      <div className="kanban-card-actions">
                        <button
                          onClick={() => moveSound(sound, -1)}
                          disabled={index <= 0}
                          className="kanban-move-btn"
                          title="Retroceder en este eje"
                        >
                          ←
                        </button>

                        {playableUrl(sound) && (
                          <button
                            onClick={() => playSound(sound)}
                            className={`kanban-play-btn ${playingId === sound.id ? 'playing' : ''}`}
                            title="Reproducir"
                          >
                            {playingId === sound.id ? '■' : '▶'}
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedCardId(isOpen ? null : sound.id)}
                          className="kanban-inspect-btn"
                          title="Ajustar este asset"
                        >
                          {isOpen ? '▲' : '✏️'}
                        </button>

                        <button
                          onClick={() => moveSound(sound, 1)}
                          disabled={index >= axis.values.length - 1}
                          className="kanban-move-btn"
                          title="Avanzar en este eje"
                        >
                          →
                        </button>
                      </div>

                      {isOpen && (
                        <div className="kanban-card-inspector">
                          <div className="inspector-group">
                            <label>Prioridad</label>
                            <select
                              value={sound.priority || 'medium'}
                              onChange={(e) => onUpdateSound(sound.id, 'priority', e.target.value)}
                              className="inspector-select"
                            >
                              {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                            </select>
                          </div>

                          <div className="inspector-group">
                            <label>Origen del asset</label>
                            <select
                              value={sound.source_group || 'project_skin'}
                              onChange={(e) => onUpdateSound(sound.id, 'source_group', e.target.value)}
                              className="inspector-select"
                            >
                              {SOURCE_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                            </select>
                          </div>

                          {/* Los seis ejes accesibles sin cambiar de vista */}
                          <div className="inspector-group">
                            <label>Estados</label>
                            <div className="inspector-axes">
                              {STATUS_AXES.map(a => (
                                <div className="inspector-axis-row" key={a.field}>
                                  <span className="inspector-axis-name">{a.short}</span>
                                  <select
                                    value={sound[a.field] || a.values[0]}
                                    onChange={(e) => onUpdateSound(sound.id, a.field, e.target.value)}
                                    className="inspector-select inspector-select-sm"
                                    style={{ color: a.colors[sound[a.field]] || a.colors[a.values[0]] }}
                                  >
                                    {a.values.map(v => <option key={v} value={v}>{a.labels[v]}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="inspector-group">
                            <div className="inspector-label-row">
                              <label>Prompt final</label>
                              <button
                                onClick={() => onComposePrompt(sound)}
                                className="inspector-btn-library"
                                title="Componer por partes"
                              >
                                🧩 Componer
                              </button>
                              <button
                                onClick={() => setLibraryTarget({
                                  soundId: sound.id,
                                  filename: sound.official_filename,
                                  eventKey: sound.game_event
                                })}
                                className="inspector-btn-library"
                                title="Insertar un prompt de la biblioteca"
                              >
                                📚 Biblioteca
                              </button>
                            </div>
                            <textarea
                              value={sound.prompt || ''}
                              onChange={(e) => onUpdateSound(sound.id, 'prompt', e.target.value)}
                              className="inspector-textarea"
                              placeholder="Prompt en inglés siguiendo la fórmula de 8 componentes..."
                            />
                          </div>

                          <div className="inspector-group">
                            <label>Observaciones</label>
                            <textarea
                              value={sound.notes || ''}
                              onChange={(e) => onUpdateSound(sound.id, 'notes', e.target.value)}
                              className="inspector-textarea"
                            />
                          </div>

                          <div className="inspector-group">
                            <div className="inspector-label-row">
                              <label>Versiones</label>
                              <button
                                onClick={() => onUpdateSound(
                                  sound.id, 'versions',
                                  [...(sound.versions || []), nextVersion(sound.versions)]
                                )}
                                className="inspector-btn-library"
                                title="Añadir una versión de trabajo"
                              >
                                + Versión
                              </button>
                            </div>

                            {(sound.versions || []).length === 0 ? (
                              <span className="version-empty">
                                Sin versiones registradas. El entregable es {sound.official_filename || 'el nombre oficial'}.
                              </span>
                            ) : (
                              <div className="version-list">
                                {sound.versions.map(v => {
                                  const state = VERSION_STATES.find(st => st.key === v.status) || VERSION_STATES[0];
                                  const isApproved = v.status === 'approved';
                                  return (
                                    <div className="version-row" key={v.label}>
                                      <button
                                        className={`version-radio ${isApproved ? 'active' : ''}`}
                                        onClick={() => onUpdateSound(
                                          sound.id, 'versions',
                                          approveVersion(sound.versions, v.label)
                                        )}
                                        title={isApproved ? 'Es la versión aprobada' : 'Aprobar esta versión'}
                                      >
                                        {isApproved ? '●' : '○'}
                                      </button>
                                      <span className="version-label">{v.label}</span>
                                      <select
                                        value={v.status}
                                        onChange={(e) => onUpdateSound(
                                          sound.id, 'versions',
                                          e.target.value === 'approved'
                                            ? approveVersion(sound.versions, v.label)
                                            : sound.versions.map(x => x.label === v.label ? { ...x, status: e.target.value } : x)
                                        )}
                                        className="inspector-select inspector-select-sm"
                                        style={{ color: state.color }}
                                      >
                                        {VERSION_STATES.map(st => (
                                          <option key={st.key} value={st.key}>{st.label}</option>
                                        ))}
                                      </select>
                                      <button
                                        className="version-remove"
                                        onClick={() => onUpdateSound(
                                          sound.id, 'versions',
                                          sound.versions.filter(x => x.label !== v.label)
                                        )}
                                        title="Quitar"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                                <span className="version-note">
                                  El asset oficial no lleva sufijo: se entrega {sound.official_filename || '—'}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="inspector-group">
                            <label>Archivo masterizado</label>
                            <div className="inspector-link-row">
                              <button
                                onClick={() => {
                                  const src = window.prompt(
                                    'Ruta o enlace del WAV masterizado:',
                                    sound.audioSource || ''
                                  );
                                  if (src !== null) onSetAudioSource(sound.id, src);
                                }}
                                className="inspector-btn-link"
                              >
                                {sound.audioSource ? '📁 Cambiar ruta' : '📁 Registrar ruta'}
                              </button>
                              {playableUrl(sound) && (
                                <a href={playableUrl(sound)} target="_blank" rel="noreferrer" className="inspector-link-open">↗️</a>
                              )}
                            </div>
                            {sound.audioSource && (
                              <span className="inspector-audio-path" title={sound.audioSource}>
                                {sound.audioSource}
                              </span>
                            )}
                          </div>

                          {/* Generar dentro de la herramienta es opcional: solo si hay clave de ElevenLabs. */}
                          {hasKey('elevenlabs') && (
                            <div className="inspector-group">
                              <label>Generación con IA</label>
                              <button
                                onClick={() => onGenerateSound(sound.id, sound.prompt)}
                                disabled={generatingSoundId === sound.id || !sound.prompt}
                                className="inspector-btn-generate"
                              >
                                {generatingSoundId === sound.id ? 'Generando...' : '🤖 Generar con ElevenLabs'}
                              </button>
                            </div>
                          )}

                          <div className="inspector-group">
                            <label>Revisión</label>
                            <button
                              onClick={() => onReviewSound(sound)}
                              className="inspector-btn-generate"
                            >
                              🎧 {sound.reviews?.length
                                ? `Revisar (${sound.reviews.length} previas)`
                                : 'Abrir ficha de revisión'}
                            </button>
                          </div>

                          <button
                            onClick={() => onDeleteSound(sound.id)}
                            className="inspector-btn-delete"
                          >
                            Eliminar asset
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {colSounds.length === 0 && (
                  <div className="kanban-empty-col">Sin assets en este estado</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {libraryTarget && (
        <PromptLibraryPanel
          target={libraryTarget}
          themeTag={themeTag}
          onInsert={handleInsertPrompt}
          onClose={() => setLibraryTarget(null)}
        />
      )}
    </div>
  );
};

export default SoundKanbanBoard;
