import React from 'react';
import { usePromptPackage } from './usePromptPackage';
import { SOURCE_LABELS } from '../services/livePrompts';

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es');
};

/**
 * Qué versión de los prompts se está usando y de dónde viene (feature 011, FR-018):
 * publicada (leída del repositorio ahora), guardada (la última que se descargó) o
 * incluida (la que viene con esta copia de la herramienta).
 */
const PromptVersionChip = () => {
  const { pkg, source, fetchedAt } = usePromptPackage();

  const detail = [
    `Publicada el ${pkg.publishedAt}.`,
    fetchedAt ? `Descargada el ${formatDate(fetchedAt)}.` : 'Viene incluida con esta copia de la herramienta.'
  ].join(' ');

  return (
    <span className={`prompts-live-chip prompts-live-chip-${source}`} title={detail}>
      Prompts {pkg.version} · {SOURCE_LABELS[source]}
    </span>
  );
};

export default PromptVersionChip;
