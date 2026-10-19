import React, { useState, useEffect, Suspense, lazy } from 'react';
import storageService from './services/storageService';

import ProjectManager from './components/ProjectManager';
import ConfigPanel from './components/ConfigPanel';
import LivePromptsNotice from './components/LivePromptsNotice';
import { initLivePrompts } from './services/livePrompts';

// La vista del equipo del juego (feature 009) se carga aparte: quien entra a
// /entrega no necesita descargar el editor, ni el director la vista del equipo.
const TeamApp = lazy(() => import('./components/team/TeamApp'));

// Enrutado sin librería. vercel.json ya reescribe todas las rutas a index.html,
// así que basta mirar dónde estamos. Una sola ruta no justifica una dependencia.
const esRutaEquipo = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/entrega');

function App() {
  const [showConfig, setShowConfig] = useState(false);
  const [storageStatus, setStorageStatus] = useState({ mode: 'unknown', lastSyncAt: null });
  const [rutaEquipo] = useState(esRutaEquipo);

  useEffect(() => {
    // El equipo no toca el almacén del director: ni lo carga ni se suscribe.
    if (rutaEquipo) return;
    storageService.subscribe(setStorageStatus);
  }, [rutaEquipo]);

  // Los prompts vivos solo se necesitan en el editor del director y de los compañeros: la
  // vista del equipo del juego no los usa, así que ni siquiera consulta (feature 011).
  useEffect(() => {
    if (!rutaEquipo) initLivePrompts();
  }, [rutaEquipo]);

  if (rutaEquipo) {
    return (
      <Suspense fallback={<div className="team-mensaje">Cargando…</div>}>
        <TeamApp />
      </Suspense>
    );
  }

  return (
    <div className="app-container">
      <LivePromptsNotice />

      {/* ProjectManager renderiza la barra superior: el selector de juego vive
          ahí porque es quien tiene la lista de proyectos. */}
      <ProjectManager
        storageStatus={storageStatus}
        onOpenConfig={() => setShowConfig(true)}
      />

      <ConfigPanel
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        storageStatus={storageStatus}
      />
    </div>
  );
}

export default App;
