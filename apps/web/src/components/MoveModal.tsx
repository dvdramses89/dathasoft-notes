import { useMemo, useState } from 'react';
import type { CategoryNode, TreeMode } from '../lib/api';

function collectSubtreeIds(node: CategoryNode): Set<string> {
  const ids = new Set<string>();
  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop() as CategoryNode;
    ids.add(current.id);
    stack.push(...current.children);
  }
  return ids;
}

interface MoveModalProps {
  target: CategoryNode;
  tree: CategoryNode[];
  onCancel: () => void;
  onConfirm: (parentId: string | null, mode: TreeMode) => void;
}

export function MoveModal({ target, tree, onCancel, onConfirm }: MoveModalProps) {
  // No se puede mover una carpeta dentro de si misma ni de su subarbol.
  const disabledIds = useMemo(() => {
    const ids = collectSubtreeIds(target);
    ids.add(target.id);
    return ids;
  }, [target]);

  // dest = null -> nada elegido; { parentId: null } -> raiz; { parentId: id } -> carpeta
  const [dest, setDest] = useState<{ parentId: string | null } | null>(null);
  const [mode, setMode] = useState<TreeMode>('subtree');
  const hasChildren = target.children.length > 0;

  function renderNodes(nodes: CategoryNode[], depth: number) {
    return nodes.map((node) => {
      const disabled = disabledIds.has(node.id);
      const selected = dest?.parentId === node.id;
      return (
        <div key={node.id}>
          <button
            type="button"
            className={`dest-item${selected ? ' dest-item--selected' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            disabled={disabled}
            onClick={() => setDest({ parentId: node.id })}
          >
            {node.name}
          </button>
          {node.children.length > 0 && renderNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Mover «{target.name}» a:</h3>

        <div className="dest-tree">
          <button
            type="button"
            className={`dest-item${dest?.parentId === null ? ' dest-item--selected' : ''}`}
            onClick={() => setDest({ parentId: null })}
          >
            Raíz (nivel superior)
          </button>
          {renderNodes(tree, 0)}
        </div>

        {hasChildren && (
          <div className="move-mode">
            <label className="radio">
              <input
                type="radio"
                name="movemode"
                checked={mode === 'subtree'}
                onChange={() => setMode('subtree')}
              />
              <span>Mover toda la estructura</span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name="movemode"
                checked={mode === 'single'}
                onChange={() => setMode('single')}
              />
              <span>
                Mover solo esta carpeta
                <small>Las subcarpetas suben al nivel de origen</small>
              </span>
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn"
            type="button"
            disabled={dest === null}
            onClick={() => {
              if (dest !== null) {
                onConfirm(dest.parentId, mode);
              }
            }}
          >
            Mover
          </button>
        </div>
      </div>
    </div>
  );
}
