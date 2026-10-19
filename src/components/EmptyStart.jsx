import React, { useState } from 'react';
import { GAME_TYPES } from '../data/gameProfiles';

// Pantalla de arranque en blanco (feature 010, FR-050, FR-060, FR-062).
//
// Quien abre la herramienta por primera vez no encuentra ningún juego ni lista hecha:
// ve esto. Crear el primero pide solo lo imprescindible —nombre y tipo de juego—; el
// resto se cuenta en el paso siguiente.
//
// Junto a la invitación se ofrece UN ejemplo, un juego ficticio, que la persona carga si
// quiere. Nunca se carga solo. Es controlado: el formulario tiene su estado local de
// campos, pero crear y cargar son intenciones que decide el orquestador.

const EmptyStart = ({ onCreate, onLoadExample, exampleLoaded = false }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('Slot');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), type, complexity: 'standard', context: '', themeTag: '', coverImage: null });
  };

  return (
    <section className="simple-empty">
      <div className="simple-empty-card">
        <h2>Empieza tu primer juego</h2>
        <p className="simple-empty-lead">
          Aquí vas a crear los sonidos de un videojuego en cuatro pasos: cuentas cómo es el
          juego, la IA propone qué sonidos hacen falta, tú decides cuáles produces y los
          generas. Al final compartes una lista con tu equipo.
        </p>

        <form className="simple-empty-form" onSubmit={submit}>
          <div className="input-group">
            <label htmlFor="empty-game-name">¿Cómo se llama tu juego?</label>
            <input
              id="empty-game-name"
              type="text"
              className="modal-input"
              placeholder="Por ejemplo: Dragón de Fuego"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="empty-game-type">¿Qué tipo de juego es?</label>
            <select
              id="empty-game-type"
              className="modal-input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {GAME_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <p className="config-note">
              El tipo cambia cuántos sonidos se proponen y de qué familias: no se necesitan los
              mismos para una tragaperras que para un juego de puzles.
            </p>
          </div>

          <button
            type="submit"
            className="analyze-btn"
            disabled={!name.trim()}
            title={name.trim() ? 'Crear mi juego' : 'Escribe el nombre de tu juego para crearlo'}
          >
            Crear mi juego →
          </button>
          {!name.trim() && <p className="simple-hint">Escribe el nombre de tu juego para crearlo.</p>}
        </form>
      </div>

      <div className="simple-empty-card simple-empty-example">
        <h3>¿Quieres ver cómo queda antes de empezar?</h3>
        <p>
          Puedes cargar un ejemplo: un juego inventado, el Bosque de las Luciérnagas, con su análisis y su lista
          de sonidos con prompts. <strong>Empieza donde empieza cualquier juego</strong>: ningún
          sonido está aprobado ni generado, y no lleva archivos. Sirve para leer y aprender; tus
          propios juegos no se tocan.
        </p>
        <button type="button" className="simple-secondary-btn" onClick={onLoadExample}>
          {exampleLoaded ? 'Volver a cargar el ejemplo' : 'Cargar el ejemplo'}
        </button>
      </div>
    </section>
  );
};

export default EmptyStart;
