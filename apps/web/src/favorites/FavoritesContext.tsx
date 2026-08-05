import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { addFavorite, getFavorites, removeFavorite, type DocumentListItem } from '../lib/api';

interface FavoritesContextValue {
  /** Documentos favoritos, del ultimo marcado al primero. Es lo que pinta el sidebar. */
  favorites: DocumentListItem[];
  /** false hasta que llega la primera respuesta de la API. */
  loaded: boolean;
  reload: () => Promise<void>;
  /**
   * Fuente de verdad de la estrella. `fallback` es el `isFavorite` que trajo la
   * API con el documento, y solo se usa mientras la lista no ha llegado: asi la
   * estrella no parpadea en el primer render.
   */
  isFavorite: (documentId: string, fallback?: boolean) => boolean;
  /** Marca o desmarca segun el estado actual. Devuelve como queda. */
  toggle: (documentId: string) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<DocumentListItem[]>([]);
  // Los ids van aparte de la lista para poder marcarlos de forma optimista: el
  // `reload()` posterior los vuelve a cuadrar con la respuesta de la API.
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await getFavorites();
      setFavorites(list);
      setIds(new Set(list.map((doc) => doc.id)));
    } catch {
      setFavorites([]);
      setIds(new Set());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isFavorite = useCallback(
    (documentId: string, fallback = false) => (loaded ? ids.has(documentId) : fallback),
    [ids, loaded],
  );

  const toggle = useCallback(
    async (documentId: string) => {
      const next = !ids.has(documentId);
      // La estrella responde al instante; si la llamada falla, el reload del
      // `finally` devuelve el estado real.
      setIds((prev) => {
        const updated = new Set(prev);
        if (next) {
          updated.add(documentId);
        } else {
          updated.delete(documentId);
        }
        return updated;
      });
      try {
        if (next) {
          await addFavorite(documentId);
        } else {
          await removeFavorite(documentId);
        }
      } finally {
        await reload();
      }
      return next;
    },
    [ids, reload],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, loaded, reload, isFavorite, toggle }),
    [favorites, loaded, reload, isFavorite, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>');
  }
  return ctx;
}
