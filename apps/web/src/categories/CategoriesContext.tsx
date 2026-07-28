import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createCategory, getCategories, type CategoryNode } from '../lib/api';

function findNode(nodes: CategoryNode[], id: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = findNode(node.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

interface CategoriesContextValue {
  tree: CategoryNode[];
  loading: boolean;
  selectedId: string | null;
  selectedNode: CategoryNode | null;
  select: (id: string | null) => void;
  reload: () => Promise<void>;
  create: (name: string, parentId: string | null) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await getCategories();
    setTree(data);
  }, []);

  useEffect(() => {
    reload()
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [reload]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const create = useCallback(
    async (name: string, parentId: string | null) => {
      await createCategory({ name, parentId });
      await reload();
    },
    [reload],
  );

  const selectedNode = useMemo(
    () => (selectedId ? findNode(tree, selectedId) : null),
    [tree, selectedId],
  );

  const value = useMemo<CategoriesContextValue>(
    () => ({ tree, loading, selectedId, selectedNode, select, reload, create }),
    [tree, loading, selectedId, selectedNode, select, reload, create],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) {
    throw new Error('useCategories debe usarse dentro de <CategoriesProvider>');
  }
  return ctx;
}
