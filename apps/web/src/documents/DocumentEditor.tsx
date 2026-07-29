import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';

import { BlockNoteView } from '@blocknote/ariakit';
import { BlockNoteSchema, defaultBlockSpecs, type Block, type PartialBlock } from '@blocknote/core';
import { es } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { useCallback, useEffect, useRef } from 'react';
import { codeBlockSpec } from './codeBlock';

/**
 * Esquema por defecto, sustituyendo el bloque de codigo por el nuestro:
 * mismo bloque pero con resaltado de sintaxis multi-lenguaje (shiki).
 */
const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, codeBlock: codeBlockSpec },
});

/** Milisegundos de inactividad antes de guardar automaticamente. */
const AUTOSAVE_DELAY = 900;

/**
 * Texto plano derivado del contenido, para el buscador full-text de Postgres
 * (columna generada `searchVector` a partir de `contentText`).
 */
function extractText(blocks: Block[]): string {
  const lines: string[] = [];

  const fromInline = (content: unknown): string => {
    if (!Array.isArray(content)) {
      return '';
    }
    return content
      .map((item) => {
        const node = item as { type?: string; text?: string; content?: unknown };
        if (node.type === 'text') {
          return node.text ?? '';
        }
        // Enlaces y otros nodos con contenido anidado.
        return fromInline(node.content);
      })
      .join('');
  };

  const walk = (list: Block[]): void => {
    for (const block of list) {
      const text = fromInline(block.content);
      if (text.trim()) {
        lines.push(text);
      }
      if (block.children?.length) {
        walk(block.children);
      }
    }
  };

  walk(blocks);
  return lines.join('\n');
}

interface DocumentEditorProps {
  /** Contenido guardado del documento (bloques de BlockNote). */
  initialContent: PartialBlock[] | undefined;
  /** Persiste el contenido; se llama tras una pausa al escribir. */
  onSave: (contentJson: Block[], contentText: string) => void;
}

export function DocumentEditor({ initialContent, onSave }: DocumentEditorProps) {
  const editor = useCreateBlockNote({
    schema,
    // Menus y etiquetas del editor en espanol.
    dictionary: es,
    // Un documento vacio necesita al menos un bloque para que el editor arranque.
    initialContent: initialContent?.length ? initialContent : undefined,
  });

  const timer = useRef<number | null>(null);
  // Se guarda en una ref para que el debounce use siempre el callback actual
  // sin necesidad de reprogramarlo en cada render.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const blocks = editor.document;
    onSaveRef.current(blocks, extractText(blocks));
  }, [editor]);

  // Al desmontar (cambio de documento, navegacion) se guarda lo pendiente.
  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        const blocks = editor.document;
        onSaveRef.current(blocks, extractText(blocks));
      }
    };
  }, [editor]);

  function handleChange() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(flush, AUTOSAVE_DELAY);
  }

  return (
    <div className="doc-editor">
      <BlockNoteView editor={editor} theme="dark" onChange={handleChange} onBlur={flush} />
    </div>
  );
}
