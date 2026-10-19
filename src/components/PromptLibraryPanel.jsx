import React, { useState, useMemo } from 'react';
import { flattenCatalog } from '../data/promptPackage';
import { usePromptPackage } from './usePromptPackage';
import PromptVersionChip from './PromptVersionChip';
import { applyTheme, NEUTRAL_THEME } from '../data/analysisModel';

/**
 * Catálogo de prompts curados, invocado desde una fila concreta del plan de sonido.
 *
 * Es presentacional: no conoce proyectos ni persistencia. Al insertar delega en
 * onInsert, que en ambas vistas termina llamando al mismo onUpdateSound que usa la
 * edición de celdas, de modo que el guardado automático funciona sin lógica nueva.
 */
const PromptLibraryPanel = ({ target, themeTag, onInsert, onClose }) => {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [copiado, setCopiado] = useState(null);

  // El catálogo es el del paquete de prompts vigente (publicado, guardado o incluido).
  const { pkg } = usePromptPackage();
  const promptLibrary = pkg.catalog;

  const categorias = ['Todas', ...promptLibrary.map(c => c.categoria)];

  const resultados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return flattenCatalog(pkg).filter(p => {
      if (categoriaActiva !== 'Todas' && p.categoria !== categoriaActiva) return false;
      if (!termino) return true;

      return (
        p.nombre.toLowerCase().includes(termino) ||
        p.texto.toLowerCase().includes(termino) ||
        p.categoria.toLowerCase().includes(termino) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(termino))
      );
    });
  }, [busqueda, categoriaActiva, pkg]);

  // Las reglas solo tienen sentido mostrarlas cuando hay una categoría concreta activa.
  const reglasActivas = categoriaActiva === 'Todas'
    ? null
    : promptLibrary.find(c => c.categoria === categoriaActiva)?.reglas;

  const resolve = (texto) => applyTheme(texto, themeTag);

  const handleCopiar = async (prompt) => {
    try {
      await navigator.clipboard.writeText(resolve(prompt.texto));
      setCopiado(prompt.nombre);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setCopiado(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container prompt-library-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>📚 Biblioteca de Prompts</h2>
            <PromptVersionChip />
            {target && (
              <p className="prompt-library-target">
                Insertar en <strong>{target.filename || `sonido ${target.soundId}`}</strong>
                {target.eventKey && <span className="prompt-library-eventkey">{target.eventKey}</span>}
              </p>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body prompt-library-body">
          <div className="prompt-library-controls">
            <input
              type="text"
              className="prompt-library-search"
              placeholder="Buscar por nombre, texto o etiqueta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
            <span className="prompt-library-count">
              {resultados.length} {resultados.length === 1 ? 'prompt' : 'prompts'}
            </span>
          </div>

          {!themeTag && (
            <div className="prompt-library-theme-warning">
              <strong>⚠ Sin etiqueta temática.</strong> Los prompts saldrán con
              «{NEUTRAL_THEME}» en lugar de la identidad de este juego. Defínela en el
              informe de análisis, sección 4.
            </div>
          )}

          {themeTag && (
            <div className="prompt-library-theme-active">
              Identidad aplicada: <strong>{themeTag}</strong>
            </div>
          )}

          <div className="prompt-library-categories">
            {categorias.map(cat => (
              <button
                key={cat}
                className={`prompt-library-cat-btn ${categoriaActiva === cat ? 'active' : ''}`}
                onClick={() => setCategoriaActiva(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {reglasActivas && (
            <div className="prompt-library-rules">
              <strong>Reglas de la categoría:</strong> {reglasActivas}
            </div>
          )}

          {resultados.length === 0 ? (
            <div className="prompt-library-empty">
              <p>Ningún prompt coincide con «{busqueda}».</p>
              <p className="prompt-library-empty-hint">
                Prueba con otro término o cambia de categoría.
              </p>
            </div>
          ) : (
            <div className="prompt-library-list">
              {resultados.map((prompt, index) => (
                <div className="prompt-library-item" key={`${prompt.categoria}-${prompt.nombre}-${index}`}>
                  <div className="prompt-library-item-head">
                    <span className="prompt-library-item-name">{prompt.nombre}</span>
                    <span className="prompt-library-item-meta">
                      {prompt.duracion}
                      {prompt.categoria_prefijo && (
                        <span className="prompt-library-prefix">{prompt.categoria_prefijo}_</span>
                      )}
                      {prompt.profile && (
                        <span className="prompt-library-genre" title="Perfil técnico de mezcla">
                          {prompt.profile}
                        </span>
                      )}
                    </span>
                  </div>

                  <p className="prompt-library-item-text">{resolve(prompt.texto)}</p>

                  <div className="prompt-library-item-foot">
                    <div className="prompt-library-tags">
                      {(prompt.tags || []).map(tag => (
                        <span className="prompt-library-tag" key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="prompt-library-actions">
                      <button
                        className="prompt-library-btn-copy"
                        onClick={() => handleCopiar(prompt)}
                      >
                        {copiado === prompt.nombre ? '✓ Copiado' : 'Copiar'}
                      </button>
                      <button
                        className="prompt-library-btn-insert"
                        onClick={() => onInsert(resolve(prompt.texto))}
                      >
                        Insertar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptLibraryPanel;
