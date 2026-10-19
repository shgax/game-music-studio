import React from 'react';
import { hasEngineKey, describeEngine, engineShortName } from '../services/aiEngineSettings';

// Barra superior: identidad del producto a la izquierda y, a la misma altura,
// el selector del juego activo y los ajustes a la derecha.
// `children` recibe el selector de proyecto desde ProjectManager, que es quien
// tiene el estado de la lista.
//
// La insignia de IA nombra el motor ELEGIDO, no uno fijo (feature 010, FR-065), y el
// interruptor de vista mantiene siempre alcanzables los seis ejes de estado (FR-064,
// Artículo V): la vista simple los oculta, la completa los muestra.

const Header = ({ children, onOpenConfig, viewMode, onChangeView }) => {
  const hasKey = hasEngineKey();
  const engine = describeEngine();

  return (
    <header className="app-header">
      <div className="header-title">
        <h1>SONIDOS <span className="highlight-text">DASHBOARD</span></h1>
        <p className="subtitle">Videojuegos Sound Design &amp; Requirements Pipeline</p>
      </div>

      <div className="header-controls">
        {children}

        {onChangeView && (
          <div className="view-switch" role="group" aria-label="Vista de la herramienta">
            <button
              type="button"
              className={`view-switch-btn ${viewMode === 'simple' ? 'active' : ''}`}
              aria-pressed={viewMode === 'simple'}
              onClick={() => onChangeView('simple')}
              title="Solo lo necesario para crear los prompts y los sonidos"
            >
              Simple
            </button>
            <button
              type="button"
              className={`view-switch-btn ${viewMode === 'full' ? 'active' : ''}`}
              aria-pressed={viewMode === 'full'}
              onClick={() => onChangeView('full')}
              title="Tabla maestra, tablero, revisión y entrega con los seis ejes de estado"
            >
              Completa
            </button>
          </div>
        )}

        <button
          className={`ai-status-badge ${hasKey ? 'ai-connected' : 'ai-missing'}`}
          onClick={onOpenConfig}
          title={hasKey
            ? `${engine} conectado. Clic para configurar o cambiar de motor.`
            : `Falta la clave de ${engineShortName()}. Clic para configurar.`}
        >
          <span className="ai-dot"></span>
          {hasKey ? 'IA Conectada' : 'Falta Token IA'}
        </button>
        <button
          className="settings-toggle-btn"
          onClick={onOpenConfig}
          title="Configuración de APIs e integraciones"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
};

export default Header;
