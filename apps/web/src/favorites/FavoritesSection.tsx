import { Divider, Group, Text } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategories } from '../categories/CategoriesContext';
import { FavoriteStar } from './FavoriteStar';
import { useFavorites } from './FavoritesContext';

/**
 * Seccion «Favoritos» del sidebar: lista plana de documentos, del ultimo
 * marcado al primero. Si no hay ninguno **no se pinta nada**, para no dejar un
 * hueco vacio a quien no usa favoritos.
 *
 * Reutiliza las clases del arbol (`tree-row`), asi que las filas se ven igual
 * que las de una carpeta. No tiene drag & drop: el orden lo decide la fecha de
 * marcado, no el usuario.
 */
export function FavoritesSection() {
  const { favorites } = useFavorites();
  const { select } = useCategories();
  const { id: openDocId } = useParams();
  const navigate = useNavigate();

  if (favorites.length === 0) {
    return null;
  }

  /** Abre el documento y deja de marcar la carpeta: solo un nodo a la vez. */
  function open(id: string) {
    select(null);
    navigate(`/documents/${id}`);
  }

  return (
    <>
      <Group px={6} gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          Favoritos
        </Text>
      </Group>

      <ul className="tree-list">
        {favorites.map((doc) => (
          <li key={doc.id}>
            <div
              className={`tree-row${openDocId === doc.id ? ' tree-row--active' : ''}`}
              onClick={() => open(doc.id)}
            >
              <span className="tree-chevron" />
              <IconFileText size={15} stroke={1.7} style={{ flex: 'none', opacity: 0.75 }} />
              <span className="tree-row-name">{doc.title}</span>
              <span className="tree-row-actions">
                <FavoriteStar documentId={doc.id} fallback size="sm" iconSize={14} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <Divider my={2} />
    </>
  );
}
