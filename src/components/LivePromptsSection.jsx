import React from 'react';
import { usePromptPackage } from './usePromptPackage';
import PromptVersionChip from './PromptVersionChip';
import {
  REASON_MESSAGES,
  acceptNotice,
  refresh,
  resetToBundled,
  setRemoteEnabled
} from '../services/livePrompts';

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es');
};

// Lo que dice el resultado de la última búsqueda, en palabras claras (FR-016).
const resultMessage = (result) => {
  if (!result) return null;
  if (result.status === 'up_to_date') return { ok: true, text: `Ya tienes la última versión (${result.version}).` };
  if (result.status === 'updated') return { ok: true, text: `Actualizado a la versión ${result.version}.` };
  return { ok: false, text: REASON_MESSAGES[result.reason] || 'No se pudo buscar la actualización.', detail: result.reason === 'invalid_content' ? result.details?.[0] : '' };
};

/**
 * Sección «Prompts del estudio» del panel de configuración (feature 011): qué versión se
 * usa y de dónde viene, el interruptor de la consulta remota y las dos acciones de la
 * persona: buscar ahora y volver a la copia incluida.
 */
const LivePromptsSection = () => {
  const { source, fetchedAt, status, lastResult, enabled, noticeSeen } = usePromptPackage();
  const checking = status === 'checking';
  const message = resultMessage(lastResult);

  return (
    <div className="config-section">
      <h3>Prompts del estudio</h3>
      <p className="section-desc">
        El catálogo de prompts, las listas base de cada género y las instrucciones del análisis
        pueden actualizarse solos desde el repositorio del estudio. Solo se lee: nada tuyo sale de
        tu equipo. Sin conexión, la herramienta usa la última versión que descargó o la que
        viene incluida.
      </p>

      <div className="prompts-live-row">
        <PromptVersionChip />
        {fetchedAt && <span className="prompts-live-when">Descargada el {formatDate(fetchedAt)}</span>}
      </div>

      <label className="prompts-live-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setRemoteEnabled(e.target.checked)}
        />
        <span>Buscar mejoras de los prompts al abrir la herramienta</span>
      </label>

      {!noticeSeen && enabled && (
        <p className="engine-notice" role="note">
          Todavía no has aceptado el aviso, así que no se consulta nada. Mientras tanto usas los
          prompts incluidos.{' '}
          <button type="button" className="prompts-live-link" onClick={acceptNotice}>
            Aceptar y consultar ahora
          </button>
        </p>
      )}

      <div className="prompts-live-actions">
        <button
          type="button"
          className="storage-backup-btn"
          disabled={!enabled || !noticeSeen || checking}
          onClick={() => refresh({ manual: true })}
        >
          {checking ? 'Buscando…' : 'Buscar actualización ahora'}
        </button>
        <button
          type="button"
          className="storage-backup-btn"
          disabled={source === 'bundled'}
          onClick={resetToBundled}
          title="Descarta la versión descargada y usa la que viene incluida en tu copia"
        >
          Volver a la copia incluida
        </button>
      </div>

      {message && !message.ok && (
        <p className="model-error" role="alert">
          {message.text}
          {message.detail && <span className="prompts-live-detail"> Detalle: {message.detail}</span>}
        </p>
      )}
      {message?.ok && <p className="engine-test-ok" role="status">{message.text}</p>}
    </div>
  );
};

export default LivePromptsSection;
