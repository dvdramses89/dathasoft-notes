import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createDocument, getDocuments, type DocumentListItem } from '../lib/api';

/** Clave del mapa de listados: 'root' para la raiz, o el id de la carpeta. */
function keyOf(categoryId: string | null): string {
  return categoryId ?? 'root';
}

interface DocumentsContextValue {
  /**
   * Listados ya cargados, indexados por carpeta ('root' = raiz).
   * Una clave ausente significa "todavia no cargado": los documentos se piden
   * solo al expandir la carpeta, para no traer el arbol entero de golpe.
   */
  byCategory: Record<string, DocumentListItem[]>;
  /** Carpetas cuyo listado se esta pidiendo ahora mismo. */
  loadingKeys: Set<string>;
  /** Pide los documentos de una carpeta si no estan ya cargados. */
  loadFor: (categoryId: string | null) => Promise<void>;
  /** Vuelve a pedir el listado de una carpeta, este cargado o no. */
  refresh: (categoryId: string | null) => Promise<void>;
  create: (title: string, categoryId: string | null) => Promise<DocumentListItem>;
  /** Refleja en el listado un cambio ya guardado en la API (p. ej. el titulo). */
  patchLocal: (doc: DocumentListItem) => void;
}

const DocumentsContext = createContext<DocumentsContextValue | undefined>(undefined);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [byCategory, setByCategory] = useState<Record<string, DocumentListItem[]>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  // Peticiones en vuelo, para no lanzar dos veces el mismo listado.
  const inFlight = useRef<Set<string>>(new Set());

  const fetchInto = useCallback(async (categoryId: string | null) => {
    const key = keyOf(categoryId);
    if (inFlight.current.has(key)) {
      return;
    }
    inFlight.current.add(key);
    setLoadingKeys((prev) => new Set(prev).add(key));
    try {
      const docs = await getDocuments(categoryId);
      setByCategory((prev) => ({ ...prev, [key]: docs }));
    } catch {
      setByCategory((prev) => ({ ...prev, [key]: [] }));
    } finally {
      inFlight.current.delete(key);
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const loadFor = useCallback(
    async (categoryId: string | null) => {
      const key = keyOf(categoryId);
      // Ya cargado: no repetimos la llamada.
      if (byCategory[key] !== undefined) {
        return;
      }
      await fetchInto(categoryId);
    },
    [byCategory, fetchInto],
  );

  const refresh = useCallback(
    (categoryId: string | null) => fetchInto(categoryId),
    [fetchInto],
  );

  const create = useCallback(async (title: string, categoryId: string | null) => {
    const doc = await createDocument({ title, categoryId });
    const key = keyOf(categoryId);
    setByCategory((prev) =>
      // Si la carpeta aun no se habia cargado, la inicializamos con el documento
      // nuevo: es su unico contenido conocido y se completara al expandirla.
      prev[key] === undefined
        ? { ...prev, [key]: [doc] }
        : { ...prev, [key]: [...prev[key], doc] },
    );
    return doc;
  }, []);

  const patchLocal = useCallback((doc: DocumentListItem) => {
    const key = keyOf(doc.categoryId);
    setByCategory((prev) => {
      const list = prev[key];
      if (!list) {
        return prev;
      }
      return { ...prev, [key]: list.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)) };
    });
  }, []);

  const value = useMemo<DocumentsContextValue>(
    () => ({ byCategory, loadingKeys, loadFor, refresh, create, patchLocal }),
    [byCategory, loadingKeys, loadFor, refresh, create, patchLocal],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) {
    throw new Error('useDocuments debe usarse dentro de <DocumentsProvider>');
  }
  return ctx;
}
