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
  attachTag,
  createTag,
  deleteTag,
  detachTag,
  getTags,
  updateTag,
  type Tag,
  type TagWithCount,
} from '../lib/api';

interface TagsContextValue {
  /** Catalogo completo de tags del usuario, alfabetico y con su contador de uso. */
  tags: TagWithCount[];
  /** false hasta que llega la primera respuesta de la API. */
  loaded: boolean;
  reload: () => Promise<void>;
  create: (name: string, color?: string) => Promise<Tag>;
  update: (id: string, input: { name?: string; color?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Vincula por nombre (la API lo crea si no existe) y devuelve los del documento. */
  attach: (documentId: string, name: string) => Promise<Tag[]>;
  detach: (documentId: string, tagId: string) => Promise<void>;
  /**
   * Sustituye los tags de un documento por su version del catalogo, que es la
   * fuente de verdad del nombre y el color. Un tag que ya no esta en el catalogo
   * (renombrado no, pero si eliminado desde el dialogo de gestion) desaparece.
   *
   * Gracias a esto, renombrar o eliminar un tag se refleja al instante en los
   * chips de los listados ya cargados, sin volver a pedirlos.
   */
  resolve: (tags: Tag[]) => Tag[];
}

const TagsContext = createContext<TagsContextValue | undefined>(undefined);

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTags(await getTags());
    } catch {
      setTags([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (name: string, color?: string) => {
      const tag = await createTag(color ? { name, color } : { name });
      await reload();
      return tag;
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, input: { name?: string; color?: string }) => {
      await updateTag(id, input);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTag(id);
      await reload();
    },
    [reload],
  );

  const attach = useCallback(
    async (documentId: string, name: string) => {
      const docTags = await attachTag(documentId, name);
      // El catalogo cambia: puede haber un tag nuevo, y los contadores suben.
      await reload();
      return docTags;
    },
    [reload],
  );

  const detach = useCallback(
    async (documentId: string, tagId: string) => {
      await detachTag(documentId, tagId);
      await reload();
    },
    [reload],
  );

  const byId = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const resolve = useCallback(
    (docTags: Tag[]): Tag[] => {
      // Mientras el catalogo no ha llegado se pinta lo que trajo el documento;
      // asi los chips no parpadean al abrir la app.
      if (!loaded) {
        return docTags;
      }
      return docTags.map((tag) => byId.get(tag.id)).filter((tag): tag is TagWithCount => Boolean(tag));
    },
    [byId, loaded],
  );

  const value = useMemo<TagsContextValue>(
    () => ({ tags, loaded, reload, create, update, remove, attach, detach, resolve }),
    [tags, loaded, reload, create, update, remove, attach, detach, resolve],
  );

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTags(): TagsContextValue {
  const ctx = useContext(TagsContext);
  if (!ctx) {
    throw new Error('useTags debe usarse dentro de <TagsProvider>');
  }
  return ctx;
}
