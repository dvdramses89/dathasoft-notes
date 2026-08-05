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
  emptyTrash,
  getTrash,
  purgeTrash,
  restoreTrash,
  type TrashCategory,
  type TrashDocument,
  type TrashSelection,
} from '../lib/api';

interface TrashContextValue {
  categories: TrashCategory[];
  documents: TrashDocument[];
  /** Elementos listados; es lo que pinta el contador del sidebar. */
  count: number;
  /** Dias antes de la purga automatica. Lo dice la API, no se fija aqui. */
  retentionDays: number;
  /** false hasta que llega la primera respuesta de la API. */
  loaded: boolean;
  reload: () => Promise<void>;
  restore: (selection: TrashSelection) => Promise<number>;
  purge: (selection: TrashSelection) => Promise<number>;
  empty: () => Promise<number>;
}

const TrashContext = createContext<TrashContextValue | undefined>(undefined);

export function TrashProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TrashCategory[]>([]);
  const [documents, setDocuments] = useState<TrashDocument[]>([]);
  const [retentionDays, setRetentionDays] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const trash = await getTrash();
      setCategories(trash.categories);
      setDocuments(trash.documents);
      setRetentionDays(trash.retentionDays);
    } catch {
      setCategories([]);
      setDocuments([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Las tres mutaciones recargan y NO son optimistas: restaurar mueve cosas
  // entre carpetas y cambia el arbol, asi que adivinar el resultado en local
  // saldria mas caro que volver a pedir una lista que siempre es corta.
  const restore = useCallback(
    async (selection: TrashSelection) => {
      const { restored } = await restoreTrash(selection);
      await reload();
      return restored;
    },
    [reload],
  );

  const purge = useCallback(
    async (selection: TrashSelection) => {
      const { purged } = await purgeTrash(selection);
      await reload();
      return purged;
    },
    [reload],
  );

  const empty = useCallback(async () => {
    const { purged } = await emptyTrash();
    await reload();
    return purged;
  }, [reload]);

  const value = useMemo<TrashContextValue>(
    () => ({
      categories,
      documents,
      count: categories.length + documents.length,
      retentionDays,
      loaded,
      reload,
      restore,
      purge,
      empty,
    }),
    [categories, documents, retentionDays, loaded, reload, restore, purge, empty],
  );

  return <TrashContext.Provider value={value}>{children}</TrashContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTrash(): TrashContextValue {
  const ctx = useContext(TrashContext);
  if (!ctx) {
    throw new Error('useTrash debe usarse dentro de <TrashProvider>');
  }
  return ctx;
}
