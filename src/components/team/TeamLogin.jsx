import React, { useState } from 'react';

// Acceso del equipo del juego.
//
// Un solo mensaje de error para cualquier fallo: decir "ese usuario no existe"
// regala la mitad del trabajo a quien lo esté intentando.

function TeamLogin({ onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !clave || enviando) return;

    setEnviando(true);
    setError('');

    const fallo = await onEntrar(usuario.trim(), clave);

    if (fallo) {
      setError(fallo);
      setClave('');
    }
    setEnviando(false);
  };

  return (
    <div className="team-login">
      <form className="team-login-caja" onSubmit={enviar}>
        <p className="team-login-sobretitulo">Solvers · Audio</p>
        <h1>Sonidos del juego</h1>
        <p className="team-login-que">
          Aquí están los sonidos listos para integrar, con su descripción y su enlace
          de descarga. Marca los que vayas usando.
        </p>

        <label htmlFor="team-usuario">Usuario</label>
        <input
          id="team-usuario"
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck="false"
          disabled={enviando}
        />

        <label htmlFor="team-clave">Contraseña</label>
        <input
          id="team-clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="current-password"
          disabled={enviando}
        />

        {error && <p className="team-error">{error}</p>}

        <button type="submit" className="team-boton" disabled={enviando || !usuario.trim() || !clave}>
          {enviando ? 'Comprobando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default TeamLogin;
