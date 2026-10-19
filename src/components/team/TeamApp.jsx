import React, { useState, useEffect, useCallback } from 'react';
import TeamLogin from './TeamLogin';
import TeamDeliveryList from './TeamDeliveryList';

// Raíz de la vista de entrega (feature 009).
//
// No usa storageService a propósito: ese servicio carga la base completa y la
// escribe en localStorage, y el trabajo del estudio no debe quedar en el
// navegador de un programador. Aquí solo se habla con /api/team, que devuelve lo
// justo.

const API = '/api/team';

function TeamApp() {
  const [estado, setEstado] = useState('cargando'); // cargando | fuera | dentro | sin-nube | error
  const [miembro, setMiembro] = useState(null);
  const [juegos, setJuegos] = useState([]);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });

      if (res.status === 503) { setEstado('sin-nube'); return; }
      if (res.status === 401) { setEstado('fuera'); return; }
      if (!res.ok) { setEstado('error'); return; }

      const data = await res.json();
      setMiembro(data.miembro);
      setJuegos(data.juegos || []);
      setEstado('dentro');
    } catch {
      setEstado('error');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const entrar = async (usuario, clave) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'login', usuario, clave })
      });

      if (res.status === 503) { setEstado('sin-nube'); return null; }
      if (!res.ok) return 'Usuario o contraseña incorrectos.';

      await cargar();
      return null;
    } catch {
      return 'No se pudo conectar. Comprueba tu conexión.';
    }
  };

  const salir = async () => {
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'salir' })
      });
    } catch {
      // Aunque falle la petición, aquí se sale igual.
    }
    setMiembro(null);
    setJuegos([]);
    setEstado('fuera');
  };

  // Pintado optimista: la casilla responde al instante y se revierte si el
  // servidor no confirma. Devuelve el aviso a mostrar, o null si fue bien.
  const marcar = async (juegoId, assetId, usado) => {
    const antes = juegos;

    setJuegos(js => js.map(j => {
      if (j.id !== juegoId) return j;
      const assets = j.assets.map(a => (a.id === assetId ? { ...a, usado } : a));
      return { ...j, assets, usados: assets.filter(a => a.usado).length };
    }));

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'marcar', proyecto: juegoId, asset: assetId, usado })
      });

      if (res.status === 401) { setEstado('fuera'); return 'Se cerró la sesión. Vuelve a entrar.'; }

      if (!res.ok) {
        setJuegos(antes);
        return 'No se pudo guardar. La casilla vuelve a como estaba.';
      }
      return null;
    } catch {
      setJuegos(antes);
      return 'Sin conexión: no se guardó. La casilla vuelve a como estaba.';
    }
  };

  if (estado === 'cargando') {
    return <div className="team-mensaje">Cargando…</div>;
  }

  // Sin almacén no hay vista, y se dice. Degradarse a modo local aquí sería
  // mentir: dos programadores verían cosas distintas y ninguno lo sabría.
  if (estado === 'sin-nube') {
    return (
      <div className="team-mensaje">
        <h1>No disponible</h1>
        <p>
          Esta vista necesita el almacenamiento en la nube para que todo el equipo vea
          lo mismo, y ahora mismo no está configurado. Avisa al director de audio.
        </p>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="team-mensaje">
        <h1>Algo falló</h1>
        <p>No se pudo cargar la lista. Vuelve a intentarlo en un momento.</p>
        <button className="team-boton" onClick={cargar}>Reintentar</button>
      </div>
    );
  }

  if (estado === 'fuera') return <TeamLogin onEntrar={entrar} />;

  return (
    <TeamDeliveryList
      juegos={juegos}
      miembro={miembro}
      onMarcar={marcar}
      onSalir={salir}
    />
  );
}

export default TeamApp;
