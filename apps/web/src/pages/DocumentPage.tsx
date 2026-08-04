import type { Block, PartialBlock } from '@blocknote/core';
import { Badge, Box, Center, Group, Loader, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentEditor } from '../documents/DocumentEditor';
import { useDocuments } from '../documents/DocumentsContext';
import { TagPicker } from '../tags/TagPicker';
import { getDocument, toListItem, updateDocument, type DocumentFull, type Tag } from '../lib/api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') {
    return null;
  }
  const props =
    state === 'saving'
      ? { color: 'gray', text: 'Guardando…' }
      : state === 'saved'
        ? { color: 'teal', text: 'Guardado' }
        : { color: 'red', text: 'Error al guardar' };
  // `tt="none"` porque el Badge de Mantine pone el texto en mayusculas por
  // defecto, y un aviso de autoguardado no debe gritar.
  return (
    <Badge variant="light" color={props.color} size="sm" radius="sm" tt="none" fw={500}>
      {props.text}
    </Badge>
  );
}

/** El contenido guardado es un array de bloques de BlockNote (o algo vacío). */
function asBlocks(contentJson: unknown): PartialBlock[] | undefined {
  return Array.isArray(contentJson) && contentJson.length > 0
    ? (contentJson as PartialBlock[])
    : undefined;
}

export function DocumentPage() {
  const { id } = useParams();
  const { patchLocal, byCategory, setCurrent } = useDocuments();
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
          // Publica el documento abierto para las migas de pan del header.
          setCurrent(toListItem(data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDoc(null);
          setNotFound(true);
          setCurrent(null);
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
  }, [id, setCurrent]);

  // Al salir de la página, las migas dejan de mostrar este documento.
  useEffect(() => {
    return () => setCurrent(null);
  }, [setCurrent]);

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

  /**
   * Refleja el cambio de tags que ya ha guardado el TagPicker. Pasa por
   * `patchLocal` para que los chips del listado y las migas no se queden viejos.
   */
  const applyTags = useCallback(
    (tags: Tag[]) => {
      if (!doc) {
        return;
      }
      const updated = { ...doc, tags };
      setDoc(updated);
      patchLocal(updated);
    },
    [doc, patchLocal],
  );

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
      <Center h="100%">
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Cargando documento…
          </Text>
        </Group>
      </Center>
    );
  }

  if (notFound || !doc) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconAlertTriangle size={34} stroke={1.3} opacity={0.4} />
          <Title order={3}>Documento no encontrado</Title>
          <Text size="sm" c="dimmed" ta="center" maw={420}>
            Puede que se haya movido a la papelera o que el enlace no sea válido.
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <ScrollArea h="100%" type="auto">
      {/* La hoja: ancho de lectura y centrada, como una pagina. */}
      <Box className="doc-surface" maw={860} mx="auto" p={{ base: 'md', sm: 'xl' }}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" mb="md">
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
          <Box style={{ flex: 'none' }}>
            <SaveIndicator state={saveState} />
          </Box>
        </Group>

        {/* Los tags van entre el titulo y el editor: se ven al abrir el
            documento, pero no compiten con la barra de formato. */}
        <Box mb="lg">
          <TagPicker documentId={doc.id} tags={doc.tags} onChange={applyTags} />
        </Box>

        {/* La key remonta el editor al cambiar de documento: el contenido inicial
            de BlockNote se fija al crearlo y no es reactivo. */}
        <DocumentEditor
          key={doc.id}
          initialContent={asBlocks(doc.contentJson)}
          onSave={saveContent}
        />
      </Box>
    </ScrollArea>
  );
}
