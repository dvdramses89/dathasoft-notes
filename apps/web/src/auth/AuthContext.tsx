import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getMe,
  login as apiLogin,
  register as apiRegister,
  setAuthToken,
  type PublicUser,
} from '../lib/api';

const TOKEN_KEY = 'dtnotes_token';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Al cargar la app: si hay token guardado, lo validamos cargando /me.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        // Token invalido o caducado: lo descartamos.
        localStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin({ email, password });
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    setAuthToken(result.accessToken);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiRegister({ name, email, password });
      // Auto-login tras registrarse para una experiencia fluida.
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
