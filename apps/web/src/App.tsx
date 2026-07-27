import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Publicas: si ya hay sesion, no dejamos volver a login/registro */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* Protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      {/* Cualquier otra ruta va al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
