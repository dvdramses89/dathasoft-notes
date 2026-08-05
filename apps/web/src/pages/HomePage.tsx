import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  IconFilePlus,
  IconFileText,
  IconFolderPlus,
  IconFolders,
  IconLayoutCards,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../categories/CategoriesContext';
import { FolderIcon } from '../categories/folderIcons';
import { useDocuments } from '../documents/DocumentsContext';
import { FavoriteStar } from '../favorites/FavoriteStar';
import { useFavorites } from '../favorites/FavoritesContext';
import { useTrash } from '../trash/TrashContext';
import type { CategoryNode, DocumentListItem } from '../lib/api';
import { TagChips } from '../tags/TagChips';
import { DestinationPicker, type Destination } from '../components/DestinationPicker';
import { FolderFormModal, type FolderLook } from '../components/FolderFormModal';

type ViewMode = 'cards' | 'compact' | 'list';

/** Los tres modos de vista, con su icono y su nombre accesible. */
const VIEW_OPTIONS = [
  { value: 'cards' as const, label: 'Vista de tarjetas', Icon: IconLayoutGrid },
  { value: 'compact' as const, label: 'Vista compacta', Icon: IconLayoutCards },
  { value: 'list' as const, label: 'Vista de lista', Icon: IconList },
];

/** Elemento seleccionable: se guarda el tipo porque las acciones difieren. */
type Pick = { kind: 'folder' | 'doc'; id: string };

function keyOfPick(pick: Pick): string {
  return `${pick.kind}:${pick.id}`;
}

/** Fecha corta para las filas y las tarjetas. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function HomePage() {
  const navigate = useNavigate();
  const {
    tree,
    selectedId,
    selectedNode,
    select,
    reload: reloadTree,
    create,
    remove: removeFolder,
    move: moveFolder,
  } = useCategories();
  const {
    byCategory,
    loadFor,
    create: createDoc,
    remove: removeDoc,
    move: moveDoc,
  } = useDocuments();
  const { reload: reloadFavorites } = useFavorites();
  const { reload: reloadTrash } = useTrash();

  const [view, setView] = useLocalStorage<ViewMode>({
    key: 'dtnotes_view_mode',
    defaultValue: 'cards',
  });
  const [picked, setPicked] = useState<Pick[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [bulkMove, setBulkMove] = useState(false);
  const [dest, setDest] = useState<Destination>(undefined);
  const [busy, setBusy] = useState(false);

  // Carpetas y documentos de la ubicación actual.
  const folders: CategoryNode[] = selectedNode ? selectedNode.children : tree;
  const docs: DocumentListItem[] = byCategory[selectedId ?? 'root'] ?? [];
  const title = selectedNode ? selectedNode.name : 'Mi espacio';

  // Al cambiar de carpeta se piden sus documentos (el cache evita repetirlo).
  useEffect(() => {
    void loadFor(selectedId);
  }, [selectedId, loadFor]);

  // Al cambiar de ubicación se limpia la selección: los elementos ya no están.
  useEffect(() => {
    setPicked([]);
  }, [selectedId]);

  const pickedKeys = useMemo(() => new Set(picked.map(keyOfPick)), [picked]);

  function togglePick(pick: Pick) {
    setPicked((prev) =>
      prev.some((p) => p.kind === pick.kind && p.id === pick.id)
        ? prev.filter((p) => !(p.kind === pick.kind && p.id === pick.id))
        : [...prev, pick],
    );
  }

  async function newDocument() {
    setBusy(true);
    try {
      const doc = await createDoc('Documento sin título', selectedId);
      await reloadTree();
      select(null);
      navigate(`/documents/${doc.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitNewFolder(look: FolderLook) {
    setBusy(true);
    try {
      await create(look.name, selectedId, { color: look.color, icon: look.icon });
      setCreatingFolder(false);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Borra en lote. Las carpetas van en modo `subtree` (con todo su contenido):
   * es la única semántica que no deja huérfanos por sorpresa en una acción
   * masiva, y así se advierte en el diálogo.
   */
  async function confirmBulkDelete() {
    setBusy(true);
    try {
      for (const pick of picked) {
        if (pick.kind === 'folder') {
          await removeFolder(pick.id, 'subtree');
        } else {
          await removeDoc(pick.id, selectedId);
        }
      }
      await reloadTree();
      // Lo que se va a la papelera sale de la seccion de favoritos y entra en
      // el contador de la papelera.
      await reloadFavorites();
      await reloadTrash();
      setPicked([]);
      setBulkDelete(false);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkMove() {
    if (dest === undefined) {
      return;
    }
    setBusy(true);
    try {
      for (const pick of picked) {
        if (pick.kind === 'folder') {
          await moveFolder(pick.id, dest, 'subtree');
        } else {
          await moveDoc(pick.id, selectedId, dest);
        }
      }
      await reloadTree();
      if (dest) {
        await loadFor(dest);
      }
      setPicked([]);
      setBulkMove(false);
      setDest(undefined);
    } finally {
      setBusy(false);
    }
  }

  /** IDs que no pueden ser destino: las carpetas que se están moviendo. */
  const bulkDisabledIds = useMemo(
    () => new Set(picked.filter((p) => p.kind === 'folder').map((p) => p.id)),
    [picked],
  );

  const isEmpty = folders.length === 0 && docs.length === 0;

  return (
    <Stack h="100%" gap="md">
      {/* ---------------- Cabecera ---------------- */}
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Menu position="bottom-start" width={210} shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="filled"
                radius="xl"
                size={34}
                aria-label="Crear documento o carpeta"
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Crear en «{title}»</Menu.Label>
              <Menu.Item leftSection={<IconFilePlus size={16} />} onClick={() => void newDocument()}>
                Nuevo documento
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFolderPlus size={16} />}
                onClick={() => setCreatingFolder(true)}
              >
                Nueva carpeta
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Title order={2} fz="1.6rem" lineClamp={1}>
            {title}
          </Title>

          {selectedNode && (
            <Badge variant="light" color="gray" size="sm" tt="none" fw={500}>
              {selectedNode.documentCount}{' '}
              {selectedNode.documentCount === 1 ? 'documento' : 'documentos'}
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
                <Tooltip label="Mover a…">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Mover"
                    onClick={() => setBulkMove(true)}
                  >
                    <IconFolders size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Eliminar">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    aria-label="Eliminar"
                    onClick={() => setBulkDelete(true)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          )}

          <SegmentedControl
            size="xs"
            value={view}
            onChange={(value) => setView(value as ViewMode)}
            data={VIEW_OPTIONS.map(({ value, label, Icon }) => ({
              value,
              // El control es solo iconos: `role`+`aria-label` le dan el nombre
              // accesible que un SVG suelto no aporta.
              label: (
                <Tooltip label={label}>
                  <span role="img" aria-label={label}>
                    <Icon size={15} />
                  </span>
                </Tooltip>
              ),
            }))}
          />
        </Group>
      </Group>

      {/* ---------------- Contenido ---------------- */}
      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        {isEmpty ? (
          <Stack align="center" gap="xs" py="4rem">
            <IconFolders size={36} stroke={1.3} opacity={0.35} />
            <Text c="dimmed" size="sm">
              {selectedNode ? 'Esta carpeta está vacía.' : 'Aún no hay nada aquí.'}
            </Text>
            <Group gap="xs" mt="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconFilePlus size={15} />}
                loading={busy}
                onClick={() => void newDocument()}
              >
                Nuevo documento
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconFolderPlus size={15} />}
                onClick={() => setCreatingFolder(true)}
              >
                Nueva carpeta
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="lg">
            {folders.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Carpetas
                </Text>
                <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 4, xl: 5 }} spacing="sm">
                  {folders.map((folder) => {
                    const isPicked = pickedKeys.has(`folder:${folder.id}`);
                    return (
                      <Card
                        key={folder.id}
                        p="md"
                        className={`folder-card${isPicked ? ' folder-card--selected' : ''}`}
                        onClick={() => select(folder.id)}
                      >
                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                          <FolderIcon icon={folder.icon} color={folder.color} size={26} stroke={1.5} />
                          <Checkbox
                            size="xs"
                            radius="xl"
                            checked={isPicked}
                            aria-label={`Seleccionar ${folder.name}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => togglePick({ kind: 'folder', id: folder.id })}
                          />
                        </Group>
                        <Text fw={600} size="sm" mt="sm" lineClamp={2}>
                          {folder.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {folder.documentCount}{' '}
                          {folder.documentCount === 1 ? 'documento' : 'documentos'}
                          {folder.children.length > 0 && ` · ${folder.children.length} subcarpetas`}
                        </Text>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            )}

            {docs.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Documentos
                </Text>

                {view === 'list' ? (
                  <Paper withBorder radius="md" p={4}>
                    {docs.map((doc) => (
                      <Box
                        key={doc.id}
                        className="row-item"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <Checkbox
                          size="xs"
                          radius="xl"
                          checked={pickedKeys.has(`doc:${doc.id}`)}
                          aria-label={`Seleccionar ${doc.title}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => togglePick({ kind: 'doc', id: doc.id })}
                        />
                        <IconFileText size={17} stroke={1.6} opacity={0.7} />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {doc.title}
                          </Text>
                          {doc.excerpt && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {doc.excerpt}
                            </Text>
                          )}
                        </Box>
                        <Box style={{ flex: 'none' }} visibleFrom="sm">
                          <TagChips tags={doc.tags} max={2} />
                        </Box>
                        <Text size="xs" c="dimmed" style={{ flex: 'none' }} visibleFrom="xs">
                          {formatDate(doc.updatedAt)}
                        </Text>
                        <Box style={{ flex: 'none' }}>
                          <FavoriteStar
                            documentId={doc.id}
                            fallback={doc.isFavorite}
                            size="sm"
                            iconSize={15}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Paper>
                ) : (
                  <SimpleGrid
                    cols={
                      view === 'cards'
                        ? { base: 1, xs: 2, md: 3, xl: 4 }
                        : { base: 1, xs: 2, sm: 3, lg: 4, xl: 5 }
                    }
                    spacing="sm"
                  >
                    {docs.map((doc) => {
                      const isPicked = pickedKeys.has(`doc:${doc.id}`);
                      return (
                        <Card
                          key={doc.id}
                          p="md"
                          className={`folder-card${isPicked ? ' folder-card--selected' : ''}`}
                          onClick={() => navigate(`/documents/${doc.id}`)}
                        >
                          <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
                            <Text fw={600} size="sm" lineClamp={2}>
                              {doc.title}
                            </Text>
                            {/* La estrella va junto al checkbox: la esquina de
                                la tarjeta ya era la zona de sus controles. */}
                            <Group gap={2} wrap="nowrap" style={{ flex: 'none' }}>
                              <FavoriteStar
                                documentId={doc.id}
                                fallback={doc.isFavorite}
                                size="sm"
                                iconSize={15}
                              />
                              <Checkbox
                                size="xs"
                                radius="xl"
                                checked={isPicked}
                                aria-label={`Seleccionar ${doc.title}`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => togglePick({ kind: 'doc', id: doc.id })}
                              />
                            </Group>
                          </Group>
                          <Text size="xs" c="dimmed" mt={2}>
                            {formatDate(doc.updatedAt)}
                          </Text>
                          {view === 'cards' && doc.excerpt && (
                            <Box className="card-preview" mt="sm">
                              {doc.excerpt}
                            </Box>
                          )}
                          {doc.tags.length > 0 && (
                            <Box mt="sm">
                              <TagChips tags={doc.tags} max={view === 'cards' ? 3 : 2} />
                            </Box>
                          )}
                        </Card>
                      );
                    })}
                  </SimpleGrid>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </ScrollArea>

      {/* ---------------- Diálogos ---------------- */}

      {creatingFolder && (
        <FolderFormModal
          opened
          title="Crear nueva carpeta"
          submitLabel="Crear"
          parentName={title}
          busy={busy}
          onClose={() => setCreatingFolder(false)}
          onSubmit={(look) => void submitNewFolder(look)}
        />
      )}

      <Modal
        opened={bulkDelete}
        onClose={() => setBulkDelete(false)}
        title={`Eliminar ${picked.length} elemento${picked.length > 1 ? 's' : ''}`}
      >
        <Stack gap="md">
          <Text size="sm">
            Se enviarán a la papelera. Las carpetas se eliminan{' '}
            <strong>con todo su contenido</strong>.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setBulkDelete(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button color="red" loading={busy} onClick={() => void confirmBulkDelete()}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={bulkMove}
        onClose={() => setBulkMove(false)}
        title={`Mover ${picked.length} elemento${picked.length > 1 ? 's' : ''} a…`}
      >
        <Stack gap="md">
          <DestinationPicker
            tree={tree}
            value={dest}
            onChange={setDest}
            disabledIds={bulkDisabledIds}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setBulkMove(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              disabled={dest === undefined}
              onClick={() => void confirmBulkMove()}
            >
              Mover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
