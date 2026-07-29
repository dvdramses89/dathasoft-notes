import { useEffect, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCategories } from '../categories/CategoriesContext';
import { useDocuments } from '../documents/DocumentsContext';
import type { CategoryNode, DocumentListItem, TreeMode } from '../lib/api';
import { MoveModal } from './MoveModal';

type DropPos = 'before' | 'after';
interface DropIndicator {
  id: string;
  pos: DropPos;
}

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

function FolderIcon() {
  return (
    <svg className="folder-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="doc-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.5L17.5 8H14V4.5ZM8 13h8v1.5H8V13Zm0 3.5h8V18H8v-1.5Z"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`chevron${open ? ' chevron--open' : ''}`}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M9 6l6 6-6 6V6Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
      />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm-8 11v-3H8v-2h4V9l4 4-4 4Z"
      />
    </svg>
  );
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
    <input
      className="rename-input"
      autoFocus
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
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

/** Fila de documento dentro del arbol. */
function DocItem({
  doc,
  depth,
  active,
  onOpen,
}: {
  doc: DocumentListItem;
  depth: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <div
        className={`tree-item tree-item--doc${active ? ' tree-item--active' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(doc.id);
        }}
      >
        <span className="tree-chevron" />
        <DocIcon />
        <span className="tree-name">{doc.title}</span>
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
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onStartRename: (id: string) => void;
  onSubmitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onRequestMove: (node: CategoryNode) => void;
  onRequestDelete: (node: CategoryNode) => void;
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
    'tree-item',
    isSelected ? 'tree-item--selected' : '',
    isDragging ? 'tree-item--dragging' : '',
    dropBefore ? 'tree-item--drop-before' : '',
    dropAfter ? 'tree-item--drop-after' : '',
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
          className="tree-chevron"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) {
              props.onToggle(node.id);
            }
          }}
        >
          {hasChildren ? <Chevron open={isOpen} /> : null}
        </span>
        <FolderIcon />

        {isEditing ? (
          <RenameInput
            initial={node.name}
            onSubmit={(name) => props.onSubmitRename(node.id, name)}
            onCancel={props.onCancelRename}
          />
        ) : (
          <span className="tree-name">{node.name}</span>
        )}

        {!isEditing && (
          <span className="tree-actions">
            <button
              className="tree-action"
              type="button"
              title="Renombrar"
              onClick={(e) => {
                e.stopPropagation();
                props.onStartRename(node.id);
              }}
            >
              <PencilIcon />
            </button>
            <button
              className="tree-action"
              type="button"
              title="Mover"
              onClick={(e) => {
                e.stopPropagation();
                props.onRequestMove(node);
              }}
            >
              <MoveIcon />
            </button>
            <button
              className="tree-action"
              type="button"
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                props.onRequestDelete(node);
              }}
            >
              <TrashIcon />
            </button>
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeItem key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
          {(docs ?? []).map((doc) => (
            <DocItem
              key={doc.id}
              doc={doc}
              depth={depth + 1}
              active={props.openDocId === doc.id}
              onOpen={props.onOpenDoc}
            />
          ))}
          {docs === undefined && loadingDocs && (
            <li className="tree-hint" style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}>
              Cargando…
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
    remove,
    move,
    reorder,
  } = useCategories();
  const { user, logout } = useAuth();
  const { byCategory, loadingKeys, loadFor, create: createDoc } = useDocuments();
  const navigate = useNavigate();
  const { id: openDocId } = useParams();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<CategoryNode | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragParent, setDragParent] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

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

  /** Crea un documento en la carpeta seleccionada (o en la raíz) y lo abre. */
  async function newDocument() {
    setBusy(true);
    try {
      const doc = await createDoc('Documento sin título', selectedId);
      if (selectedId) {
        // La carpeta ya tiene contenido: hay que traer su listado si no estaba
        // cargado y refrescar el árbol para que aparezca su chevron.
        await loadFor(selectedId);
        setExpanded((prev) => new Set(prev).add(selectedId));
      }
      await reloadTree();
      // Queda marcado solo el documento nuevo, no la carpeta donde se creó.
      openDoc(doc.id);
    } finally {
      setBusy(false);
    }
  }

  async function submitNew() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    try {
      await create(name, selectedId);
      if (selectedId) {
        setExpanded((prev) => new Set(prev).add(selectedId));
      }
      setNewName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  /** Descarta la creación de carpeta en curso. */
  function cancelNew() {
    setAdding(false);
    setNewName('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void submitNew();
    } else if (e.key === 'Escape') {
      cancelNew();
    }
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

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <span className="sidebar-title">Carpetas</span>
        <span className="sidebar-top-actions">
          <button
            className="icon-btn"
            type="button"
            disabled={busy}
            title={
              selectedNode
                ? `Nuevo documento en «${selectedNode.name}»`
                : 'Nuevo documento en la raíz'
            }
            onClick={() => void newDocument()}
          >
            <DocIcon />
          </button>
          <button
            className="icon-btn"
            type="button"
            title={
              adding
                ? 'Cancelar'
                : selectedNode
                  ? `Nueva subcarpeta en «${selectedNode.name}»`
                  : 'Nueva carpeta'
            }
            onClick={() => (adding ? cancelNew() : setAdding(true))}
          >
            +
          </button>
        </span>
      </div>

      {adding && (
        <div className="add-folder">
          <div className="add-folder-hint">
            En: <strong>{selectedNode ? selectedNode.name : 'Raíz'}</strong>
          </div>
          <input
            className="add-folder-input"
            autoFocus
            placeholder="Nombre de la carpeta"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          <div className="add-folder-actions">
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={cancelNew}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => void submitNew()}
              disabled={busy || newName.trim() === ''}
            >
              Crear
            </button>
          </div>
        </div>
      )}

      <nav
        className="tree"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            selectCategory(null);
          }
        }}
      >
        {loading ? (
          <p className="tree-empty">Cargando…</p>
        ) : tree.length === 0 && rootDocumentCount === 0 ? (
          <p className="tree-empty">Aún no hay nada. Crea una carpeta con «+» o un documento.</p>
        ) : (
          <ul className="tree-root">
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
                onSelect={selectCategory}
                onToggle={toggle}
                onStartRename={setEditingId}
                onSubmitRename={submitRename}
                onCancelRename={() => setEditingId(null)}
                onRequestMove={setMoveTarget}
                onRequestDelete={setDeleteTarget}
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
                doc={doc}
                depth={0}
                active={openDocId === doc.id}
                onOpen={openDoc}
              />
            ))}
          </ul>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase() ?? '?'}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
        </div>
        <button className="icon-btn" type="button" title="Cerrar sesión" onClick={logout}>
          ⎋
        </button>
      </div>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Eliminar «{deleteTarget.name}»</h3>
            {deleteTarget.children.length > 0 ? (
              <>
                <p className="modal-text">
                  Esta carpeta contiene subcarpetas. ¿Qué quieres enviar a la papelera?
                </p>
                <div className="modal-actions modal-actions--stack">
                  <button className="btn btn--ghost" type="button" onClick={() => confirmDelete('single')}>
                    Solo esta carpeta
                    <small>Las subcarpetas suben al nivel superior</small>
                  </button>
                  <button className="btn btn--danger" type="button" onClick={() => confirmDelete('subtree')}>
                    Esta carpeta y todo su contenido
                  </button>
                  <button className="modal-cancel" type="button" onClick={() => setDeleteTarget(null)}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-text">¿Enviar esta carpeta a la papelera?</p>
                <div className="modal-actions">
                  <button className="btn btn--ghost" type="button" onClick={() => setDeleteTarget(null)}>
                    Cancelar
                  </button>
                  <button className="btn btn--danger" type="button" onClick={() => confirmDelete('subtree')}>
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
    </aside>
  );
}
