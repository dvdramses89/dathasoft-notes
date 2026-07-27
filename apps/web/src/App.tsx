import { useEffect, useState } from 'react';
import { getHealth, API_URL, type HealthResponse } from './lib/api';

type ConnState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string };

export function App() {
  const [state, setState] = useState<ConnState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((data) => {
        if (active) setState({ status: 'ok', data });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="card">
      <h1 className="brand">DTNotes</h1>
      <p className="subtitle">Repositorio de documentación del equipo</p>

      <div className="status">
        {state.status === 'loading' && (
          <span className="badge badge--loading">Conectando con la API…</span>
        )}
        {state.status === 'ok' && (
          <span className="badge badge--ok">● Conectado con el backend</span>
        )}
        {state.status === 'error' && (
          <span className="badge badge--error">● Sin conexión con el backend</span>
        )}
      </div>

      {state.status === 'ok' && (
        <dl className="details">
          <div>
            <dt>Servicio</dt>
            <dd>{state.data.service}</dd>
          </div>
          <div>
            <dt>Entorno</dt>
            <dd>{state.data.env}</dd>
          </div>
          <div>
            <dt>Timestamp</dt>
            <dd>{new Date(state.data.timestamp).toLocaleString()}</dd>
          </div>
        </dl>
      )}

      {state.status === 'error' && (
        <p className="hint">
          No se pudo contactar con <code>{API_URL}/health</code>. Comprueba que la API
          esté levantada ({state.message}).
        </p>
      )}
    </main>
  );
}
