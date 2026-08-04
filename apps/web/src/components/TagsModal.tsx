import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  ColorSwatch,
  Group,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconPalette, IconPencil, IconTag, IconTrash, IconX } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { ApiError, type TagWithCount } from '../lib/api';
import { useTags } from '../tags/TagsContext';
import { FOLDER_COLORS } from '../theme';

/** Color con el que se pinta un tag que no tiene color propio. */
const NO_COLOR = 'gray';

interface TagsModalProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Gestion de los tags del usuario: crear, renombrar, cambiar de color y
 * eliminar, con el numero de documentos que usa cada uno.
 *
 * Eliminar un tag lo quita de todos sus documentos (cascade en la BD). Los
 * chips ya pintados se resuelven contra el catalogo, asi que desaparecen sin
 * tener que recargar los listados.
 */
export function TagsModal({ opened, onClose }: TagsModalProps) {
  const { tags, create, update, remove } = useTags();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tag en edicion de nombre, y el texto que se esta escribiendo.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirming, setConfirming] = useState<TagWithCount | null>(null);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      return;
    }
    if (await run(() => create(clean), 'No se pudo crear la etiqueta')) {
      setName('');
    }
  }

  async function submitRename(tag: TagWithCount) {
    const clean = editingName.trim();
    if (!clean || clean === tag.name) {
      setEditingId(null);
      return;
    }
    if (await run(() => update(tag.id, { name: clean }), 'No se pudo renombrar la etiqueta')) {
      setEditingId(null);
    }
  }

  async function confirmDelete() {
    if (!confirming) {
      return;
    }
    if (await run(() => remove(confirming.id), 'No se pudo eliminar la etiqueta')) {
      setConfirming(null);
    }
  }

  return (
    <>
      <Modal opened={opened} onClose={onClose} title="Etiquetas" size="md">
        <Stack gap="md">
          <form onSubmit={(e) => void submitNew(e)}>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                label="Nueva etiqueta"
                placeholder="Nombre"
                data-autofocus
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <Button type="submit" loading={busy} disabled={name.trim() === ''}>
                Crear
              </Button>
            </Group>
          </form>

          {error && (
            <Alert color="red" variant="light" p="xs">
              <Text size="sm">{error}</Text>
            </Alert>
          )}

          {tags.length === 0 ? (
            <Stack align="center" gap={6} py="xl">
              <IconTag size={30} stroke={1.3} opacity={0.35} />
              <Text size="sm" c="dimmed">
                Aún no tienes etiquetas.
              </Text>
              <Text size="xs" c="dimmed" ta="center" maw={320}>
                También puedes crearlas escribiendo directamente en un documento.
              </Text>
            </Stack>
          ) : (
            <ScrollArea.Autosize mah={340} type="auto">
              <Stack gap={2}>
                {tags.map((tag) => (
                  <Group key={tag.id} className="row-item" gap="xs" wrap="nowrap">
                    {editingId === tag.id ? (
                      <>
                        <TextInput
                          style={{ flex: 1 }}
                          size="xs"
                          autoFocus
                          maxLength={50}
                          value={editingName}
                          onChange={(e) => setEditingName(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void submitRename(tag);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                        />
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          aria-label="Guardar el nombre"
                          onClick={() => void submitRename(tag)}
                        >
                          <IconCheck size={15} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label="Cancelar"
                          onClick={() => setEditingId(null)}
                        >
                          <IconX size={15} />
                        </ActionIcon>
                      </>
                    ) : (
                      <>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            variant="light"
                            color={tag.color ?? NO_COLOR}
                            radius="sm"
                            tt="none"
                            fw={500}
                            size="sm"
                          >
                            {tag.name}
                          </Badge>
                        </Box>
                        <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
                          {tag.documentCount} {tag.documentCount === 1 ? 'documento' : 'documentos'}
                        </Text>

                        <Menu position="bottom-end" shadow="md" width={190}>
                          <Menu.Target>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              aria-label={`Color de ${tag.name}`}
                            >
                              <IconPalette size={15} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Color</Menu.Label>
                            <Group gap={6} p="xs" pt={0}>
                              {FOLDER_COLORS.map((color) => (
                                <Tooltip key={color} label={color} openDelay={300}>
                                  <ColorSwatch
                                    component="button"
                                    type="button"
                                    size={18}
                                    color={`var(--mantine-color-${color}-filled)`}
                                    aria-label={`Color ${color}`}
                                    aria-pressed={(tag.color ?? NO_COLOR) === color}
                                    onClick={() =>
                                      void run(
                                        () => update(tag.id, { color }),
                                        'No se pudo cambiar el color',
                                      )
                                    }
                                    style={{
                                      cursor: 'pointer',
                                      outline:
                                        (tag.color ?? NO_COLOR) === color
                                          ? '2px solid var(--mantine-color-text)'
                                          : '2px solid transparent',
                                      outlineOffset: 2,
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Group>
                          </Menu.Dropdown>
                        </Menu>

                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label={`Renombrar ${tag.name}`}
                          onClick={() => {
                            setEditingId(tag.id);
                            setEditingName(tag.name);
                          }}
                        >
                          <IconPencil size={15} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          aria-label={`Eliminar ${tag.name}`}
                          onClick={() => setConfirming(tag)}
                        >
                          <IconTrash size={15} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`Eliminar «${confirming?.name ?? ''}»`}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            La etiqueta se eliminará y dejará de estar en{' '}
            <strong>
              {confirming?.documentCount ?? 0}{' '}
              {confirming?.documentCount === 1 ? 'documento' : 'documentos'}
            </strong>
            . Los documentos no se tocan.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirming(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button color="red" loading={busy} onClick={() => void confirmDelete()}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
