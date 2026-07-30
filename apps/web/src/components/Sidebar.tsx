import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronRight,
  IconDots,
  IconFilePlus,
  IconFileText,
  IconFolderPlus,
  IconFolders,
  IconHome,
  IconPalette,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategories } from '../categories/CategoriesContext';
import { FolderIcon } from '../categories/folderIcons';
import { useDocuments } from '../documents/DocumentsContext';
import type { CategoryNode, DocumentListItem, TreeMode } from '../lib/api';
import { FolderFormModal, type FolderLook } from './FolderFormModal';
import { MoveDocumentModal } from './MoveDocumentModal';
import { MoveModal } from './MoveModal';

type DropPos = 'before' | 'after';
interface DropIndicator {
  id: string;
  pos: DropPos;
}

/** Estado del dialogo de carpeta: crear dentro de `parentId`, o editar `node`. */
type FolderForm =
  | { mode: 'create'; parentId: string | null; parentName: string | null }
  | { mode: 'edit'; node: CategoryNode };

// IDs (en orden) de las carpetas hermanas de un nivel dado.
function siblingIdsOf(tree: CategoryNode[], parentId: string | null): string[] {
  if (parentId === null) {
    return tree.map((n) => n.id);
  }
  const stack = [...tree];
  while (stack.length > 0) {
    const current = stack.pop() as CategoryNode;
    if (current.id === parentId) {
      return current.children.map((c) => c.id);
    }
    stack.push(...current.children);
  }
  return [];
}

function RenameInput({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TextInput
      size="xs"
      variant="filled"
      autoFocus
      style={{ flex: 1 }}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSubmit(value.trim());
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={() => onSubmit(value.trim())}
    />
  );
}

/** Menu de tres puntos de una fila del arbol. */
function RowMenu({ children }: { children: ReactNode }) {
  return (
    <Menu position="bottom-start" width={210} shadow="md" withinPortal>
      <Menu.Target>
        <ActionIcon
          component="div"
          role="button"
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Acciones"
          onClick={(e) => e.stopPropagation()}
        >
          <IconDots size={15} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>{children}</Menu.Dropdown>
    </Menu>
  );
}

interface DocItemProps {
  doc: DocumentListItem;
  depth: number;
  active: boolean;
  editing: boolean;
  onOpen: (id: string) => void;
  onStartRename: (id: string) => void;
  onSubmitRename: (doc: DocumentListItem, title: string) => void;
  onCancelRename: () => void;
  onRequestMove: (doc: DocumentListItem) => void;
  onRequestDelete: (doc: DocumentListItem) => void;
  dragDocId: string | null;
  dropIndicator: DropIndicator | null;
  onDragStart: (doc: DocumentListItem) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, doc: DocumentListItem) => void;
  onDrop: (doc: DocumentListItem) => void;
  onDragEnd: () => void;
}

/** Fila de documento dentro del arbol. */
function DocItem(props: DocItemProps) {
  const { doc, depth, active, editing, dragDocId, dropIndicator } = props;
  const isDragging = dragDocId === doc.id;
  const dropBefore = dropIndicator?.id === doc.id && dropIndicator.pos === 'before';
  const dropAfter = dropIndicator?.id === doc.id && dropIndicator.pos === 'after';

  const classes = [
    'tree-row',
    active ? 'tree-row--active' : '',
    isDragging ? 'tree-row--dragging' : '',
    dropBefore ? 'tree-row--drop-before' : '',
    dropAfter ? 'tree-row--drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li>
      <div
        className={classes}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        draggable={!editing}
        onClick={(e) => {
          e.stopPropagation();
          props.onOpen(doc.id);
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          props.onDragStart(doc);
        }}
        onDragOver={(e) => props.onDragOver(e, doc)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onDrop(doc);
        }}
        onDragEnd={props.onDragEnd}
      >
        <span className="tree-chevron" />
        <IconFileText size={15} stroke={1.7} style={{ flex: 'none', opacity: 0.75 }} />

        {editing ? (
          <RenameInput
            initial={doc.title}
            onSubmit={(title) => props.onSubmitRename(doc, title)}
            onCancel={props.onCancelRename}
          />
        ) : (
          <>
            <span className="tree-row-name">{doc.title}</span>
            <span className="tree-row-actions">
              <RowMenu>
                <Menu.Item
                  leftSection={<IconPencil size={15} />}
                  onClick={() => props.onStartRename(doc.id)}
                >
                  Renombrar
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFolders size={15} />}
                  onClick={() => props.onRequestMove(doc)}
                >
                  Mover a…
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={15} />}
                  onClick={() => props.onRequestDelete(doc)}
                >
                  Enviar a la papelera
                </Menu.Item>
              </RowMenu>
            </span>
          </>
        )}
      </div>
    </li>
  );
}

interface TreeItemProps {
  node: CategoryNode;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  editingId: string | null;
  docsByCategory: Record<string, DocumentListItem[]>;
  loadingDocKeys: Set<string>;
  openDocId: string | null;
  onOpenDoc: (id: string) => void;
  /** Props de gestión de documentos, reenviadas tal cual a cada DocItem. */
  docActions: Omit<DocItemProps, 'doc' | 'depth' | 'active' | 'editing' | 'onOpen'>;
  editingDocId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onStartRename: (id: string) => void;
  onSubmitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onRequestMove: (node: CategoryNode) => void;
  onRequestDelete: (node: CategoryNode) => void;
  onRequestRestyle: (node: CategoryNode) => void;
  onRequestSubfolder: (node: CategoryNode) => void;
  onRequestNewDoc: (node: CategoryNode) => void;
  dragId: string | null;
  dropIndicator: DropIndicator | null;
  onDragStart: (node: CategoryNode) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, node: CategoryNode) => void;
  onDrop: (node: CategoryNode) => void;
  onDragEnd: () => void;
}

function TreeItem(props: TreeItemProps) {
  const { node, depth, selectedId, expanded, editingId, dragId, dropIndicator } = props;
  // Los documentos llegan al expandir; hasta entonces la clave no existe.
  const docs = props.docsByCategory[node.id];
  const loadingDocs = props.loadingDocKeys.has(node.id);
  // Chevron segun el contador que viene con el arbol: sabemos si la carpeta
  // tiene contenido sin haber cargado ni un documento.
  const hasChildren = node.children.length > 0 || node.documentCount > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isEditing = editingId === node.id;
  const isDragging = dragId === node.id;
  const dropBefore = dropIndicator?.id === node.id && dropIndicator.pos === 'before';
  const dropAfter = dropIndicator?.id === node.id && dropIndicator.pos === 'after';

  const classes = [
    'tree-row',
    isSelected ? 'tree-row--selected' : '',
    isDragging ? 'tree-row--dragging' : '',
    dropBefore ? 'tree-row--drop-before' : '',
    dropAfter ? 'tree-row--drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li>
      <div
        className={classes}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        draggable={!isEditing}
        onClick={() => props.onSelect(node.id)}
        onDragStart={(e) => {
          e.stopPropagation();
          props.onDragStart(node);
        }}
        onDragOver={(e) => props.onDragOver(e, node)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onDrop(node);
        }}
        onDragEnd={props.onDragEnd}
      >
        <span
          className={`tree-chevron${isOpen ? ' tree-chevron--open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              props.onToggle(node.id);
            }
          }}
        >
          {hasChildren ? <IconChevronRight size={13} stroke={2.2} /> : null}
        </span>
        <FolderIcon icon={node.icon} color={node.color} size={16} />

        {isEditing ? (
          <RenameInput
            initial={node.name}
            onSubmit={(name) => props.onSubmitRename(node.id, name)}
            onCancel={props.onCancelRename}
          />
        ) : (
          <>
            <span className="tree-row-name">{node.name}</span>
            {/* El contador solo cuando esta cerrada: al abrirla ya se ven. */}
            {!isOpen && node.documentCount > 0 && (
              <Text component="span" size="xs" c="dimmed" style={{ flex: 'none' }}>
                {node.documentCount}
              </Text>
            )}
            <span className="tree-row-actions">
              <RowMenu>
                <Menu.Item
                  leftSection={<IconFilePlus size={15} />}
                  onClick={() => props.onRequestNewDoc(node)}
                >
                  Nuevo documento
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFolderPlus size={15} />}
                  onClick={() => props.onRequestSubfolder(node)}
                >
                  Nueva subcarpeta
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconPencil size={15} />}
                  onClick={() => props.onStartRename(node.id)}
                >
                  Renombrar
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconPalette size={15} />}
                  onClick={() => props.onRequestRestyle(node)}
                >
                  Icono y color…
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFolders size={15} />}
                  onClick={() => props.onRequestMove(node)}
                >
                  Mover a…
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={15} />}
                  onClick={() => props.onRequestDelete(node)}
                >
                  Eliminar
                </Menu.Item>
              </RowMenu>
            </span>
          </>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul className="tree-list">
          {node.children.map((child) => (
            <TreeItem key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
          {(docs ?? []).map((doc) => (
            <DocItem
              key={doc.id}
              {...props.docActions}
              doc={doc}
              depth={depth + 1}
              active={props.openDocId === doc.id}
              editing={props.editingDocId === doc.id}
              onOpen={props.onOpenDoc}
            />
          ))}
          {docs === undefined && loadingDocs && (
            <li style={{ paddingLeft: `${(depth + 1) * 14 + 26}px` }}>
              <Group gap={6} py={4}>
                <Loader size={12} />
                <Text size="xs" c="dimmed">
                  Cargando…
                </Text>
              </Group>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const {
    tree,
    rootDocumentCount,
    loading,
    selectedId,
    selectedNode,
    select,
    reload: reloadTree,
    create,
    rename,
    restyle,
    remove,
    move,
    reorder,
  } = useCategories();
  const {
    byCategory,
    loadingKeys,
    loadFor,
    create: createDoc,
    rename: renameDoc,
    move: moveDoc,
    remove: removeDoc,
    reorder: reorderDocs,
  } = useDocuments();
  const navigate = useNavigate();
  const { id: openDocId } = useParams();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folderForm, setFolderForm] = useState<FolderForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<CategoryNode | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragParent, setDragParent] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  // Estado propio de los documentos (renombrar, mover, borrar, arrastrar).
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentListItem | null>(null);
  const [moveDocTarget, setMoveDocTarget] = useState<DocumentListItem | null>(null);
  const [dragDoc, setDragDoc] = useState<DocumentListItem | null>(null);
  const [docDropIndicator, setDocDropIndicator] = useState<DropIndicator | null>(null);

  // Los documentos de la raíz se ven siempre (no cuelgan de ningún chevron),
  // así que se cargan al arrancar, pero solo si el árbol dice que hay alguno.
  const rootDocs = byCategory.root ?? [];
  useEffect(() => {
    if (rootDocumentCount > 0) {
      void loadFor(null);
    }
  }, [rootDocumentCount, loadFor]);

  function toggle(id: string) {
    // Al expandir se piden sus documentos (solo la primera vez). Va fuera del
    // updater de setExpanded: ese callback corre en fase de render y no debe
    // provocar cambios de estado en otro componente.
    if (!expanded.has(id)) {
      void loadFor(id);
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Abre un documento: pasa a ser el único nodo marcado del árbol. */
  function openDoc(id: string) {
    select(null);
    navigate(`/documents/${id}`);
  }

  /**
   * Selecciona una carpeta. Si había un documento abierto, se sale de su ruta
   * para que deje de estar marcado: solo un nodo seleccionado a la vez.
   */
  function selectCategory(id: string | null) {
    select(id);
    if (openDocId) {
      navigate('/');
    }
  }

  /** Crea un documento en una carpeta (o en la raíz) y lo abre. */
  async function newDocument(categoryId: string | null) {
    setBusy(true);
    try {
      const doc = await createDoc('Documento sin título', categoryId);
      if (categoryId) {
        // La carpeta ya tiene contenido: hay que traer su listado si no estaba
        // cargado y refrescar el árbol para que aparezca su chevron.
        await loadFor(categoryId);
        setExpanded((prev) => new Set(prev).add(categoryId));
      }
      await reloadTree();
      // Queda marcado solo el documento nuevo, no la carpeta donde se creó.
      openDoc(doc.id);
    } finally {
      setBusy(false);
    }
  }

  /** Confirma el diálogo de carpeta, tanto al crear como al editar el aspecto. */
  async function submitFolderForm(look: FolderLook) {
    if (!folderForm) {
      return;
    }
    setBusy(true);
    try {
      if (folderForm.mode === 'create') {
        await create(look.name, folderForm.parentId, { color: look.color, icon: look.icon });
        if (folderForm.parentId) {
          setExpanded((prev) => new Set(prev).add(folderForm.parentId as string));
        }
      } else {
        const { node } = folderForm;
        if (look.name !== node.name) {
          await rename(node.id, look.name);
        }
        await restyle(node.id, { color: look.color, icon: look.icon });
      }
      setFolderForm(null);
    } finally {
      setBusy(false);
    }
  }

  // ---- Gestión de documentos (renombrar / mover / borrar) ----

  function submitDocRename(doc: DocumentListItem, title: string) {
    setEditingDocId(null);
    if (title && title !== doc.title) {
      void renameDoc(doc.id, doc.categoryId, title);
    }
  }

  async function confirmDocDelete() {
    const doc = deleteDocTarget;
    setDeleteDocTarget(null);
    if (!doc) {
      return;
    }
    await removeDoc(doc.id, doc.categoryId);
    await reloadTree(); // el contador de la carpeta baja
    // Si el documento borrado era el que estaba abierto, salimos de su ruta.
    if (openDocId === doc.id) {
      navigate('/');
    }
  }

  async function confirmDocMove(categoryId: string | null) {
    const doc = moveDocTarget;
    setMoveDocTarget(null);
    if (!doc) {
      return;
    }
    await moveDoc(doc.id, doc.categoryId, categoryId);
    await reloadTree(); // cambian los contadores de origen y destino
    if (categoryId) {
      // Si la carpeta destino no estaba cargada, hay que traer su listado:
      // al expandirla aquí no pasamos por `toggle`, que es quien lo pide.
      await loadFor(categoryId);
      setExpanded((prev) => new Set(prev).add(categoryId));
    }
  }

  // ---- Drag & drop para reordenar documentos de una misma carpeta ----

  function clearDocDrag() {
    setDragDoc(null);
    setDocDropIndicator(null);
  }

  function handleDocDragOver(e: DragEvent<HTMLDivElement>, target: DocumentListItem) {
    // Solo se reordena entre documentos de la misma carpeta.
    if (dragDoc && target.categoryId === dragDoc.categoryId && target.id !== dragDoc.id) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const pos: DropPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDocDropIndicator({ id: target.id, pos });
    }
  }

  function handleDocDrop(target: DocumentListItem) {
    if (
      !dragDoc ||
      !docDropIndicator ||
      target.categoryId !== dragDoc.categoryId ||
      target.id === dragDoc.id
    ) {
      clearDocDrag();
      return;
    }
    const key = dragDoc.categoryId ?? 'root';
    const ids = (byCategory[key] ?? []).map((d) => d.id).filter((id) => id !== dragDoc.id);
    const idx = ids.indexOf(target.id);
    if (idx === -1) {
      clearDocDrag();
      return;
    }
    ids.splice(docDropIndicator.pos === 'before' ? idx : idx + 1, 0, dragDoc.id);
    void reorderDocs(dragDoc.categoryId, ids);
    clearDocDrag();
  }

  function submitRename(id: string, name: string) {
    setEditingId(null);
    if (name) {
      void rename(id, name);
    }
  }

  function confirmDelete(mode: TreeMode) {
    if (deleteTarget) {
      void remove(deleteTarget.id, mode);
    }
    setDeleteTarget(null);
  }

  // ---- Drag & drop para reordenar entre hermanas ----
  function clearDrag() {
    setDragId(null);
    setDragParent(null);
    setDropIndicator(null);
  }

  function handleDragStart(node: CategoryNode) {
    setDragId(node.id);
    setDragParent(node.parentId);
    setDropIndicator(null);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, node: CategoryNode) {
    // Solo se reordena entre hermanas del mismo padre (y no sobre sí misma).
    if (dragId && node.parentId === dragParent && node.id !== dragId) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const pos: DropPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDropIndicator({ id: node.id, pos });
    }
  }

  function handleDrop(target: CategoryNode) {
    if (!dragId || !dropIndicator || target.parentId !== dragParent || target.id === dragId) {
      clearDrag();
      return;
    }
    const ids = siblingIdsOf(tree, dragParent).filter((id) => id !== dragId);
    const idx = ids.indexOf(target.id);
    if (idx === -1) {
      clearDrag();
      return;
    }
    const insertAt = dropIndicator.pos === 'before' ? idx : idx + 1;
    ids.splice(insertAt, 0, dragId);
    void reorder(dragParent, ids);
    clearDrag();
  }

  // Acciones comunes a todas las filas de documento.
  const docActions = {
    onStartRename: setEditingDocId,
    onSubmitRename: submitDocRename,
    onCancelRename: () => setEditingDocId(null),
    onRequestMove: setMoveDocTarget,
    onRequestDelete: setDeleteDocTarget,
    dragDocId: dragDoc?.id ?? null,
    dropIndicator: docDropIndicator,
    onDragStart: setDragDoc,
    onDragOver: handleDocDragOver,
    onDrop: handleDocDrop,
    onDragEnd: clearDocDrag,
  };

  const isEmpty = tree.length === 0 && rootDocumentCount === 0;

  return (
    <Stack h="100%" gap={6}>
      <Button
        leftSection={<IconFilePlus size={16} />}
        variant="light"
        size="sm"
        loading={busy}
        onClick={() => void newDocument(selectedId)}
      >
        Nuevo documento
      </Button>

      <div
        className={`tree-row${selectedId === null && !openDocId ? ' tree-row--selected' : ''}`}
        onClick={() => selectCategory(null)}
      >
        <span className="tree-chevron" />
        <IconHome size={16} stroke={1.7} />
        <span className="tree-row-name">Mi espacio</span>
      </div>

      <Divider my={2} />

      <Group justify="space-between" px={6} gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          Carpetas
        </Text>
        <Tooltip
          label={
            selectedNode ? `Nueva subcarpeta en «${selectedNode.name}»` : 'Nueva carpeta'
          }
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Nueva carpeta"
            onClick={() =>
              setFolderForm({
                mode: 'create',
                parentId: selectedId,
                parentName: selectedNode?.name ?? null,
              })
            }
          >
            <IconPlus size={15} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea className="tree-scroll" type="hover" scrollbarSize={8}>
        <Box
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              selectCategory(null);
            }
          }}
          mih="100%"
        >
          {loading ? (
            <Group gap={8} p="xs">
              <Loader size={14} />
              <Text size="xs" c="dimmed">
                Cargando…
              </Text>
            </Group>
          ) : isEmpty ? (
            <Text size="xs" c="dimmed" p="xs">
              Aún no hay nada. Crea una carpeta con «+» o un documento.
            </Text>
          ) : (
            <ul className="tree-list">
              {tree.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expanded={expanded}
                  editingId={editingId}
                  docsByCategory={byCategory}
                  loadingDocKeys={loadingKeys}
                  openDocId={openDocId ?? null}
                  onOpenDoc={openDoc}
                  docActions={docActions}
                  editingDocId={editingDocId}
                  onSelect={selectCategory}
                  onToggle={toggle}
                  onStartRename={setEditingId}
                  onSubmitRename={submitRename}
                  onCancelRename={() => setEditingId(null)}
                  onRequestMove={setMoveTarget}
                  onRequestDelete={setDeleteTarget}
                  onRequestRestyle={(node) => setFolderForm({ mode: 'edit', node })}
                  onRequestSubfolder={(node) =>
                    setFolderForm({ mode: 'create', parentId: node.id, parentName: node.name })
                  }
                  onRequestNewDoc={(node) => void newDocument(node.id)}
                  dragId={dragId}
                  dropIndicator={dropIndicator}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={clearDrag}
                />
              ))}
              {/* Documentos que viven en la raíz (fuera de cualquier carpeta) */}
              {rootDocs.map((doc) => (
                <DocItem
                  key={doc.id}
                  {...docActions}
                  doc={doc}
                  depth={0}
                  active={openDocId === doc.id}
                  editing={editingDocId === doc.id}
                  onOpen={openDoc}
                />
              ))}
            </ul>
          )}
        </Box>
      </ScrollArea>

      {/* ---------------- Diálogos ---------------- */}

      {folderForm && (
        <FolderFormModal
          opened
          title={folderForm.mode === 'create' ? 'Crear nueva carpeta' : 'Icono y color'}
          submitLabel={folderForm.mode === 'create' ? 'Crear' : 'Guardar'}
          parentName={
            folderForm.mode === 'create' ? (folderForm.parentName ?? 'Mi espacio') : undefined
          }
          initial={
            folderForm.mode === 'edit'
              ? {
                  name: folderForm.node.name,
                  icon: folderForm.node.icon ?? undefined,
                  color: folderForm.node.color ?? undefined,
                }
              : undefined
          }
          busy={busy}
          onClose={() => setFolderForm(null)}
          onSubmit={(look) => void submitFolderForm(look)}
        />
      )}

      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget ? `Eliminar «${deleteTarget.name}»` : ''}
      >
        {deleteTarget && deleteTarget.children.length > 0 ? (
          <Stack gap="sm">
            <Text size="sm">
              Esta carpeta contiene subcarpetas. ¿Qué quieres enviar a la papelera?
            </Text>
            <Button variant="default" onClick={() => confirmDelete('single')}>
              Solo esta carpeta
            </Button>
            <Text size="xs" c="dimmed" mt={-8}>
              Las subcarpetas suben al nivel superior
            </Text>
            <Button color="red" onClick={() => confirmDelete('subtree')}>
              Esta carpeta y todo su contenido
            </Button>
            <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
          </Stack>
        ) : (
          <Stack gap="md">
            <Text size="sm">¿Enviar esta carpeta a la papelera?</Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button color="red" onClick={() => confirmDelete('subtree')}>
                Eliminar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={deleteDocTarget !== null}
        onClose={() => setDeleteDocTarget(null)}
        title={deleteDocTarget ? `Eliminar «${deleteDocTarget.title}»` : ''}
      >
        <Stack gap="md">
          <Text size="sm">
            El documento se enviará a la papelera; podrás restaurarlo más adelante.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDeleteDocTarget(null)}>
              Cancelar
            </Button>
            <Button color="red" onClick={() => void confirmDocDelete()}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {moveDocTarget && (
        <MoveDocumentModal
          title={moveDocTarget.title}
          currentCategoryId={moveDocTarget.categoryId}
          tree={tree}
          onCancel={() => setMoveDocTarget(null)}
          onConfirm={(categoryId) => void confirmDocMove(categoryId)}
        />
      )}

      {moveTarget && (
        <MoveModal
          target={moveTarget}
          tree={tree}
          onCancel={() => setMoveTarget(null)}
          onConfirm={(parentId, mode) => {
            void move(moveTarget.id, parentId, mode);
            setMoveTarget(null);
          }}
        />
      )}
    </Stack>
  );
}
