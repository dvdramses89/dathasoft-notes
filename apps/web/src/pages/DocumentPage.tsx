import type { Block, PartialBlock } from '@blocknote/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentEditor } from '../documents/DocumentEditor';
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

/** El contenido guardado es un array de bloques de BlockNote (o algo vacío). */
function asBlocks(contentJson: unknown): PartialBlock[] | undefined {
  return Array.isArray(contentJson) && contentJson.length > 0
    ? (contentJson as PartialBlock[])
    : undefined;
}

export function DocumentPage() {
  const { id } = useParams();
  const { patchLocal, byCategory } = useDocuments();
  const [doc, setDoc] = useState<DocumentFull | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Id del documento en pantalla, para que un guardado tardío no escriba en otro.
  const currentId = useRef<string | undefined>(undefined);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Carga del documento al abrirlo (o al cambiar de documento).
  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    currentId.current = id;
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

  // Si el documento abierto se renombra desde el sidebar, el título de la
  // página lo sigue (salvo mientras se está editando aquí).
  const listedTitle = doc
    ? Object.values(byCategory)
        .flat()
        .find((d) => d.id === doc.id)?.title
    : undefined;
  useEffect(() => {
    if (doc && listedTitle && listedTitle !== doc.title) {
      setDoc((prev) => (prev ? { ...prev, title: listedTitle } : prev));
      // No se pisa el campo si el usuario está escribiendo en él ahora mismo.
      if (document.activeElement !== titleRef.current) {
        setTitle(listedTitle);
      }
    }
  }, [listedTitle, doc]);

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

  /** Guarda el contenido del editor (autoguardado con pausa al escribir). */
  const saveContent = useCallback(
    (contentJson: Block[], contentText: string) => {
      const docId = currentId.current;
      if (!docId) {
        return;
      }
      setSaveState('saving');
      updateDocument(docId, { contentJson, contentText })
        .then(() => {
          // Si mientras se guardaba se abrió otro documento, no tocamos su estado.
          if (currentId.current === docId) {
            setSaveState('saved');
          }
        })
        .catch(() => {
          if (currentId.current === docId) {
            setSaveState('error');
          }
        });
    },
    [],
  );

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
          ref={titleRef}
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

      {/* La key remonta el editor al cambiar de documento: el contenido inicial
          de BlockNote se fija al crearlo y no es reactivo. */}
      <DocumentEditor
        key={doc.id}
        initialContent={asBlocks(doc.contentJson)}
        onSave={saveContent}
      />
    </div>
  );
}
