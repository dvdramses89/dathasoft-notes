import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCategories } from '../categories/CategoriesContext';
import type { CategoryNode } from '../lib/api';

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

interface TreeItemProps {
  node: CategoryNode;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function TreeItem({ node, depth, selectedId, expanded, onSelect, onToggle }: TreeItemProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <li>
      <div
        className={`tree-item${isSelected ? ' tree-item--selected' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span
          className="tree-chevron"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggle(node.id);
            }
          }}
        >
          {hasChildren ? <Chevron open={isOpen} /> : null}
        </span>
        <FolderIcon />
        <span className="tree-name">{node.name}</span>
      </div>

      {hasChildren && isOpen && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const { tree, loading, selectedId, selectedNode, select, create } = useCategories();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
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

  async function submitNew() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    try {
      await create(name, selectedId);
      // Al crear una subcarpeta, expandimos la carpeta padre para verla.
      if (selectedId) {
        setExpanded((prev) => new Set(prev).add(selectedId));
      }
      setNewName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void submitNew();
    } else if (e.key === 'Escape') {
      setAdding(false);
      setNewName('');
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <span className="sidebar-title">Carpetas</span>
        <button
          className="icon-btn"
          type="button"
          title={selectedNode ? `Nueva subcarpeta en «${selectedNode.name}»` : 'Nueva carpeta'}
          onClick={() => setAdding((v) => !v)}
        >
          +
        </button>
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
        </div>
      )}

      <nav
        className="tree"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            select(null);
          }
        }}
      >
        {loading ? (
          <p className="tree-empty">Cargando…</p>
        ) : tree.length === 0 ? (
          <p className="tree-empty">Aún no hay carpetas. Crea la primera con «+».</p>
        ) : (
          <ul className="tree-root">
            {tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                expanded={expanded}
                onSelect={select}
                onToggle={toggle}
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
    </aside>
  );
}
