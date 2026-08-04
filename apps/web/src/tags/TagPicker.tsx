import { ActionIcon, Autocomplete, Badge, CloseButton, Group, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconTag } from '@tabler/icons-react';
import { useState, type KeyboardEvent } from 'react';
import { ApiError, type Tag } from '../lib/api';
import { useTags } from './TagsContext';

interface TagPickerProps {
  documentId: string;
  /** Tags actuales del documento; el padre los actualiza con `onChange`. */
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
}

/** Color de un tag sin color propio. */
const NO_COLOR = 'gray';

/**
 * Los tags del documento abierto, con quitar y anadir. Anadir es por NOMBRE: el
 * campo autocompleta con los tags que ya tienes, pero acepta uno nuevo — la API
 * lo crea sola (get-or-create), asi que no hay que crearlo antes en ningun sitio.
 */
export function TagPicker({ documentId, tags, onChange }: TagPickerProps) {
  const { tags: catalog, resolve, attach, detach } = useTags();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = resolve(tags);
  const currentNames = new Set(current.map((tag) => tag.name.toLowerCase()));
  // En el desplegable solo tiene sentido lo que el documento aun no lleva.
  const options = catalog
    .filter((tag) => !currentNames.has(tag.name.toLowerCase()))
    .map((tag) => tag.name);

  function closeField() {
    setAdding(false);
    setValue('');
    setError(null);
  }

  async function submit(name: string) {
    const clean = name.trim();
    if (!clean) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // La API es idempotente, asi que repetir un nombre ya puesto no molesta.
      onChange(await attach(documentId, clean));
      setValue('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo añadir la etiqueta');
    } finally {
      setBusy(false);
    }
  }

  async function remove(tagId: string) {
    setError(null);
    try {
      await detach(documentId, tagId);
      onChange(tags.filter((tag) => tag.id !== tagId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la etiqueta');
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit(value);
    } else if (event.key === 'Escape') {
      closeField();
    }
  }

  return (
    <Group gap={6} wrap="wrap" align="center">
      {current.length === 0 && !adding && (
        <IconTag size={15} stroke={1.7} opacity={0.4} aria-hidden />
      )}

      {current.map((tag) => (
        <Badge
          key={tag.id}
          size="sm"
          variant="light"
          color={tag.color ?? NO_COLOR}
          radius="sm"
          tt="none"
          fw={500}
          pr={3}
          rightSection={
            <CloseButton
              size={14}
              radius="sm"
              variant="transparent"
              c="inherit"
              aria-label={`Quitar la etiqueta ${tag.name}`}
              onClick={() => void remove(tag.id)}
            />
          }
        >
          {tag.name}
        </Badge>
      ))}

      {adding ? (
        <Autocomplete
          data={options}
          value={value}
          onChange={setValue}
          onOptionSubmit={(name) => void submit(name)}
          onKeyDown={onKeyDown}
          onBlur={() => !value && closeField()}
          disabled={busy}
          data-autofocus
          autoFocus
          size="xs"
          w={190}
          radius="sm"
          placeholder="Etiqueta y Enter…"
          aria-label="Añadir una etiqueta"
          comboboxProps={{ withinPortal: false }}
        />
      ) : (
        <Tooltip label="Añadir etiqueta">
          <ActionIcon
            size="sm"
            radius="sm"
            variant="subtle"
            color="gray"
            aria-label="Añadir etiqueta"
            onClick={() => setAdding(true)}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      )}

      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Group>
  );
}
