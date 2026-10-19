import React from 'react';
import { GUIDE_STEPS } from '../data/guideContent';

// Recorrido de la vista simple (feature 010, FR-051, FR-052, FR-054, FR-056, FR-058).
//
// El paso actual NO se guarda: lo calcula el orquestador del estado del proyecto y
// llega por `step`. Si la persona retrocede (borra una clave, edita la lista), la
// guía la acompaña sin desincronizarse.
//
// Acompaña, no bloquea: nunca hay que leerla para poder actuar, y se puede ocultar.
// Es controlado: no tiene estado propio.

const GuideStepper = ({ step, hidden, onToggleHidden, onOpenGlossary }) => {
  const current = GUIDE_STEPS.find(s => s.n === step) || GUIDE_STEPS[1];

  // El paso 0 («Conecta tu IA») solo aparece mientras falte la clave; una vez
  // conectada, el recorrido son los cuatro pasos de siempre.
  const visible = step === 0 ? GUIDE_STEPS : GUIDE_STEPS.filter(s => s.n > 0);

  if (hidden) {
    return (
      <div className="guide-collapsed">
        <button type="button" className="guide-link-btn" onClick={onToggleHidden}>
          Mostrar la guía
        </button>
        <button type="button" className="guide-link-btn" onClick={onOpenGlossary}>
          📖 Glosario
        </button>
      </div>
    );
  }

  return (
    <section className="guide-stepper" aria-label="Guía paso a paso">
      <ol className="guide-steps">
        {visible.map(s => {
          const state = s.n < step ? 'done' : s.n === step ? 'current' : 'todo';
          return (
            <li
              key={s.key}
              className={`guide-step guide-step-${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="guide-step-num">{state === 'done' ? '✓' : s.n || '•'}</span>
              <span className="guide-step-title">{s.title}</span>
            </li>
          );
        })}
      </ol>

      <div className="guide-card">
        <h3>{current.title}</h3>
        <p className="guide-what">{current.what}</p>
        <p className="guide-why"><strong>Por qué:</strong> {current.why}</p>
        {current.unlock && (
          <p className="guide-unlock"><strong>Para continuar:</strong> {current.unlock}</p>
        )}
        <div className="guide-actions">
          <button type="button" className="guide-link-btn" onClick={onOpenGlossary}>
            📖 ¿Qué significa cada palabra?
          </button>
          <button type="button" className="guide-link-btn" onClick={onToggleHidden}>
            Ocultar la guía
          </button>
        </div>
      </div>
    </section>
  );
};

export default GuideStepper;
