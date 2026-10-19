import React, { useState, useRef, useEffect } from 'react';
import { GAME_TYPES, getProfile } from '../data/gameProfiles';
import { COMPLEXITY_LEVELS } from '../data/soundModel';
import { readDocument, ACCEPT_ATTRIBUTE, READABLE_EXTENSIONS } from '../data/documentReader';

// Selector de proyecto activo, en la barra superior.
//
// Sustituye a la antigua barra lateral: la tabla maestra tiene 21 columnas y
// necesita todo el ancho disponible. Muestra siempre el juego en el que se
// trabaja y permite cambiar o crear sin ocupar espacio permanente.

const ProjectSwitcher = ({
  projects = [],
  selectedProjectId,
  onSelect,
  onCreate,
  loading
}) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [themeTag, setThemeTag] = useState('');
  const [type, setType] = useState('Slot');
  const [complexity, setComplexity] = useState('standard');
  const containerRef = useRef(null);
  const fileRef = useRef(null);
  const imageInputRef = useRef(null);
  const [docName, setDocName] = useState('');
  const [docStatus, setDocStatus] = useState('');

  const selected = projects.find(p => p.id === selectedProjectId);

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onEscape = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCreating(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCoverImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onCreate({
      name: name.trim(),
      context: context.trim(),
      themeTag: themeTag.trim(),
      type,
      complexity,
      coverImage
    });
    setName('');
    setContext('');
    setThemeTag('');
    setDocName('');
    setCoverImage(null);
    setCreating(false);
    setOpen(false);
  };

  // El brief de un juego suele llegar como documento. Se vuelca al contexto en
  // vez de obligar a copiar y pegar.
  const handleDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setDocStatus('Abriendo...');
    try {
      const { text, name, chars, detail } = await readDocument(file, setDocStatus);
      setContext(prev => prev.trim() ? `${prev.trim()}\n\n${text}` : text);
      setDocName(`${name} · ${chars.toLocaleString('es')} caracteres${detail ? ` · ${detail}` : ''}`);
    } catch (err) {
      alert(err.message);
      setDocName('');
    } finally {
      setDocStatus('');
    }
  };

  const describe = (project) => {
    const level = COMPLEXITY_LEVELS.find(
      c => c.key === (project.config?.complexity_level || 'standard')
    );
    return `${getProfile(project.type).label} · ${level?.label || 'Estándar'}`;
  };

  return (
    <div className="project-switcher" ref={containerRef}>
      <button
        className={`switcher-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        disabled={loading}
      >
        {selected?.coverImage ? (
          <img src={selected.coverImage} alt={selected.name} className="switcher-thumb" />
        ) : (
          <span className="switcher-icon">🎮</span>
        )}
        <span className="switcher-current">
          {loading ? (
            <span className="switcher-name">Cargando proyectos...</span>
          ) : selected ? (
            <>
              <span className="switcher-name">{selected.name}</span>
              <span className="switcher-meta">
                {describe(selected)} · {selected.sounds?.length || 0} assets
              </span>
            </>
          ) : (
            <span className="switcher-name">Selecciona un juego</span>
          )}
        </span>
        <span className="switcher-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="switcher-dropdown">
          {creating ? (
            <form onSubmit={handleSubmit} className="switcher-form">
              <label className="switcher-form-label">Nombre del videojuego</label>
              <input
                type="text"
                placeholder="Ej. Jungle Quest"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="switcher-input"
                autoFocus
                required
              />

              <label className="switcher-form-label">
                ¿De qué trata?
                <span className="switcher-form-hint">
                  El contexto del juego: temática, escenario, personajes
                </span>
              </label>
              <textarea
                placeholder="Ej. Jungla con ruinas antiguas, un tucán explorador buscando tótems de oro"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="switcher-input switcher-textarea"
                rows={4}
              />

              <div className="switcher-doc-row">
                <button
                  type="button"
                  className="switcher-doc-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={Boolean(docStatus)}
                  title={`Formatos admitidos: ${READABLE_EXTENSIONS.join(', ')}`}
                >
                  {docStatus || '📄 Cargar desde documento'}
                </button>
                {docName && <span className="switcher-doc-name">{docName}</span>}
                {context && (
                  <button
                    type="button"
                    className="switcher-doc-clear"
                    onClick={() => { setContext(''); setDocName(''); }}
                    title="Vaciar el contexto"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileRef}
                onChange={handleDocument}
                accept={ACCEPT_ATTRIBUTE}
                style={{ display: 'none' }}
              />

              <div className="switcher-image-row">
                <label className="switcher-form-label">
                  Imagen o arte del juego (Contexto visual)
                  <span className="switcher-form-hint">
                    Captura de pantalla, logo o concept art para que la IA entienda el estilo visual y materiales
                  </span>
                </label>
                {coverImage ? (
                  <div className="switcher-img-preview-card">
                    <img src={coverImage} alt="Preview arte" className="switcher-preview-thumb" />
                    <div className="switcher-img-preview-meta">
                      <span className="switcher-img-badge">✓ Contexto visual listo</span>
                      <button
                        type="button"
                        className="switcher-img-clear-btn"
                        onClick={() => setCoverImage(null)}
                      >
                        Quitar imagen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="switcher-doc-btn"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    🖼️ Subir imagen o captura del juego
                  </button>
                )}
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>

              <label className="switcher-form-label">
                Etiqueta temática
                <span className="switcher-form-hint">
                  En inglés y corta. Va literalmente en cada prompt. Si la dejas vacía, la propone la IA al analizar
                </span>
              </label>
              <input
                type="text"
                placeholder="jungle ruins expedition"
                value={themeTag}
                onChange={(e) => setThemeTag(e.target.value)}
                className="switcher-input"
              />

              <label className="switcher-form-label">Género</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="switcher-input"
              >
                {GAME_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>

              <label className="switcher-form-label">
                Complejidad
                <span className="switcher-form-hint">guía de alcance, no etiqueta comercial</span>
              </label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value)}
                className="switcher-input"
              >
                {COMPLEXITY_LEVELS.map(c => {
                  const [min, max] = getProfile(type).ranges[c.key];
                  return (
                    <option key={c.key} value={c.key}>
                      {c.label} · {min}–{max} assets
                    </option>
                  );
                })}
              </select>

              <div className="switcher-form-actions">
                <button
                  type="button"
                  className="switcher-btn-cancel"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="switcher-btn-create">Crear juego</button>
              </div>
            </form>
          ) : (
            <>
              <div className="switcher-list">
                {projects.map(p => (
                  <button
                    key={p.id}
                    className={`switcher-item ${p.id === selectedProjectId ? 'active' : ''}`}
                    onClick={() => {
                      onSelect(p.id);
                      setOpen(false);
                    }}
                  >
                    {p.coverImage ? (
                      <img src={p.coverImage} alt={p.name} className="switcher-item-thumb" />
                    ) : (
                      <span className="switcher-item-icon">🎮</span>
                    )}
                    <div className="switcher-item-info">
                      <span className="switcher-item-name">{p.name}</span>
                      <span className="switcher-item-meta">{describe(p)}</span>
                    </div>
                    <span className="switcher-item-badge">{p.sounds?.length || 0}</span>
                  </button>
                ))}

                {projects.length === 0 && (
                  <div className="switcher-empty">Todavía no hay juegos creados.</div>
                )}
              </div>

              <button className="switcher-new-btn" onClick={() => setCreating(true)}>
                + Nuevo juego
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSwitcher;
