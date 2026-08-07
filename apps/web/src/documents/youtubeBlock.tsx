import { createReactBlockSpec } from '@blocknote/react';
import { ActionIcon, Alert, AspectRatio, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { IconBrandYoutube, IconCheck, IconPencil } from '@tabler/icons-react';
import { useState } from 'react';

/**
 * Bloque custom para incrustar un video de YouTube.
 *
 * El bloque `video` de BlockNote no sirve para esto: su render crea un
 * <video src>, y YouTube no entrega un fichero de video en su URL, asi que el
 * navegador lo rechaza con MEDIA_ELEMENT_ERROR. Un embed necesita un <iframe>.
 *
 * Se guarda el ID del video, no la URL: asi el estado persistido siempre es
 * valido y el iframe se construye igual sea cual sea la variante que se pego.
 */

/** Un ID de YouTube son 11 caracteres de este alfabeto. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const HOSTS_YOUTUBE = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
];

interface ParsedVideo {
  videoId: string;
  /** Segundo de inicio, si la URL traia un t= o start=. */
  start: number;
}

/**
 * Extrae el ID (y el segundo de inicio) de cualquier variante de URL de
 * YouTube. Devuelve null si la URL no es de YouTube o no lleva un ID valido.
 */
export function parseYoutubeUrl(raw: string): ParsedVideo | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  // Se acepta pegar el ID a pelo, que es lo que queda al copiar de algunos sitios.
  if (ID_RE.test(trimmed)) {
    return { videoId: trimmed, start: 0 };
  }

  let url: URL;
  try {
    // Sin esquema, `new URL` falla; se asume https como en el bloque de enlace.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    // https://youtu.be/<id>
    videoId = segments[0] ?? null;
  } else if (HOSTS_YOUTUBE.includes(host)) {
    if (segments[0] === 'watch') {
      // https://www.youtube.com/watch?v=<id>
      videoId = url.searchParams.get('v');
    } else if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') {
      // https://www.youtube.com/{embed,shorts,live}/<id>
      videoId = segments[1] ?? null;
    }
  }

  if (!videoId || !ID_RE.test(videoId)) {
    return null;
  }

  return { videoId, start: parseStart(url) };
}

/** Lee el segundo de inicio de `t` o `start`. Admite el formato 1h2m3s de YouTube. */
function parseStart(url: URL): number {
  const raw = url.searchParams.get('start') ?? url.searchParams.get('t');
  if (!raw) {
    return 0;
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!match || !match.slice(1).some(Boolean)) {
    return 0;
  }
  const [h, m, s] = match.slice(1).map((v) => Number(v ?? 0) || 0);
  return h * 3600 + m * 60 + s;
}

/** URL de YouTube canonica, para editar el bloque y para el texto buscable. */
export function canonicalYoutubeUrl(videoId: string, start = 0): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return start > 0 ? `${base}&t=${start}` : base;
}

/** URL del iframe. Se usa el dominio sin cookies de seguimiento. */
function embedUrl(videoId: string, start: number): string {
  const params = new URLSearchParams({ rel: '0' });
  if (start > 0) {
    params.set('start', String(start));
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export const youtubeBlockSpec = createReactBlockSpec(
  {
    type: 'youtubeEmbed' as const,
    propSchema: {
      videoId: { default: '' },
      caption: { default: '' },
      start: { default: 0, type: 'number' as const },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const { videoId, caption, start } = block.props;
      // Modo edicion cuando el bloque es nuevo (sin video) o se pulsa editar.
      const [editing, setEditing] = useState(!videoId);
      const [urlDraft, setUrlDraft] = useState(videoId ? canonicalYoutubeUrl(videoId, start) : '');
      const [captionDraft, setCaptionDraft] = useState(caption);
      const [error, setError] = useState<string | null>(null);

      function save() {
        const parsed = parseYoutubeUrl(urlDraft);
        if (!parsed) {
          setError('No parece un enlace de YouTube. Pega la URL del vídeo o su ID.');
          return;
        }
        editor.updateBlock(block, {
          props: {
            videoId: parsed.videoId,
            start: parsed.start,
            caption: captionDraft.trim(),
          },
        });
        setError(null);
        setEditing(false);
      }

      function cancel() {
        if (!videoId) {
          // Bloque nuevo sin confirmar: se elimina.
          editor.removeBlocks([block]);
        } else {
          setUrlDraft(canonicalYoutubeUrl(videoId, start));
          setCaptionDraft(caption);
          setError(null);
          setEditing(false);
        }
      }

      if (editing) {
        return (
          <Paper withBorder p="sm" radius="md" w="100%">
            <Stack gap="xs">
              <TextInput
                autoFocus
                label="Enlace del vídeo"
                placeholder="https://www.youtube.com/watch?v=..."
                value={urlDraft}
                error={error}
                onChange={(e) => {
                  setUrlDraft(e.currentTarget.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  // Sin esto BlockNote se queda el Enter y el Escape.
                  e.stopPropagation();
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') cancel();
                }}
              />
              <TextInput
                label="Título (opcional)"
                placeholder="De qué es el vídeo"
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
                  aria-label="Guardar vídeo"
                >
                  <IconCheck size={14} stroke={1.8} />
                </ActionIcon>
              </Group>
            </Stack>
          </Paper>
        );
      }

      // Un videoId invalido solo puede venir de un contentJson manipulado a mano.
      if (!ID_RE.test(videoId)) {
        return (
          <Alert color="yellow" variant="light" title="Vídeo no disponible" w="100%">
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">El identificador del vídeo no es válido.</Text>
              <ActionIcon variant="subtle" size="sm" onClick={() => setEditing(true)} aria-label="Editar vídeo">
                <IconPencil size={14} stroke={1.8} />
              </ActionIcon>
            </Group>
          </Alert>
        );
      }

      return (
        // w="100%": el .bn-block-content de BlockNote es un contenedor flex, asi
        // que sin esto la tarjeta se encoge al ancho intrinseco del iframe (300px)
        // en vez de ocupar la hoja.
        <Paper withBorder p="xs" radius="md" w="100%">
          <Stack gap="xs">
            {/* contentEditable={false} para que ProseMirror no trate el iframe
                como texto editable, igual que hace el bloque de video nativo.
                Sin `userSelect: none`: impedia que Control+A abarcase el bloque,
                y entonces no habia forma de borrarlo con el teclado. */}
            <div contentEditable={false}>
              <AspectRatio ratio={16 / 9}>
                <iframe
                  src={embedUrl(videoId, start)}
                  title={caption || 'Vídeo de YouTube'}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                  style={{ border: 0, borderRadius: 'var(--mantine-radius-sm)' }}
                />
              </AspectRatio>
            </div>
            <Group gap="xs" wrap="nowrap" justify="space-between">
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <IconBrandYoutube size={16} stroke={1.7} style={{ flexShrink: 0 }} />
                <Text size="sm" c={caption ? undefined : 'dimmed'} lineClamp={1}>
                  {caption || 'Vídeo de YouTube'}
                </Text>
              </Group>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => {
                  setUrlDraft(canonicalYoutubeUrl(videoId, start));
                  setCaptionDraft(caption);
                  setEditing(true);
                }}
                aria-label="Editar vídeo"
              >
                <IconPencil size={14} stroke={1.8} />
              </ActionIcon>
            </Group>
          </Stack>
        </Paper>
      );
    },
  },
)();
