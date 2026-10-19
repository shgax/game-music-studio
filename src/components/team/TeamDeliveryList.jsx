import React, { useState, useMemo } from 'react';

// Lista de entrega: qué archivo es, cuándo suena, a qué evento engancharlo y de
// dónde bajarlo. Nada más. Los prompts y los motores no llegan hasta aquí porque
// el servidor no los envía.

// El programador busca por zona del juego, no por número de asset.
const GRUPOS = [
  ['UI',  'Interfaz',   'Botones, paneles y avisos de la barra de controles'],
  ['MEC', 'Mecánicas',  'Carretes, contadores, fases y minijuegos'],
  ['SYM', 'Símbolos',   'Cada símbolo al pagar, y los especiales al aterrizar'],
  ['STG', 'Premios y transiciones', 'Niveles de premio, features y cinemáticas'],
  ['FX',  'Efectos',    'Efectos especiales'],
  ['BGM', 'Música',     'Camas en bucle'],
  ['AMB', 'Ambientes',  'Fondo continuo, siempre en bucle'],
  ['VO',  'Voz',        'Voz autorizada']
];

function TeamDeliveryList({ juegos, miembro, onMarcar, onSalir }) {
  const [juegoId, setJuegoId] = useState(juegos[0]?.id || '');
  const [categoria, setCategoria] = useState('todas');
  const [busca, setBusca] = useState('');
  const [guardando, setGuardando] = useState({});
  const [aviso, setAviso] = useState('');

  const juego = juegos.find(j => j.id === juegoId) || juegos[0] || null;

  const visibles = useMemo(() => {
    if (!juego) return [];
    const q = busca.toLowerCase().trim();
    return juego.assets.filter(a =>
      (categoria === 'todas' || a.categoria === categoria) &&
      (!q || `${a.archivo} ${a.cuando} ${a.para} ${a.evento}`.toLowerCase().includes(q))
    );
  }, [juego, categoria, busca]);

  if (!juego) {
    return (
      <div className="team-vacio">
        <p>Todavía no hay ningún juego cargado.</p>
        <button className="team-boton-liso" onClick={onSalir}>Salir</button>
      </div>
    );
  }

  const marcar = async (asset, usado) => {
    setGuardando(g => ({ ...g, [asset.id]: true }));
    setAviso('');

    const fallo = await onMarcar(juego.id, asset.id, usado);

    // Una casilla marcada significa guardada: si el servidor no confirmó, la
    // casilla vuelve atrás en vez de mentir.
    if (fallo) setAviso(fallo);

    setGuardando(g => {
      const siguiente = { ...g };
      delete siguiente[asset.id];
      return siguiente;
    });
  };

  const porCategoria = GRUPOS
    .map(([clave, titulo, que]) => [clave, titulo, que, visibles.filter(a => a.categoria === clave)])
    .filter(([, , , lista]) => lista.length > 0);

  const chips = [['todas', 'Todos', juego.assets.length]].concat(
    GRUPOS
      .map(([c, t]) => [c, t, juego.assets.filter(a => a.categoria === c).length])
      .filter(x => x[2] > 0)
  );

  const progreso = juego.total ? Math.round(juego.usados / juego.total * 100) : 0;

  return (
    <div className="team-envoltura">
      <header className="team-cabecera">
        <div>
          <p className="team-sobretitulo">Solvers · Audio</p>
          <h1>Sonidos para integrar</h1>
        </div>
        <div className="team-sesion">
          <span>{miembro.nombre}</span>
          <button className="team-boton-liso" onClick={onSalir}>Salir</button>
        </div>
      </header>

      {juegos.length > 1 && (
        <div className="team-juegos">
          {juegos.map(j => (
            <button
              key={j.id}
              className="team-juego"
              aria-pressed={j.id === juego.id}
              onClick={() => { setJuegoId(j.id); setCategoria('todas'); setBusca(''); }}
            >
              <span className="team-juego-nombre">{j.nombre}</span>
              <span className="team-juego-cuenta">{j.usados} de {j.total}</span>
            </button>
          ))}
        </div>
      )}

      <div className="team-progreso">
        <div>
          <div className="team-cifra">{juego.usados}</div>
          <div className="team-rotulo">Usados</div>
        </div>
        <div>
          <div className="team-cifra">{juego.total}</div>
          <div className="team-rotulo">Total</div>
        </div>
        <div className="team-barra"><span style={{ width: progreso + '%' }} /></div>
      </div>

      <div className="team-controles">
        {chips.map(([c, t, n]) => (
          <button
            key={c}
            className="team-chip"
            aria-pressed={categoria === c}
            onClick={() => setCategoria(c)}
          >
            {t}<span className="team-n">{n}</span>
          </button>
        ))}
        <input
          className="team-buscador"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nombre, evento o momento…"
          aria-label="Buscar sonidos"
        />
      </div>

      {aviso && <p className="team-aviso">{aviso}</p>}

      {!visibles.length && <p className="team-vacio">Nada coincide con esa búsqueda.</p>}

      {porCategoria.map(([clave, titulo, que, lista]) => (
        <section key={clave}>
          <h2 className="team-grupo">{titulo}<small>{que}</small></h2>

          {lista.map(a => (
            <div key={a.id} className={'team-fila' + (a.enlace ? '' : ' team-espera')}>
              <div className="team-datos">
                <div className="team-nombre">{a.archivo}</div>
                <div className="team-cuando">{a.cuando}</div>
                {a.para && <div className="team-detalle">{a.para}</div>}
                <div className="team-etiquetas">
                  {a.evento && <span className="team-tag">{a.evento}</span>}
                  {a.loop && <span className="team-tag team-loop">En bucle</span>}
                  {a.duracion && <span className="team-tag">{a.duracion} s</span>}
                </div>
              </div>

              <div className="team-acciones">
                {a.enlace
                  ? <a className="team-descargar" href={a.enlace} target="_blank" rel="noopener noreferrer">Descargar</a>
                  : <span className="team-pendiente">En producción</span>}

                {a.enlace && (
                  <label className="team-usado">
                    <input
                      type="checkbox"
                      checked={a.usado}
                      disabled={Boolean(guardando[a.id])}
                      onChange={(e) => marcar(a, e.target.checked)}
                    />
                    <span>Usado en el juego</span>
                  </label>
                )}
              </div>
            </div>
          ))}
        </section>
      ))}

      <p className="team-pie">
        Los archivos viven en el Drive del estudio: hace falta cuenta corporativa para
        descargarlos. Cada sonido es un único archivo ya mezclado; las capas no se entregan.
      </p>
    </div>
  );
}

export default TeamDeliveryList;
