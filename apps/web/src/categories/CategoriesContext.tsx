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
  createCategory,
  deleteCategory,
  getCategories,
  moveCategory,
  updateCategory,
  type CategoryNode,
  type TreeMode,
} from '../lib/api';

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
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string, mode: TreeMode) => Promise<void>;
  move: (id: string, parentId: string | null, mode: TreeMode) => Promise<void>;
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

  const rename = useCallback(
    async (id: string, name: string) => {
      await updateCategory(id, { name });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string, mode: TreeMode) => {
      await deleteCategory(id, mode);
      setSelectedId((current) => (current === id ? null : current));
      await reload();
    },
    [reload],
  );

  const move = useCallback(
    async (id: string, parentId: string | null, mode: TreeMode) => {
      await moveCategory(id, parentId, mode);
      await reload();
    },
    [reload],
  );

  const selectedNode = useMemo(
    () => (selectedId ? findNode(tree, selectedId) : null),
    [tree, selectedId],
  );

  const value = useMemo<CategoriesContextValue>(
    () => ({
      tree,
      loading,
      selectedId,
      selectedNode,
      select,
      reload,
      create,
      rename,
      remove,
      move,
    }),
    [tree, loading, selectedId, selectedNode, select, reload, create, rename, remove, move],
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
