import { useAuth } from '../auth/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <main className="card">
      <h1 className="brand">DTNotes</h1>
      <p className="subtitle">Repositorio de documentación del equipo</p>

      <span className="badge badge--ok">● Sesión iniciada</span>

      <dl className="details">
        <div>
          <dt>Nombre</dt>
          <dd>{user?.name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
        </div>
      </dl>

      <button className="btn btn--ghost" type="button" onClick={logout}>
        Cerrar sesión
      </button>
    </main>
  );
}
