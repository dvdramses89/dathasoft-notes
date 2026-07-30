import {
  Button,
  ColorSwatch,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { DEFAULT_FOLDER_ICON, FOLDER_ICON_KEYS, FolderIcon } from '../categories/folderIcons';
import { DEFAULT_FOLDER_COLOR, FOLDER_COLORS } from '../theme';

export interface FolderLook {
  name: string;
  icon: string;
  color: string;
}

interface FolderFormModalProps {
  opened: boolean;
  /** Titulo del dialogo; distingue crear de editar. */
  title: string;
  /** Texto del boton de confirmar. */
  submitLabel: string;
  /** Carpeta donde se va a crear, solo informativo ('Mi espacio' en la raiz). */
  parentName?: string;
  initial?: Partial<FolderLook>;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (look: FolderLook) => void;
}

/**
 * Alta y edicion del aspecto de una carpeta: nombre, icono y color.
 *
 * El icono y el color ya existian en la tabla `Category` (columnas `icon` y
 * `color`) pero no habia forma de darles valor desde la interfaz.
 */
export function FolderFormModal({
  opened,
  title,
  submitLabel,
  parentName,
  initial,
  busy,
  onClose,
  onSubmit,
}: FolderFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_FOLDER_ICON);
  const [color, setColor] = useState(initial?.color ?? DEFAULT_FOLDER_COLOR);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (clean) {
      onSubmit({ name: clean, icon, color });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Título"
            placeholder="Nombre de la carpeta"
            data-autofocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            description={parentName ? `Se creará en «${parentName}»` : undefined}
          />

          <div>
            <Text size="sm" fw={500} mb={6}>
              Icono
            </Text>
            <SimpleGrid cols={10} spacing={4}>
              {FOLDER_ICON_KEYS.map((key) => (
                <UnstyledButton
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={`Icono ${key}`}
                  aria-pressed={icon === key}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    height: 34,
                    borderRadius: 'var(--mantine-radius-sm)',
                    border: `1px solid ${
                      icon === key ? 'var(--mantine-primary-color-filled)' : 'transparent'
                    }`,
                    background: icon === key ? 'var(--mantine-primary-color-light)' : undefined,
                  }}
                >
                  <FolderIcon icon={key} color={color} size={18} />
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </div>

          <div>
            <Text size="sm" fw={500} mb={6}>
              Color
            </Text>
            <Group gap={6}>
              {FOLDER_COLORS.map((value) => (
                <Tooltip key={value} label={value} openDelay={300}>
                  <ColorSwatch
                    component="button"
                    type="button"
                    color={`var(--mantine-color-${value}-filled)`}
                    size={22}
                    onClick={() => setColor(value)}
                    aria-label={`Color ${value}`}
                    aria-pressed={color === value}
                    style={{
                      cursor: 'pointer',
                      outline:
                        color === value ? '2px solid var(--mantine-color-text)' : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                </Tooltip>
              ))}
            </Group>
          </div>

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button variant="default" type="button" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={name.trim() === ''}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
