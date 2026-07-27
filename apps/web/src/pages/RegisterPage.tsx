import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="card">
      <h1 className="brand">DTNotes</h1>
      <p className="subtitle">Crea tu cuenta</p>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <small className="field-hint">Mínimo 8 caracteres</small>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="switch">
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </main>
  );
}
