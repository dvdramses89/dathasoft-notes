import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { BlockNoteSchema, defaultBlockSpecs, type Block, type PartialBlock } from '@blocknote/core';
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { es } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote } from '@blocknote/react';
import { useComputedColorScheme } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import { useCallback, useEffect, useRef } from 'react';
import { codeBlockSpec } from './codeBlock';
import { webLinkBlockSpec } from './webLinkBlock';

/**
 * Esquema por defecto, sustituyendo el bloque de codigo por el nuestro:
 * mismo bloque pero con resaltado de sintaxis multi-lenguaje (shiki).
 */
const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, codeBlock: codeBlockSpec, webLink: webLinkBlockSpec },
});

/** Milisegundos de inactividad antes de guardar automaticamente. */
const AUTOSAVE_DELAY = 900;

/**
 * Texto plano derivado del contenido, para el buscador full-text de Postgres
 * (columna generada `searchVector` a partir de `contentText`).
 * Acepta unknown[] para ser compatible con el schema extendido (que incluye
 * bloques custom como webLink no presentes en DefaultBlockSchema).
 */
function extractText(blocks: readonly unknown[]): string {
  const lines: string[] = [];

  type RawBlock = {
    type: string;
    content: unknown;
    children?: readonly unknown[];
    props: Record<string, unknown>;
  };

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

  const walk = (list: readonly unknown[]): void => {
    for (const raw of list) {
      const block = raw as RawBlock;
      // Bloques custom sin contenido de texto: se extraen sus props directamente.
      if (block.type === 'webLink') {
        const url = String(block.props.url ?? '');
        const caption = String(block.props.caption ?? '');
        const text = [caption, url].filter(Boolean).join(' ');
        if (text.trim()) lines.push(text);
      } else {
        const text = fromInline(block.content);
        if (text.trim()) {
          lines.push(text);
        }
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
  // El editor sigue el tema de la app: la variante Mantine acepta el mismo
  // valor que resuelve `useComputedColorScheme`, asi que el cambio es inmediato.
  const colorScheme = useComputedColorScheme('light');
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
    // El schema incluye tipos custom; se castea porque updateDocument acepta
    // contentJson: unknown y el receptor (DocumentPage) no inspecciona el tipo.
    onSaveRef.current(blocks as unknown as Block[], extractText(blocks));
  }, [editor]);

  // Al desmontar (cambio de documento, navegacion) se guarda lo pendiente.
  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        const blocks = editor.document;
        onSaveRef.current(blocks as unknown as Block[], extractText(blocks));
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
      <BlockNoteView editor={editor} theme={colorScheme} onChange={handleChange} onBlur={flush} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const defaults = getDefaultReactSlashMenuItems(editor);
            const webLinkItem = {
              title: 'Enlace web',
              subtext: 'Referencia a una URL externa',
              aliases: ['web', 'link', 'url', 'enlace', 'referencia'],
              group: 'Referencias',
              icon: <IconWorld size={18} />,
              onItemClick: () => {
                // La misma funcion que usan los items por defecto de BlockNote:
                // reutiliza el bloque actual si esta vacio (o solo tiene "/"), y si
                // ya tiene texto inserta debajo en vez de borrarlo.
                insertOrUpdateBlockForSlashMenu(editor, { type: 'webLink' });
              },
            };
            const all = [...defaults, webLinkItem];
            if (!query) return all;
            const q = query.toLowerCase();
            return all.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                (item.aliases as readonly string[] | undefined)?.some((a) => a.toLowerCase().includes(q)),
            );
          }}
        />
      </BlockNoteView>
    </div>
  );
}
