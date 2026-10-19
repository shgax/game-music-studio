import { useSyncExternalStore } from 'react';
import { subscribe, getState } from '../services/livePrompts';

// El estado del paquete de prompts: `pkg` (la versión en uso), `source`, `fetchedAt`,
// `status`, `lastResult`, `enabled` y `noticeSeen`. El estado se sustituye entero cada vez
// que cambia, así que un componente nunca ve partes de dos versiones (FR-023).
export const usePromptPackage = () => useSyncExternalStore(subscribe, getState);
