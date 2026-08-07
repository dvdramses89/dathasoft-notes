import { createReactBlockSpec } from '@blocknote/react';
import { ActionIcon, Anchor, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconExternalLink, IconPencil, IconWorld } from '@tabler/icons-react';
import { useState } from 'react';

/**
 * Bloque custom de BlockNote para referenciar una URL externa.
 * Se almacena en contentJson como { type: 'webLink', props: { url, caption } }.
 * No requiere cambios en la API: es contenido opaco para el backend.
 */
export const webLinkBlockSpec = createReactBlockSpec(
  {
    type: 'webLink' as const,
    propSchema: {
      url: { default: '' },
      caption: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      // Modo edicion cuando el bloque es nuevo (sin URL) o el usuario pulsa editar.
      const [editing, setEditing] = useState(!block.props.url);
      const [urlDraft, setUrlDraft] = useState(block.props.url);
      const [captionDraft, setCaptionDraft] = useState(block.props.caption);

      function save() {
        const url = urlDraft.trim();
        if (!url) return;
        editor.updateBlock(block, {
          props: {
            url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
            caption: captionDraft.trim(),
          },
        });
        setEditing(false);
      }

      function cancel() {
        if (!block.props.url) {
          // Bloque nuevo sin confirmar: se elimina.
          editor.removeBlocks([block]);
        } else {
          setUrlDraft(block.props.url);
          setCaptionDraft(block.props.caption);
          setEditing(false);
        }
      }

      if (editing) {
        return (
          <Paper withBorder p="sm" radius="md">
            <Stack gap="xs">
              <TextInput
                autoFocus
                label="URL"
                placeholder="https://ejemplo.com"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') cancel();
                }}
              />
              <TextInput
                label="Etiqueta (opcional)"
                placeholder="Título del enlace"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') cancel();
                }}
              />
              <Group justify="flex-end">
                <ActionIcon
                  variant="filled"
                  size="sm"
                  onClick={save}
                  disabled={!urlDraft.trim()}
                  aria-label="Guardar enlace"
                >
                  <IconCheck size={14} stroke={1.8} />
                </ActionIcon>
              </Group>
            </Stack>
          </Paper>
        );
      }

      const label = block.props.caption || block.props.url;
      let hostname = '';
      try {
        hostname = new URL(block.props.url).hostname;
      } catch {
        // URL invalida o relativa; hostname se omite
      }

      return (
        <Paper withBorder p="sm" radius="md">
          <Group gap="sm" wrap="nowrap">
            <IconWorld size={18} stroke={1.7} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Anchor
                href={block.props.url}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                fw={500}
                lineClamp={1}
              >
                {label}
              </Anchor>
              {hostname && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {hostname}
                </Text>
              )}
            </div>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setUrlDraft(block.props.url);
                setCaptionDraft(block.props.caption);
                setEditing(true);
              }}
              aria-label="Editar enlace"
            >
              <IconPencil size={14} stroke={1.8} />
            </ActionIcon>
            <ActionIcon
              component="a"
              href={block.props.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="sm"
              aria-label="Abrir enlace en nueva pestaña"
            >
              <IconExternalLink size={14} stroke={1.8} />
            </ActionIcon>
          </Group>
        </Paper>
      );
    },
  },
)();
