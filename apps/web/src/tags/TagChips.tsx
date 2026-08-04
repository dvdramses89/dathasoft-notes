import { Badge, Group } from '@mantine/core';
import type { Tag } from '../lib/api';
import { useTags } from './TagsContext';

interface TagChipsProps {
  tags: Tag[];
  /** Cuantos se pintan como maximo; el resto se resume en un «+N». */
  max?: number;
  size?: 'xs' | 'sm';
}

/** Color de un tag sin color propio. */
const NO_COLOR = 'gray';

/**
 * Los tags de un documento, en solo lectura. Los resuelve contra el catalogo
 * (ver `resolve` en TagsContext), asi que renombrar o eliminar un tag se ve al
 * momento en los listados ya cargados.
 */
export function TagChips({ tags, max = 3, size = 'xs' }: TagChipsProps) {
  const { resolve } = useTags();
  const resolved = resolve(tags);

  if (resolved.length === 0) {
    return null;
  }

  const shown = resolved.slice(0, max);
  const rest = resolved.length - shown.length;

  return (
    <Group gap={4} wrap="wrap">
      {shown.map((tag) => (
        <Badge
          key={tag.id}
          size={size}
          variant="light"
          color={tag.color ?? NO_COLOR}
          radius="sm"
          tt="none"
          fw={500}
        >
          {tag.name}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge size={size} variant="default" radius="sm" tt="none" fw={500}>
          +{rest}
        </Badge>
      )}
    </Group>
  );
}
