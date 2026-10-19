import React, { useState, useRef, useEffect } from 'react';
import DropdownMenu from './DropdownMenu';

const FEEDBACK_MS = 1800;

/**
 * Las acciones de una fila de la tabla maestra (feature 002, enmienda del 2026-10-19).
 *
 * A la vista, lo de cada día: copiar el prompt y registrar la ruta (o abrir el enlace si ya
 * está). Y un botón «Más» que abre el resto con su nombre en texto y una frase de qué hace.
 * Es presentacional: recibe las acciones ya descritas (`buildRowActions`) y un mapa de
 * manejadores por `key`. El de copiar devuelve si pudo hacerlo, para confirmarlo.
 */
const RowActions = ({ actions, handlers }) => {
  const [copyState, setCopyState] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const done = await handlers.copy?.();
    setCopyState(done ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState(''), FEEDBACK_MS);
  };

  const { primary, second, menu } = actions;
  const primaryLabel = copyState === 'copied' ? '✓ Copiado' : copyState === 'failed' ? 'No se pudo copiar' : primary.label;

  return (
    <div className="row-actions">
      <button
        type="button"
        className={`row-actions-primary ${copyState === 'copied' ? 'done' : ''}`}
        disabled={primary.disabled}
        title={primary.hint}
        onClick={copy}
      >
        {primaryLabel}
      </button>

      <button
        type="button"
        className={`row-actions-second ${second.linked ? 'linked' : ''}`}
        title={second.hint}
        onClick={() => handlers[second.key]?.()}
      >
        {second.label}
      </button>

      <DropdownMenu
        label="Más ▾"
        items={menu}
        onSelect={(item) => handlers[item.key]?.()}
        triggerClassName="row-actions-more"
      />
    </div>
  );
};

export default RowActions;
