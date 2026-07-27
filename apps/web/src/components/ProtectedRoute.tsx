import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Solo deja pasar si hay usuario autenticado; si no, redirige a /login.
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="card">
        <span className="badge badge--loading">Cargando…</span>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
