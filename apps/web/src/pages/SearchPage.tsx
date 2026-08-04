import {
  Alert,
  Badge,
  Box,
  Center,
  Chip,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconFileText, IconSearch, IconTag } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TagChips } from '../tags/TagChips';
import { useTags } from '../tags/TagsContext';
import { ApiError, SEARCH_LIMIT, searchDocuments, type DocumentListItem } from '../lib/api';

/** Fecha corta, igual que en la vista de carpeta. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Resultados del buscador global. Todo el estado de la busqueda vive en la URL
 * (`?q=` y `?tags=`), asi que el resultado se puede compartir y sobrevive a un
 * recargado; el campo de texto esta en la cabecera.
 */
export function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { tags: catalog } = useTags();

  const q = (params.get('q') ?? '').trim();
  const tagIds = (params.get('tags') ?? '').split(',').filter(Boolean);

  const [results, setResults] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCriteria = q !== '' || tagIds.length > 0;
  // La clave evita relanzar la busqueda cuando el array de tags es nuevo pero
  // su contenido es el mismo (cada render de la URL crea un array distinto).
  const tagsKey = tagIds.join(',');

  useEffect(() => {
    if (!hasCriteria) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchDocuments(q, tagsKey ? tagsKey.split(',') : [])
      .then((docs) => {
        if (!cancelled) {
          setResults(docs);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setResults([]);
          setError(err instanceof ApiError ? err.message : 'No se pudo buscar');
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
  }, [q, tagsKey, hasCriteria]);

  /** Marca o desmarca un tag conservando el texto de la busqueda. */
  function toggleTag(id: string) {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    const search = new URLSearchParams();
    if (q) {
      search.set('q', q);
    }
    if (next.length > 0) {
      search.set('tags', next.join(','));
    }
    setParams(search, { replace: true });
  }

  return (
    <Stack h="100%" gap="md">
      {/* ---------------- Cabecera ---------------- */}
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <IconSearch size={22} stroke={1.7} opacity={0.5} />
        <Title order={2} fz="1.6rem" lineClamp={1}>
          {q ? `Resultados de «${q}»` : 'Buscar'}
        </Title>
        {hasCriteria && !loading && (
          <Badge variant="light" color="gray" size="sm" tt="none" fw={500}>
            {results.length} {results.length === 1 ? 'documento' : 'documentos'}
          </Badge>
        )}
      </Group>

      {/* ---------------- Filtros por tag ---------------- */}
      {catalog.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6}>
            Filtrar por etiqueta
          </Text>
          <ScrollArea type="auto" offsetScrollbars>
            <Group gap={6} wrap="nowrap">
              {catalog.map((tag) => (
                <Chip
                  key={tag.id}
                  size="xs"
                  radius="sm"
                  color={tag.color ?? 'gray'}
                  checked={tagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                >
                  {tag.name} ({tag.documentCount})
                </Chip>
              ))}
            </Group>
          </ScrollArea>
        </Box>
      )}

      {/* ---------------- Resultados ---------------- */}
      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        {error && (
          <Alert color="red" variant="light">
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {loading ? (
          <Center py="4rem">
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Buscando…
              </Text>
            </Group>
          </Center>
        ) : !hasCriteria ? (
          <Stack align="center" gap="xs" py="4rem">
            <IconSearch size={36} stroke={1.3} opacity={0.35} />
            <Text c="dimmed" size="sm" ta="center" maw={420}>
              Escribe en el buscador de arriba o marca una etiqueta para ver los documentos que la
              llevan.
            </Text>
          </Stack>
        ) : results.length === 0 ? (
          <Stack align="center" gap="xs" py="4rem">
            <IconTag size={36} stroke={1.3} opacity={0.35} />
            <Text c="dimmed" size="sm">
              Ningún documento coincide con la búsqueda.
            </Text>
          </Stack>
        ) : (
          <Stack gap="xs">
            <Paper withBorder radius="md" p={4}>
              {results.map((doc) => (
                <Box
                  key={doc.id}
                  className="row-item"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <IconFileText size={17} stroke={1.6} opacity={0.7} />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {doc.title}
                    </Text>
                    {doc.excerpt && (
                      <Text size="xs" c="dimmed" lineClamp={2}>
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
                </Box>
              ))}
            </Paper>

            {/* La API corta en SEARCH_LIMIT y no devuelve el total: si llegan
                justo esos, es que hay mas y conviene decirlo. */}
            {results.length === SEARCH_LIMIT && (
              <Text size="xs" c="dimmed" ta="center">
                Se muestran los {SEARCH_LIMIT} resultados más relevantes. Afina la búsqueda para ver
                otros.
              </Text>
            )}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );
}
