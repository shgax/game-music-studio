import React, { useState, useEffect } from 'react';
import storageService from '../services/storageService';
import {
  PROVIDERS, getProvider, getEngine, setEngine, getKey, hasKey, keySource, setKey,
  clearKey, clearAllKeys, maskKey, validateBaseUrl, noticeSeen, markNoticeSeen
} from '../services/aiEngineSettings';
import { testConnection } from '../services/analysisService';
import { THIRD_PARTY_NOTICE } from '../data/guideContent';
import LivePromptsSection from './LivePromptsSection';

// Configuración de las integraciones: el motor de IA que analiza el juego (Gemini,
// Claude, OpenAI o uno compatible). La clave de ElevenLabs ya no se pide: generar el sonido
// es un paso manual, en su página (feature 010, enmienda del 2026-10-19).
//
// Cada persona usa SU PROPIA clave y se queda en su equipo: no sale hacia ningún
// servidor del estudio ni entra en el respaldo del proyecto (feature 010).
//
// Google Drive se retiró: su flujo OAuth entregaba tokens de una hora sin
// refresco, obligando a reautorizar constantemente, y exigía configurar un
// proyecto en Cloud Console. La persistencia vive ahora en Vercel Blob, sin
// sesiones que caduquen.

// Una clave ya guardada nunca se vuelve a mostrar completa (FR-010): solo su final.
// Se puede sustituir o borrar. Si no hay ninguna, se pega aquí.
const KeyField = ({ id, label, providerId, draft, onDraft, onDelete, envName, hint }) => {
  const source = keySource(providerId);
  const stored = source === 'stored';
  const [replacing, setReplacing] = useState(false);
  const showInput = !stored || replacing;

  return (
    <div className="input-group">
      <label htmlFor={id}>
        {label}
        {source === 'env' && !draft && (
          <span className="engine-env-badge">✓ Detectada en .env</span>
        )}
      </label>

      {stored && !replacing && (
        <div className="engine-key-saved">
          <span className="engine-key-mask" aria-label="Clave guardada">{maskKey(getKey(providerId))}</span>
          <span className="engine-key-state">Guardada en este equipo</span>
          <button type="button" className="engine-link-btn" onClick={() => setReplacing(true)}>Sustituir</button>
          <button type="button" className="engine-link-btn engine-link-danger" onClick={onDelete}>Borrar esta clave</button>
        </div>
      )}

      {showInput && (
        <input
          id={id}
          type="password"
          autoComplete="off"
          placeholder={source === 'env' ? `Configurada en ${envName} (puedes sobrescribir aquí)` : 'Pega aquí tu clave'}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          className="modal-input"
        />
      )}
      {hint && <p className="config-note">{hint}</p>}
    </div>
  );
};

const ConfigPanel = ({ isOpen, onClose, storageStatus }) => {
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [acceptsImages, setAcceptsImages] = useState(false);
  // Claves escritas en esta sesión del panel y aún sin guardar. Las ya guardadas no
  // se vuelcan aquí: no se muestran.
  const [drafts, setDrafts] = useState({});
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState('');
  const [test, setTest] = useState({ status: 'idle', message: '', models: [] });
  // Fuerza a repintar los campos de clave tras borrar una.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const engine = getEngine();
    setProvider(engine.provider);
    setModel(engine.model);
    setBaseUrl(engine.baseUrl);
    setAcceptsImages(engine.acceptsImages);
    setDrafts({});
    setSaved(false);
    setProblem('');
    setTest({ status: 'idle', message: '', models: [] });
  }, [isOpen]);

  const setDraft = (id, value) => setDrafts(prev => ({ ...prev, [id]: value }));

  const choose = (id) => {
    const chosen = getProvider(id);
    setProvider(id);
    // El modelo es de cada proveedor: al cambiar se parte del suyo, no del anterior.
    setModel(id === getEngine().provider ? getEngine().model : chosen.defaultModel);
    setProblem('');
    setTest({ status: 'idle', message: '', models: [] });
  };

  const handleDelete = (id) => {
    clearKey(id);
    setVersion(v => v + 1);
  };

  const handleDeleteAll = () => {
    if (!window.confirm('Se borrarán de este equipo TODAS las claves guardadas. Las del archivo .env no se pueden borrar desde aquí. ¿Continuar?')) return;
    clearAllKeys();
    setDrafts({});
    setVersion(v => v + 1);
  };

  // Comprueba lo que hay escrito ahora, aunque todavía no esté guardado (FR-004).
  const handleTest = async () => {
    setProblem('');
    setTest({ status: 'running', message: 'Comprobando…', models: [] });
    try {
      const overrides = { provider, model, baseUrl, acceptsImages };
      if (drafts[provider]?.trim()) overrides.key = drafts[provider];
      const result = await testConnection(overrides);

      const count = result.models.length;
      let message = `Conexión correcta con ${result.provider}.`;
      if (count) message += ` ${count} modelos disponibles con tu clave.`;
      if (!result.modelListed) message += ` Ojo: «${model}» no aparece en la lista; revisa el nombre.`;
      setTest({ status: 'ok', message, models: result.models });

      // Sin modelo elegido, se propone el primero que la cuenta tenga.
      if (!model && count && provider !== 'gemini') setModel(result.models[0]);
    } catch (e) {
      setTest({ status: 'error', message: e.message, models: [] });
    }
  };

  const handleSave = () => {
    const chosen = getProvider(provider);

    let cleanBase = '';
    if (chosen.needsBaseUrl) {
      const checked = validateBaseUrl(baseUrl);
      if (!checked.ok) {
        setProblem(checked.error);
        return;
      }
      cleanBase = checked.url;
    }

    // Las claves escritas se guardan todas, sean del motor elegido o no: así se puede
    // dejar preparado otro proveedor y alternar sin volver a pegarlas (FR-003).
    Object.entries(drafts).forEach(([id, value]) => {
      if (value && value.trim()) setKey(id, value);
    });

    setEngine({ provider, model: model.trim(), baseUrl: cleanBase, acceptsImages });
    if (hasKey(provider)) markNoticeSeen(provider);

    setSaved(true);
    setTimeout(onClose, 700);
  };

  if (!isOpen) return null;

  const chosen = getProvider(provider);
  const needNotice = !noticeSeen(provider);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" key={version}>
          {/* Almacenamiento */}
          <div className="config-section">
            <h3>Almacenamiento</h3>
            <div className={`storage-state ${storageStatus?.mode === 'cloud' ? 'cloud' : 'local'}`}>
              <span className="status-indicator"></span>
              {storageStatus?.mode === 'cloud' ? (
                <div>
                  <strong>Nube activa</strong>
                  <p className="section-desc">
                    Los proyectos se guardan en Vercel Blob y están disponibles desde cualquier
                    dispositivo. El navegador conserva además un respaldo local automático.
                  </p>
                </div>
              ) : (
                <div>
                  <strong>Solo local</strong>
                  <p className="section-desc">
                    Todo se guarda en este navegador. Es lo normal en una copia local
                    (<code>npm run dev</code>): la función <code>/api/db</code> solo existe en
                    Vercel o con <code>vercel dev</code>.
                  </p>
                </div>
              )}
            </div>
            <button className="storage-backup-btn" onClick={() => storageService.exportBackup()}>
              Descargar respaldo JSON
            </button>
          </div>

          {/* Motor de IA */}
          <div className="config-section">
            <h3>Motor de IA</h3>
            <p className="section-desc">
              Analiza las imágenes del juego y propone la lista de sonidos con sus prompts.
              Elige el proveedor con el que tengas cuenta. La clave se guarda en este
              equipo y solo se envía al proveedor que elijas.
            </p>

            <div className="config-radio-group" role="radiogroup" aria-label="Proveedor de IA">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={provider === p.id}
                  className={`config-radio ${provider === p.id ? 'active' : ''}`}
                  onClick={() => choose(p.id)}
                >
                  <span className="config-radio-label">{p.label}</span>
                  <span className="config-radio-meta">
                    {hasKey(p.id) || drafts[p.id]?.trim() ? 'Con clave' : 'Sin clave'}
                  </span>
                </button>
              ))}
            </div>

            {chosen.needsBaseUrl && (
              <div className="input-group">
                <label htmlFor="engine-base-url">Dirección del servicio</label>
                <input
                  id="engine-base-url"
                  type="text"
                  placeholder="https://mi-servicio.ejemplo.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="modal-input"
                />
                <p className="config-note">
                  Debe empezar por https://. Solo se admite http:// si apunta a tu propio
                  equipo (localhost). Si tu servidor local no usa clave, escribe cualquier texto.
                </p>
              </div>
            )}

            <KeyField
              id={`key-${provider}`}
              label={`Clave de ${chosen.label}`}
              providerId={provider}
              draft={drafts[provider] || ''}
              onDraft={(v) => setDraft(provider, v)}
              onDelete={() => handleDelete(provider)}
              envName=".env"
            />

            <div className="input-group">
              <label htmlFor="engine-model">Modelo</label>
              <input
                id="engine-model"
                type="text"
                list="engine-models"
                placeholder={provider === 'gemini' ? 'Automático: se elige el primero disponible' : (chosen.defaultModel || 'Nombre del modelo')}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="modal-input"
              />
              <datalist id="engine-models">
                {test.models.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            {chosen.needsBaseUrl && (
              <label className="config-toggle">
                <input
                  type="checkbox"
                  checked={acceptsImages}
                  onChange={(e) => setAcceptsImages(e.target.checked)}
                />
                <span className="config-toggle-text">
                  <strong>Este modelo acepta imágenes</strong>
                  <span className="config-toggle-desc">
                    Desde fuera no se puede saber. Si no lo marcas, el análisis se hará solo con tu descripción.
                  </span>
                </span>
              </label>
            )}

            <div className="model-check">
              <button
                type="button"
                className="storage-backup-btn"
                onClick={handleTest}
                disabled={test.status === 'running'}
              >
                {test.status === 'running' ? 'Comprobando…' : '🔍 Comprobar conexión'}
              </button>
            </div>

            {test.status === 'ok' && <p className="engine-test-ok" role="status">{test.message}</p>}
            {test.status === 'error' && <p className="model-error" role="alert">{test.message}</p>}
            {problem && <p className="model-error" role="alert">{problem}</p>}

            {needNotice && (
              <p className="engine-notice" role="note">{THIRD_PARTY_NOTICE}</p>
            )}
          </div>

          {/* Prompts del estudio (feature 011) */}
          <LivePromptsSection />

          {/* Seguridad de las claves */}
          <div className="config-section">
            <h3>Tus claves</h3>
            <p className="section-desc">
              Quedan guardadas en este equipo, legibles para quien lo use. <strong>No las dejes
              en un equipo que no sea tuyo.</strong> Nunca entran en el respaldo del proyecto ni
              en ninguna exportación.
            </p>
            <button type="button" className="engine-danger-btn" onClick={handleDeleteAll}>
              Borrar todas las claves de este equipo
            </button>
          </div>

          {/* Ayuda */}
          <div className="config-section help-section">
            <details className="help-details">
              <summary className="help-summary">💡 ¿Cómo obtener las claves?</summary>
              <div className="help-content">
                <h4>Gemini</h4>
                <ol>
                  <li>Entra en <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="help-link">Google AI Studio</a>.</li>
                  <li>Pulsa <strong>Get API Key</strong> en el menú lateral.</li>
                  <li>Crea una clave y cópiala arriba.</li>
                </ol>

                <h4>Claude</h4>
                <ol>
                  <li>Entra en la <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="help-link">consola de Anthropic</a>.</li>
                  <li>Ve a <strong>API Keys</strong> y crea una clave.</li>
                  <li>Cópiala arriba. Tu cuenta necesita saldo.</li>
                </ol>

                <h4>OpenAI</h4>
                <ol>
                  <li>Entra en la <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="help-link">plataforma de OpenAI</a>.</li>
                  <li>Crea una clave en <strong>API keys</strong>.</li>
                  <li>Cópiala arriba. Tu cuenta necesita saldo.</li>
                </ol>

                <h4>¿Y los sonidos?</h4>
                <p>
                  Los generas tú en la <a href="https://elevenlabs.io/" target="_blank" rel="noreferrer" className="help-link">página de ElevenLabs</a>,
                  con el prompt que copias de aquí: la herramienta no necesita tu clave de ElevenLabs.
                </p>

                <h4>¿Y los audios finales?</h4>
                <p>
                  No se suben a ningún sitio. La aplicación guarda <strong>dónde está</strong> cada
                  archivo (una ruta de tu disco o un enlace, por ejemplo de Drive), no el archivo. Así
                  no se duplican gigas y tus archivos siguen donde ya los tienes.
                </p>
              </div>
            </details>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cerrar</button>
          <button className="save-btn" onClick={handleSave}>
            {saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
