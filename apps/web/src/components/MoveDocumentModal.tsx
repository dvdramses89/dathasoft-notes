import { useState } from 'react';
import type { CategoryNode } from '../lib/api';

interface MoveDocumentModalProps {
  /** Título del documento que se está moviendo. */
  title: string;
  /** Carpeta en la que está ahora (null = raíz), para marcarla y desactivarla. */
  currentCategoryId: string | null;
  tree: CategoryNode[];
  onCancel: () => void;
  onConfirm: (categoryId: string | null) => void;
}

/**
 * Selector de carpeta destino para un documento. A diferencia de las carpetas,
 * un documento no tiene estructura debajo: no hay modos ni destinos prohibidos
 * (solo su carpeta actual, que no tiene sentido reelegir).
 */
export function MoveDocumentModal({
  title,
  currentCategoryId,
  tree,
  onCancel,
  onConfirm,
}: MoveDocumentModalProps) {
  // null = nada elegido todavía; { categoryId } = destino elegido.
  const [dest, setDest] = useState<{ categoryId: string | null } | null>(null);

  function renderNodes(nodes: CategoryNode[], depth: number) {
    return nodes.map((node) => {
      const isCurrent = node.id === currentCategoryId;
      const selected = dest?.categoryId === node.id;
      return (
        <div key={node.id}>
          <button
            type="button"
            className={`dest-item${selected ? ' dest-item--selected' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            disabled={isCurrent}
            title={isCurrent ? 'El documento ya está en esta carpeta' : undefined}
            onClick={() => setDest({ categoryId: node.id })}
          >
            {node.name}
            {isCurrent && <small> (actual)</small>}
          </button>
          {node.children.length > 0 && renderNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  const rootIsCurrent = currentCategoryId === null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Mover «{title}» a:</h3>

        <div className="dest-tree">
          <button
            type="button"
            className={`dest-item${dest?.categoryId === null ? ' dest-item--selected' : ''}`}
            disabled={rootIsCurrent}
            title={rootIsCurrent ? 'El documento ya está en la raíz' : undefined}
            onClick={() => setDest({ categoryId: null })}
          >
            Raíz (nivel superior)
            {rootIsCurrent && <small> (actual)</small>}
          </button>
          {renderNodes(tree, 0)}
        </div>

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
                onConfirm(dest.categoryId);
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
