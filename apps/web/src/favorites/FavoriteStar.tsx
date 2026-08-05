import { ActionIcon, Tooltip } from '@mantine/core';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useFavorites } from './FavoritesContext';

interface FavoriteStarProps {
  documentId: string;
  /** El `isFavorite` que trajo la API; solo cuenta hasta que llega el contexto. */
  fallback?: boolean;
  /** Tamano del ActionIcon: una talla de Mantine ('sm') o pixeles. */
  size?: string | number;
  iconSize?: number;
}

/**
 * Estrella de favorito. Vale para cualquier sitio donde se vea un documento:
 * la hoja, la vista de carpeta y el sidebar. Lleva `stopPropagation` porque
 * casi siempre esta dentro de algo que ya es pulsable (una tarjeta, una fila).
 */
export function FavoriteStar({ documentId, fallback, size = 30, iconSize = 17 }: FavoriteStarProps) {
  const { isFavorite, toggle } = useFavorites();
  const marked = isFavorite(documentId, fallback);
  const label = marked ? 'Quitar de favoritos' : 'Añadir a favoritos';

  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="subtle"
        color={marked ? 'yellow' : 'gray'}
        size={size}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          void toggle(documentId);
        }}
      >
        {marked ? <IconStarFilled size={iconSize} /> : <IconStar size={iconSize} stroke={1.7} />}
      </ActionIcon>
    </Tooltip>
  );
}
