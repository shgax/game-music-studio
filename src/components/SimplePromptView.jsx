import React, { useMemo, useState } from 'react';
import GuideStepper from './GuideStepper';
import GlossaryPanel from './GlossaryPanel';
import EmptyStart from './EmptyStart';
import SoundPromptRow from './SoundPromptRow';
import { CATEGORIES, isDiscarded } from '../data/soundModel';
import { getProfile } from '../data/gameProfiles';
import { generationNoticeSeen, markGenerationNoticeSeen } from '../services/uiPreferences';
import {
  BLOCKED, CREDITS_NOTICE, DESCRIPTION_EXAMPLE, PROMPT_EXAMPLE
} from '../data/guideContent';

// La vista simple (feature 010): lo necesario para pasar de unas capturas a los
// bocetos de sonido y a un documento para el equipo del juego, y nada más.
//
// Ocultar los seis ejes de estado NO los elimina: siguen existiendo por sonido, y esta
// vista solo mueve dos —`planning_status` al aprobar para producción y
// `production_status` al generar—. La vista completa, siempre a un clic en la barra
// superior, los muestra (Artículo V).
//
// Es un componente CONTROLADO: no tiene estado de negocio. Todo lo que decide algo
// —analizar, aprobar, generar, guardar un enlace, exportar— es una intención que
// resuelve ProjectManager con los mismos handlers que usa la vista completa. Tabla,
// tablero y esta vista leen el mismo array de proyectos.

// Un recurso de mezcla (MIX_) no es un sonido que generar ni que integrar, y un sonido
// descartado ya no forma parte del trabajo.
const isListed = (s) => s.category !== 'MIX' && !isDiscarded(s);

const SimplePromptView = ({
  project,
  engineLabel,
  engineKeyReady,
  imageSupport,
  elevenLabsReady,
  guideStep,
  guideHidden,
  onToggleGuide,
  onOpenConfig,
  images,
  onImagesChange,
  description,
  onDescriptionChange,
  analyzing,
  onAnalyze,
  drafts,
  generatingId,
  onUpdatePrompt,
  onApprove,
  onGenerate,
  onDownloadDraft,
  onSetAudioSource,
  onCopyPrompts,
  onExport,
  notice,
  onCreateProject,
  onLoadExample,
  exampleLoaded
}) => {
  const [showGlossary, setShowGlossary] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  // Sonidos que la persona deja FUERA del documento. Por defecto entra todo.
  const [excluded, setExcluded] = useState(() => new Set());
  const [pendingGenerate, setPendingGenerate] = useState(null);
  const [openPart, setOpenPart] = useState(null);

  const sounds = useMemo(() => (project?.sounds || []).filter(isListed), [project]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sounds.filter(s => {
      if (category !== 'all' && s.category !== category) return false;
      if (!q) return true;
      return [s.official_filename, s.usage, s.game_event].some(t => String(t || '').toLowerCase().includes(q));
    });
  }, [sounds, query, category]);

  const glossary = <GlossaryPanel open={showGlossary} onClose={() => setShowGlossary(false)} />;

  // Sin ningún juego: el trabajo en blanco y la invitación a crear el primero.
  if (!project) {
    return (
      <div className="simple-view">
        <div className="guide-collapsed">
          <button type="button" className="guide-link-btn" onClick={() => setShowGlossary(true)}>
            📖 Glosario
          </button>
        </div>
        <EmptyStart onCreate={onCreateProject} onLoadExample={onLoadExample} exampleLoaded={exampleLoaded} />
        {glossary}
      </div>
    );
  }

  const approvedCount = sounds.filter(s => s.planning_status === 'approved_for_production').length;
  const markedGenerated = sounds.filter(s => s.production_status === 'generated').length;
  const withDraft = sounds.filter(s => drafts[s.id]).length;
  const pendingToApprove = filtered.filter(s => s.planning_status !== 'approved_for_production');

  const includedIds = sounds.filter(s => !excluded.has(s.id)).map(s => s.id);
  const includedSounds = sounds.filter(s => !excluded.has(s.id));
  const linkedCount = includedSounds.filter(s => String(s.audioSource || '').trim()).length;

  const toggleInclude = (id, include) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Analizar de nuevo REEMPLAZA la lista, con sus aprobaciones, prompts editados y
  // enlaces. Se pide confirmar antes de perderlos.
  const handleAnalyze = () => {
    if (sounds.length > 0 && !window.confirm(
      'Analizar de nuevo REEMPLAZA la lista actual, con las aprobaciones, los prompts que hayas editado y los enlaces que hayas registrado. ¿Continuar?'
    )) return;

    // Con imágenes y un modelo del que no se sabe si las ve, se pregunta antes de
    // enviarlas (FR-018). Si dice que no, puede cambiar de modelo y volver.
    if (images.length > 0 && imageSupport === 'unknown' && !window.confirm(
      'No se puede confirmar que este modelo vea imágenes. ¿Enviar tus capturas de todos modos? Si prefieres, cancela y elige otro modelo en Configuración.'
    )) return;

    onAnalyze();
  };

  // La primera generación avisa de que gasta créditos de la cuenta de la persona.
  const requestGenerate = (id) => {
    if (!generationNoticeSeen()) {
      setPendingGenerate(id);
      return;
    }
    onGenerate(id);
  };

  const confirmGenerate = () => {
    markGenerationNoticeSeen();
    const id = pendingGenerate;
    setPendingGenerate(null);
    if (id) onGenerate(id);
  };

  const analyzeBlocked = !engineKeyReady
    ? BLOCKED.needEngineKey
    : !description.trim()
      ? BLOCKED.needDescription
      : '';

  const profile = getProfile(project.type);
  const examplePrompt = PROMPT_EXAMPLE.parts.map(p => p.text).join(' ');
  const selectedPart = PROMPT_EXAMPLE.parts.find(p => p.key === openPart);

  return (
    <div className="simple-view">
      <GuideStepper
        step={guideStep}
        hidden={guideHidden}
        onToggleHidden={onToggleGuide}
        onOpenGlossary={() => setShowGlossary(true)}
      />

      {/* 1 · Cuenta tu juego */}
      <section className="simple-card" aria-labelledby="simple-material">
        <h2 id="simple-material"><span className="simple-card-num">1</span> Cuenta tu juego</h2>

        <p className="simple-meta">
          <strong>{project.name}</strong> · {profile.label}
        </p>
        <p className="simple-meta">
          Se analizará con <strong>{engineLabel}</strong>{' '}
          <button type="button" className="guide-link-btn" onClick={onOpenConfig}>Cambiar</button>
        </p>

        {images.length > 0 && imageSupport === 'no' && (
          <p className="simple-warning" role="alert">
            Este modelo no ve imágenes: el análisis usará solo tu descripción. Si quieres que mire tus
            capturas, elige otro modelo en Configuración.
          </p>
        )}
        {images.length > 0 && imageSupport === 'unknown' && (
          <p className="simple-warning" role="alert">
            No se puede saber si este modelo ve imágenes. Antes de analizar te preguntaremos si quieres enviarlas.
          </p>
        )}

        <div className="input-group">
          <span className="simple-label-text" id="simple-images-label">Capturas del juego (opcional, pero ayudan mucho)</span>
          {/* El selector nativo sale en el idioma del navegador y con su botón gris:
              se oculta y una etiqueta con el aspecto de los demás botones lo abre. */}
          <label className="simple-file" htmlFor="simple-images">
            <input
              id="simple-images"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={onImagesChange}
              className="simple-file-input"
              aria-labelledby="simple-images-label"
            />
            <span className="simple-file-btn">{images.length > 0 ? 'Cambiar imágenes' : 'Elegir imágenes'}</span>
            <span className="simple-file-name">
              {images.length > 0 ? `${images.length} imagen(es) seleccionada(s)` : 'Ninguna seleccionada'}
            </span>
          </label>
        </div>

        <div className="input-group">
          <label htmlFor="simple-description">¿Cómo quieres que suene?</label>
          <textarea
            id="simple-description"
            className="modal-input simple-description"
            rows={5}
            placeholder="Cuenta el ambiente, los materiales y lo que no debe sonar…"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        <details className="simple-example">
          <summary>{DESCRIPTION_EXAMPLE.label}</summary>
          <p className="simple-example-text">{DESCRIPTION_EXAMPLE.text}</p>
          <ul>
            {DESCRIPTION_EXAMPLE.tips.map(tip => <li key={tip}>{tip}</li>)}
          </ul>
          {!description.trim() && (
            <button
              type="button"
              className="simple-secondary-btn"
              onClick={() => onDescriptionChange(DESCRIPTION_EXAMPLE.text)}
            >
              Usar este ejemplo como punto de partida
            </button>
          )}
        </details>

        <div className="simple-actions">
          <button
            type="button"
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={analyzing || Boolean(analyzeBlocked)}
            aria-describedby={analyzeBlocked ? 'simple-analyze-blocked' : undefined}
          >
            {analyzing
              ? <><span className="spinner"></span> Analizando con {engineLabel.split(' ')[0]}…</>
              : sounds.length > 0 ? '🔍 Analizar de nuevo' : '🔍 Analizar y proponer sonidos →'}
          </button>
          {!engineKeyReady && (
            <button type="button" className="simple-secondary-btn" onClick={onOpenConfig}>Abrir configuración</button>
          )}
        </div>
        {analyzeBlocked && <p className="simple-hint" id="simple-analyze-blocked">{analyzeBlocked}</p>}
      </section>

      {/* 2 · Revisa la lista */}
      <section className="simple-card" aria-labelledby="simple-list">
        <h2 id="simple-list"><span className="simple-card-num">2–3</span> Revisa la lista, genera y guarda</h2>

        {sounds.length === 0 ? (
          <p className="simple-hint">
            {BLOCKED.needSoundsToExport} Cuando la IA proponga los sonidos, aparecerán aquí.
          </p>
        ) : (
          <>
            <p className="simple-counts" role="status">
              <span><strong>{sounds.length}</strong> propuestos</span>
              <span><strong>{approvedCount}</strong> aprobados para producción</span>
              <span><strong>{markedGenerated}</strong> marcados como generados</span>
              <span><strong>{withDraft}</strong> con borrador en esta sesión</span>
            </p>

            <details className="simple-example">
              <summary>{PROMPT_EXAMPLE.label}</summary>
              <p>{PROMPT_EXAMPLE.intro}</p>
              <p className="simple-prompt-demo">
                {PROMPT_EXAMPLE.parts.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={`simple-prompt-part ${openPart === p.key ? 'active' : ''}`}
                    aria-pressed={openPart === p.key}
                    onClick={() => setOpenPart(openPart === p.key ? null : p.key)}
                  >
                    {p.text}
                  </button>
                ))}
              </p>
              {selectedPart
                ? <p className="simple-prompt-why"><strong>{selectedPart.name}.</strong> {selectedPart.why}</p>
                : <p className="simple-hint">Prompt completo: {examplePrompt}</p>}
            </details>

            <div className="simple-toolbar">
              <input
                type="search"
                className="modal-input"
                placeholder="Buscar un sonido…"
                aria-label="Buscar un sonido"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="modal-input"
                aria-label="Filtrar por categoría"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Todas las categorías</option>
                {CATEGORIES.filter(c => c.key !== 'MIX' && sounds.some(s => s.category === c.key)).map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="simple-secondary-btn"
                onClick={() => onApprove(pendingToApprove.map(s => s.id), true)}
                disabled={pendingToApprove.length === 0}
              >
                Aprobar para producción todos ({pendingToApprove.length})
              </button>
              <button type="button" className="simple-secondary-btn" onClick={onCopyPrompts}>
                Copiar todos los prompts
              </button>
            </div>
            {notice && <p className="simple-hint" role="status">{notice}</p>}

            {pendingGenerate && (
              <div className="simple-warning" role="alertdialog" aria-label="Aviso de créditos">
                <p>{CREDITS_NOTICE}</p>
                <div className="simple-actions">
                  <button type="button" className="simple-primary-btn" onClick={confirmGenerate}>Entendido, generar</button>
                  <button type="button" className="simple-secondary-btn" onClick={() => setPendingGenerate(null)}>Cancelar</button>
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <p className="simple-hint">Ningún sonido coincide con la búsqueda.</p>
            )}

            <div className="simple-rows">
              {filtered.map(sound => (
                <SoundPromptRow
                  key={sound.id}
                  sound={sound}
                  draft={drafts[sound.id] || null}
                  generating={generatingId === sound.id}
                  elevenLabsReady={elevenLabsReady}
                  included={!excluded.has(sound.id)}
                  onToggleInclude={toggleInclude}
                  onPromptChange={onUpdatePrompt}
                  onApprove={(id, approved) => onApprove([id], approved)}
                  onGenerate={requestGenerate}
                  onDownload={onDownloadDraft}
                  onLinkChange={onSetAudioSource}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* 4 · Comparte con el equipo. Los pasos 2 y 3 comparten tarjeta porque ocurren
          sobre las mismas filas: se aprueba, se genera y se registra el enlace. */}
      <section className="simple-card" aria-labelledby="simple-share">
        <h2 id="simple-share"><span className="simple-card-num">4</span> Comparte con el equipo</h2>
        <p className="simple-hint">
          Genera un archivo con los nombres de los sonidos, para qué momento del juego son y su
          enlace. No lleva prompts ni tus claves, y se abre sin esta herramienta.
        </p>

        {sounds.length === 0 ? (
          <p className="simple-hint">{BLOCKED.needSoundsToExport}</p>
        ) : (
          <>
            <p className="simple-counts" role="status">
              <span><strong>{includedIds.length}</strong> sonidos en el documento</span>
              <span><strong>{linkedCount}</strong> con enlace</span>
              <span><strong>{includedIds.length - linkedCount}</strong> pendientes</span>
            </p>
            {linkedCount === 0 && <p className="simple-hint">{BLOCKED.needLinkToExport}</p>}
            <div className="simple-actions">
              <button
                type="button"
                className="simple-primary-btn"
                onClick={() => onExport('html', includedIds)}
                disabled={includedIds.length === 0}
              >
                Exportar página web (HTML)
              </button>
              <button
                type="button"
                className="simple-primary-btn"
                onClick={() => onExport('xlsx', includedIds)}
                disabled={includedIds.length === 0}
              >
                Exportar hoja de Excel
              </button>
            </div>
            {includedIds.length === 0 && (
              <p className="simple-hint">Marca «Incluir en el documento» en al menos un sonido para exportar.</p>
            )}
          </>
        )}
      </section>

      {glossary}
    </div>
  );
};

export default SimplePromptView;
