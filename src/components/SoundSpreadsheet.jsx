import React, { useState } from 'react';
import PromptLibraryPanel from './PromptLibraryPanel';
import RowActions from './RowActions';
import PromptViewerPanel from './PromptViewerPanel';
import { buildRowActions, isDirectAudioUrl } from '../data/rowActions';
import { hasKey } from '../services/aiEngineSettings';
import {
  CATEGORIES,
  STATUS_AXES,
  SOURCE_GROUPS,
  BUILD_TYPES,
  TECHNICAL_PROFILES,
  PRIORITIES,
  PRIORITY_LABELS,
  validateFilename,
  isDiscarded
} from '../data/soundModel';

// Tabla maestra del Audio Production System.
// Implementa specs/reference/05_DATA_MODEL_AND_STATUSES.md §4.
//
// Los seis ejes de estado se muestran como columnas independientes: colapsarlos
// en una sola perdería la diferencia entre "mezclado" y "entregado".
//
// Revisión, mezcla y entrega son estados avanzados que el flujo de cada día no necesita:
// están ocultos por defecto y las «Opciones avanzadas» de la cabecera de la lista los muestran
// (FR-001a). Ocultarlos solo cambia lo que se ve; el estado de cada asset no se toca (FR-001b).
const ADVANCED_AXES = ['review_status', 'mix_status', 'delivery_status'];

const SoundSpreadsheet = ({
  sounds = [],
  onUpdateSound,
  onGenerateSound,
  onSetAudioSource,
  onDeleteSound,
  generatingSoundId,
  themeTag,
  onComposePrompt,
  onReviewSound,
  onDownloadDraft,
  showAdvanced = false
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [activeAudio, setActiveAudio] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [libraryTarget, setLibraryTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const visibleAxes = showAdvanced ? STATUS_AXES : STATUS_AXES.filter(axis => !ADVANCED_AXES.includes(axis.field));

  const handleDoubleClick = (id, field, value) => {
    setEditingCell({ id, field });
    setEditValue(value == null ? '' : String(value));
  };

  const handleBlur = (id, field) => {
    onUpdateSound(id, field, editValue);
    setEditingCell(null);
  };

  const handleKeyDown = (e, id, field) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur(id, field);
    }
    if (e.key === 'Escape') setEditingCell(null);
  };

  // Solo se puede reproducir lo que el navegador sabe abrir: audio generado en memoria o
  // la URL de un archivo de audio. Una ruta de disco (~/Audio/...) se muestra pero no suena,
  // y un enlace de Drive abre su propio reproductor: para eso está «Abrir enlace».
  const playableUrl = (sound) => {
    if (sound.localBlobUrl) return sound.localBlobUrl;
    const src = sound.audioSource || '';
    return isDirectAudioUrl(src) ? src : null;
  };

  const copyPrompt = async (sound) => {
    try {
      await navigator.clipboard.writeText(sound.prompt);
      return true;
    } catch {
      return false;
    }
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

  // Insertar REEMPLAZA el prompt de la fila: si ya tenía uno, se pregunta antes (FR-019m).
  const handleInsertPrompt = (texto) => {
    if (!libraryTarget) return;
    const current = sounds.find(s => s.id === libraryTarget.soundId)?.prompt;
    if (String(current || '').trim() && !window.confirm('Esta fila ya tiene un prompt. Insertar este lo reemplaza.\n\n¿Reemplazarlo?')) return;
    onUpdateSound(libraryTarget.soundId, 'prompt', texto);
    setLibraryTarget(null);
  };

  // --- Celdas reutilizables ---

  const TextCell = ({ sound, field, multiline = false, placeholder = '—', className = '' }) => {
    const isEditing = editingCell?.id === sound.id && editingCell?.field === field;

    return (
      <td
        className={`cell-editable ${className}`}
        onDoubleClick={() => handleDoubleClick(sound.id, field, sound[field])}
      >
        {isEditing ? (
          multiline ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleBlur(sound.id, field)}
              onKeyDown={(e) => handleKeyDown(e, sound.id, field)}
              className="cell-textarea"
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleBlur(sound.id, field)}
              onKeyDown={(e) => handleKeyDown(e, sound.id, field)}
              className="cell-input"
              autoFocus
            />
          )
        ) : (
          sound[field] || placeholder
        )}
      </td>
    );
  };

  const SelectCell = ({ sound, field, options, className = '' }) => (
    <td className={`cell-select ${className}`}>
      <select
        value={sound[field] ?? options[0]?.value}
        onChange={(e) => onUpdateSound(sound.id, field, e.target.value)}
        className="cell-dropdown"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </td>
  );

  const StatusCell = ({ sound, axis }) => (
    <td className="cell-select cell-status">
      <select
        value={sound[axis.field] || axis.values[0]}
        onChange={(e) => onUpdateSound(sound.id, axis.field, e.target.value)}
        className="cell-dropdown status-dropdown"
        style={{ color: axis.colors[sound[axis.field]] || axis.colors[axis.values[0]] }}
      >
        {axis.values.map(v => (
          <option key={v} value={v}>{axis.labels[v]}</option>
        ))}
      </select>
    </td>
  );

  const categoryOptions = CATEGORIES.map(c => ({ value: c.key, label: `${c.key} · ${c.label}` }));
  const sourceOptions = SOURCE_GROUPS.map(g => ({ value: g.key, label: g.label }));
  const buildOptions = BUILD_TYPES.map(b => ({ value: b.key, label: b.label }));
  const profileOptions = TECHNICAL_PROFILES.map(p => ({ value: p.key, label: p.label }));
  const priorityOptions = PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABELS[p] }));
  const loopOptions = [{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí' }];

  return (
    <div className="spreadsheet-container">
      <div className="spreadsheet-table-wrapper">
        <table className="excel-table master-list-table">
          <thead>
            <tr>
              <th className="row-num-col"></th>
              <th className="col-id">ID</th>
              <th className="col-filename">Nombre oficial</th>
              <th className="col-category">Categoría</th>
              <th className="col-event">Evento</th>
              <th className="col-usage">Momento de uso</th>
              <th className="col-objective">Objetivo</th>
              <th className="col-duration">Dur. (s)</th>
              <th className="col-priority">Prioridad</th>
              <th className="col-loop">Loop</th>
              <th className="col-source">Core / Skin</th>
              <th className="col-build">Single / Stems</th>
              <th className="col-profile">Perfil mezcla</th>
              {visibleAxes.map(axis => (
                <th key={axis.field} className="col-status" title={axis.label}>{axis.short}</th>
              ))}
              <th className="col-prompt-text">Prompt final</th>
              <th className="col-notes">Observaciones</th>
              <th className="col-actions">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {sounds.map((sound, index) => {
              const nameProblems = validateFilename(sound.official_filename, sound.category);

              return (
                <tr key={sound.id} className={isDiscarded(sound) ? 'row-discarded' : ''}>
                  <td className="row-num-cell">{index + 1}</td>
                  <td className="cell-id">{sound.id}</td>

                  <td
                    className={`cell-editable cell-filename ${nameProblems.length ? 'cell-invalid' : ''}`}
                    onDoubleClick={() => handleDoubleClick(sound.id, 'official_filename', sound.official_filename)}
                    title={nameProblems.join(' ')}
                  >
                    {editingCell?.id === sound.id && editingCell?.field === 'official_filename' ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleBlur(sound.id, 'official_filename')}
                        onKeyDown={(e) => handleKeyDown(e, sound.id, 'official_filename')}
                        className="cell-input"
                        autoFocus
                      />
                    ) : (
                      <>
                        {sound.official_filename || '—'}
                        {nameProblems.length > 0 && <span className="name-warning" title={nameProblems.join(' ')}>⚠</span>}
                      </>
                    )}
                  </td>

                  <SelectCell sound={sound} field="category" options={categoryOptions} />
                  <TextCell sound={sound} field="game_event" className="cell-event" />
                  <TextCell sound={sound} field="usage" />
                  <TextCell sound={sound} field="objective" />
                  <TextCell sound={sound} field="duration_seconds" className="cell-duration" />
                  <SelectCell sound={sound} field="priority" options={priorityOptions} />

                  <td className="cell-select">
                    <select
                      value={String(Boolean(sound.loop))}
                      onChange={(e) => onUpdateSound(sound.id, 'loop', e.target.value === 'true')}
                      className="cell-dropdown"
                    >
                      {loopOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>

                  <SelectCell sound={sound} field="source_group" options={sourceOptions} />
                  <SelectCell sound={sound} field="single_or_stems" options={buildOptions} />
                  <SelectCell sound={sound} field="technical_profile" options={profileOptions} />

                  {visibleAxes.map(axis => (
                    <StatusCell key={axis.field} sound={sound} axis={axis} />
                  ))}

                  <TextCell sound={sound} field="prompt" multiline className="cell-prompt-text" />
                  <TextCell sound={sound} field="notes" multiline />

                  <td className="cell-actions-buttons">
                    <RowActions
                      actions={buildRowActions(sound, {
                        playing: playingId === sound.id,
                        generating: generatingSoundId === sound.id,
                        hasElevenLabsKey: hasKey('elevenlabs'),
                        showAdvanced
                      })}
                      handlers={{
                        copy: () => copyPrompt(sound),
                        source: () => {
                          const src = window.prompt(
                            'Ruta o enlace del WAV masterizado:\n\n' +
                            'Puede ser el enlace de Drive o una ruta local (~/Audio/Juego/STG_big_win.wav).\n' +
                            'Solo un enlace web se puede abrir desde aquí.',
                            sound.audioSource || ''
                          );
                          if (src !== null) onSetAudioSource(sound.id, src);
                        },
                        open: () => window.open(sound.audioSource.trim(), '_blank', 'noopener,noreferrer'),
                        view: () => setViewTarget(sound),
                        play: () => playSound(sound),
                        download: () => onDownloadDraft?.(sound.id),
                        generate: () => onGenerateSound(sound.id, sound.prompt),
                        library: () => setLibraryTarget({
                          soundId: sound.id,
                          filename: sound.official_filename,
                          eventKey: sound.game_event
                        }),
                        compose: () => onComposePrompt(sound),
                        review: () => onReviewSound(sound),
                        delete: () => onDeleteSound(sound.id)
                      }}
                    />
                  </td>
                </tr>
              );
            })}

            {sounds.length === 0 && (
              <tr>
                <td colSpan={16 + visibleAxes.length} className="empty-excel-text">
                  Lista maestra vacía. Analiza el juego con la IA o carga la plantilla base de su género para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewTarget && (
        <PromptViewerPanel
          sound={sounds.find(s => s.id === viewTarget.id) || viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

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

export default SoundSpreadsheet;
