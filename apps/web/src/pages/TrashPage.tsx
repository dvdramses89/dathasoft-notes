import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArrowBackUp, IconFileText, IconTrash, IconTrashX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useCategories } from '../categories/CategoriesContext';
import { FolderIcon } from '../categories/folderIcons';
import { useDocuments } from '../documents/DocumentsContext';
import { useFavorites } from '../favorites/FavoritesContext';
import { ApiError, type TrashSelection } from '../lib/api';
import { useTrash } from '../trash/TrashContext';

/** Elemento marcado: el tipo importa porque van en listas distintas. */
type Pick = { kind: 'folder' | 'doc'; id: string };

/** Diálogo de confirmación pendiente. */
type Confirm =
  | { kind: 'empty' }
  | { kind: 'purge'; selection: TrashSelection; count: number };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** «2 subcarpetas · 7 documentos», omitiendo lo que sea cero. */
function describeContains(contains: { categories: number; documents: number }): string | null {
  const partes: string[] = [];
  if (contains.categories > 0) {
    partes.push(`${contains.categories} ${contains.categories === 1 ? 'subcarpeta' : 'subcarpetas'}`);
  }
  if (contains.documents > 0) {
    partes.push(`${contains.documents} ${contains.documents === 1 ? 'documento' : 'documentos'}`);
  }
  return partes.length > 0 ? partes.join(' · ') : null;
}

export function TrashPage() {
  const { categories, documents, count, retentionDays, loaded, restore, purge, empty } = useTrash();
  const { reload: reloadTree } = useCategories();
  const { refresh: refreshDocs } = useDocuments();
  const { reload: reloadFavorites } = useFavorites();

  const [picked, setPicked] = useState<Pick[]>([]);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickedKeys = useMemo(() => new Set(picked.map((p) => `${p.kind}:${p.id}`)), [picked]);

  function togglePick(pick: Pick) {
    setPicked((prev) =>
      prev.some((p) => p.kind === pick.kind && p.id === pick.id)
        ? prev.filter((p) => !(p.kind === pick.kind && p.id === pick.id))
        : [...prev, pick],
    );
  }

  /** Convierte la selección de pantalla en lo que espera la API. */
  function selectionOf(picks: Pick[]): TrashSelection {
    return {
      documentIds: picks.filter((p) => p.kind === 'doc').map((p) => p.id),
      categoryIds: picks.filter((p) => p.kind === 'folder').map((p) => p.id),
    };
  }

  /**
   * Todo lo que sale de aquí cambia el árbol y los listados, así que hay que
   * refrescar los tres contextos: restaurar devuelve carpetas y documentos, y
   * borrar definitivamente puede dejar documentos sueltos en la raíz.
   */
  async function refreshEverything() {
    await reloadTree();
    await refreshDocs(null);
    await reloadFavorites();
  }

  async function run(action: () => Promise<number>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refreshEverything();
      setPicked([]);
      setConfirm(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la operación');
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = count === 0;

  return (
    <Stack h="100%" gap="md">
      {/* ---------------- Cabecera ---------------- */}
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconTrash size={22} stroke={1.7} opacity={0.5} />
          <Title order={2} fz="1.6rem" lineClamp={1}>
            Papelera
          </Title>
          {loaded && !isEmpty && (
            <Badge variant="light" color="gray" size="sm" tt="none" fw={500}>
              {count} {count === 1 ? 'elemento' : 'elementos'}
            </Badge>
          )}
        </Group>

        <Group gap="xs" wrap="nowrap">
          {picked.length > 0 && (
            <Paper withBorder radius="xl" px="xs" py={4}>
              <Group gap={6} wrap="nowrap">
                <Text size="sm" c="dimmed">
                  {picked.length} seleccionado{picked.length > 1 ? 's' : ''}
                </Text>
                <Tooltip label="Restaurar">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Restaurar la selección"
                    onClick={() => void run(() => restore(selectionOf(picked)))}
                  >
                    <IconArrowBackUp size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Eliminar definitivamente">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    aria-label="Eliminar definitivamente la selección"
                    onClick={() =>
                      setConfirm({
                        kind: 'purge',
                        selection: selectionOf(picked),
                        count: picked.length,
                      })
                    }
                  >
                    <IconTrashX size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          )}

          {!isEmpty && (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconTrashX size={15} />}
              onClick={() => setConfirm({ kind: 'empty' })}
            >
              Vaciar papelera
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      {/* ---------------- Contenido ---------------- */}
      {!loaded ? (
        <Center h="100%">
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Cargando la papelera…
            </Text>
          </Group>
        </Center>
      ) : isEmpty ? (
        <Stack align="center" gap="xs" py="4rem">
          <IconTrash size={36} stroke={1.3} opacity={0.35} />
          <Text c="dimmed" size="sm">
            La papelera está vacía.
          </Text>
          <Text c="dimmed" size="xs" ta="center" maw={460}>
            Lo que elimines aparecerá aquí y podrás restaurarlo.
          </Text>
        </Stack>
      ) : (
        <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
          <Stack gap="lg">
            <Text size="xs" c="dimmed">
              Lo que lleve más de {retentionDays} días en la papelera se elimina automáticamente.
              Al restaurar una carpeta vuelve con todo lo que se eliminó con ella; si su carpeta
              original ya no existe, aparecerá en «Mi espacio».
            </Text>

            {categories.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Carpetas
                </Text>
                <Paper withBorder radius="md" p={4}>
                  {categories.map((cat) => {
                    const contains = describeContains(cat.contains);
                    return (
                      <Box key={cat.id} className="row-item">
                        <Checkbox
                          size="xs"
                          radius="xl"
                          checked={pickedKeys.has(`folder:${cat.id}`)}
                          aria-label={`Seleccionar ${cat.name}`}
                          onChange={() => togglePick({ kind: 'folder', id: cat.id })}
                        />
                        <FolderIcon icon={cat.icon} color={cat.color} size={18} />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {cat.name}
                          </Text>
                          {contains && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              Contiene {contains}
                            </Text>
                          )}
                        </Box>
                        <Text size="xs" c="dimmed" style={{ flex: 'none' }} visibleFrom="xs">
                          {formatDate(cat.deletedAt)}
                        </Text>
                        <Group gap={2} wrap="nowrap" style={{ flex: 'none' }}>
                          <Tooltip label="Restaurar">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              aria-label={`Restaurar ${cat.name}`}
                              onClick={() => void run(() => restore({ categoryIds: [cat.id] }))}
                            >
                              <IconArrowBackUp size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Eliminar definitivamente">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              aria-label={`Eliminar definitivamente ${cat.name}`}
                              onClick={() =>
                                setConfirm({
                                  kind: 'purge',
                                  selection: { categoryIds: [cat.id] },
                                  count: 1,
                                })
                              }
                            >
                              <IconTrashX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Box>
                    );
                  })}
                </Paper>
              </Stack>
            )}

            {documents.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Documentos
                </Text>
                <Paper withBorder radius="md" p={4}>
                  {documents.map((doc) => (
                    <Box key={doc.id} className="row-item">
                      <Checkbox
                        size="xs"
                        radius="xl"
                        checked={pickedKeys.has(`doc:${doc.id}`)}
                        aria-label={`Seleccionar ${doc.title}`}
                        onChange={() => togglePick({ kind: 'doc', id: doc.id })}
                      />
                      <IconFileText size={17} stroke={1.6} opacity={0.7} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {doc.title}
                        </Text>
                      </Box>
                      <Text size="xs" c="dimmed" style={{ flex: 'none' }} visibleFrom="xs">
                        {formatDate(doc.deletedAt)}
                      </Text>
                      <Group gap={2} wrap="nowrap" style={{ flex: 'none' }}>
                        <Tooltip label="Restaurar">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            aria-label={`Restaurar ${doc.title}`}
                            onClick={() => void run(() => restore({ documentIds: [doc.id] }))}
                          >
                            <IconArrowBackUp size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Eliminar definitivamente">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            aria-label={`Eliminar definitivamente ${doc.title}`}
                            onClick={() =>
                              setConfirm({
                                kind: 'purge',
                                selection: { documentIds: [doc.id] },
                                count: 1,
                              })
                            }
                          >
                            <IconTrashX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Box>
                  ))}
                </Paper>
              </Stack>
            )}
          </Stack>
        </ScrollArea>
      )}

      {/* ---------------- Confirmaciones ---------------- */}
      <Modal
        opened={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'empty' ? 'Vaciar la papelera' : 'Eliminar definitivamente'}
      >
        <Stack gap="md">
          <Text size="sm">
            {confirm?.kind === 'empty'
              ? 'Se eliminará definitivamente todo lo que hay en la papelera.'
              : `Se eliminará definitivamente ${
                  confirm?.count === 1 ? 'este elemento' : `${confirm?.count} elementos`
                }. Las carpetas se llevan todo lo que contienen.`}{' '}
            <strong>Esta acción no se puede deshacer.</strong>
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirm(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={busy}
              onClick={() =>
                void run(() =>
                  confirm?.kind === 'empty'
                    ? empty()
                    : purge(confirm?.selection ?? {}),
                )
              }
            >
              Eliminar definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
