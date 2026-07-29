import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDocuments } from '../documents/DocumentsContext';
import { getDocument, updateDocument, type DocumentFull } from '../lib/api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') {
    return null;
  }
  const text =
    state === 'saving' ? 'Guardando…' : state === 'saved' ? 'Guardado' : 'Error al guardar';
  return <span className={`save-indicator save-indicator--${state}`}>{text}</span>;
}

export function DocumentPage() {
  const { id } = useParams();
  const { patchLocal } = useDocuments();
  const [doc, setDoc] = useState<DocumentFull | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Carga del documento al abrirlo (o al cambiar de documento).
  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setSaveState('idle');
    getDocument(id)
      .then((data) => {
        if (!cancelled) {
          setDoc(data);
          setTitle(data.title);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDoc(null);
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Guarda el título si ha cambiado (al salir del campo o con Enter). */
  const saveTitle = useCallback(async () => {
    if (!doc) {
      return;
    }
    const clean = title.trim();
    if (!clean || clean === doc.title) {
      setTitle(doc.title);
      return;
    }
    setSaveState('saving');
    try {
      const updated = await updateDocument(doc.id, { title: clean });
      setDoc(updated);
      setTitle(updated.title);
      patchLocal(updated);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [doc, title, patchLocal]);

  if (loading) {
    return (
      <div className="content-inner">
        <p className="content-subtitle">Cargando documento…</p>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="content-inner">
        <div className="content-empty">
          <h1 className="content-title">Documento no encontrado</h1>
          <p className="content-subtitle">
            Puede que se haya movido a la papelera o que el enlace no sea válido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-inner">
      <div className="doc-header">
        <input
          className="doc-title-input"
          value={title}
          placeholder="Documento sin título"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setTitle(doc.title);
              e.currentTarget.blur();
            }
          }}
        />
        <SaveIndicator state={saveState} />
      </div>

      {/* Provisional: el editor BlockNote llega en la siguiente subtarea (4.2.b). */}
      <div className="doc-editor-placeholder">
        <p className="content-subtitle">
          El editor enriquecido (BlockNote) se añade en el siguiente paso. Por ahora se muestra el
          contenido guardado en texto plano.
        </p>
        <pre className="doc-content-preview">{doc.contentText || '(documento vacío)'}</pre>
      </div>
    </div>
  );
}
