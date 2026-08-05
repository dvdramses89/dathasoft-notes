import {
  ActionIcon,
  Anchor,
  Avatar,
  Breadcrumbs,
  Burger,
  Group,
  Menu,
  Text,
  TextInput,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import {
  IconChevronLeft,
  IconFileText,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSun,
  IconTags,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { pathOf, useCategories } from '../categories/CategoriesContext';
import { FolderIcon } from '../categories/folderIcons';
import { useDocuments } from '../documents/DocumentsContext';
import { TagsModal } from './TagsModal';

interface AppHeaderProps {
  navbarOpened: boolean;
  onToggleNavbar: () => void;
}

/**
 * Cabecera del shell: navegacion (atras + migas de pan) a la izquierda y las
 * acciones de sesion a la derecha.
 *
 * Las migas salen del arbol de carpetas y del documento abierto, asi que
 * reflejan donde estas aunque hayas llegado por una URL directa.
 */
export function AppHeader({ navbarOpened, onToggleNavbar }: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { tree, selectedId, select } = useCategories();
  const { current } = useDocuments();
  const { setColorScheme } = useMantineColorScheme();
  // El efectivo, no el guardado: 'auto' tambien tiene que resolverse a uno.
  const isDark = useComputedColorScheme('light') === 'dark';
  const [tagsOpened, setTagsOpened] = useState(false);

  // Buscador: el texto es estado local, pero la busqueda vive en la URL.
  const location = useLocation();
  const [params] = useSearchParams();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [term, setTerm] = useState('');
  const enBusqueda = location.pathname === '/search';

  // Al entrar en /search (o al cambiar la consulta desde la propia pagina) el
  // campo refleja lo que se esta buscando; al salir, se vacia.
  useEffect(() => {
    setTerm(enBusqueda ? (params.get('q') ?? '') : '');
  }, [enBusqueda, params]);

  useHotkeys([['mod+K', () => searchRef.current?.focus()]]);

  function submitSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }
    const clean = term.trim();
    // Se conservan los tags marcados: refinar el texto no deshace el filtro.
    const search = new URLSearchParams();
    if (clean) {
      search.set('q', clean);
    }
    const tags = enBusqueda ? params.get('tags') : null;
    if (tags) {
      search.set('tags', tags);
    }
    navigate(`/search?${search.toString()}`);
  }

  // Con un documento abierto la ruta es la de SU carpeta, y el documento cierra
  // las migas; si no, la de la carpeta marcada en el arbol.
  const folderPath = pathOf(tree, current ? current.categoryId : selectedId);

  function goToFolder(id: string | null) {
    select(id);
    navigate('/');
  }

  const crumbs = [
    <Anchor
      key="root"
      component="button"
      type="button"
      size="sm"
      c="dimmed"
      underline="never"
      onClick={() => goToFolder(null)}
    >
      Mi espacio
    </Anchor>,
    ...folderPath.map((node) => (
      <Anchor
        key={node.id}
        component="button"
        type="button"
        size="sm"
        c="dimmed"
        underline="never"
        onClick={() => goToFolder(node.id)}
      >
        <Group gap={6} wrap="nowrap">
          <FolderIcon icon={node.icon} color={node.color} size={14} />
          {node.name}
        </Group>
      </Anchor>
    )),
  ];

  // La papelera tambien cierra las migas: si no, la cabecera diria «Mi espacio»
  // mientras estas en otra pantalla.
  if (location.pathname === '/trash') {
    crumbs.push(
      <Group key="trash" gap={6} wrap="nowrap" className="crumb-current">
        <IconTrash size={14} stroke={1.8} />
        <Text size="sm" fw={500}>
          Papelera
        </Text>
      </Group>,
    );
  }

  // El documento actual cierra las migas y no es pulsable: ya estas en el.
  if (current) {
    crumbs.push(
      <Group key="doc" gap={6} wrap="nowrap" className="crumb-current">
        <IconFileText size={14} stroke={1.8} />
        <Text size="sm" fw={500} lineClamp={1}>
          {current.title}
        </Text>
      </Group>,
    );
  }

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        <Burger
          opened={navbarOpened}
          onClick={onToggleNavbar}
          hiddenFrom="sm"
          size="sm"
          aria-label={navbarOpened ? 'Cerrar el panel de carpetas' : 'Abrir el panel de carpetas'}
        />
        <Tooltip label="Atrás">
          <ActionIcon variant="subtle" color="gray" onClick={() => navigate(-1)}>
            <IconChevronLeft size={18} />
          </ActionIcon>
        </Tooltip>
        <Breadcrumbs separator="/" separatorMargin={6} style={{ minWidth: 0 }}>
          {crumbs}
        </Breadcrumbs>
      </Group>

      <Group gap="xs" wrap="nowrap">
        <TextInput
          ref={searchRef}
          size="xs"
          radius="md"
          w={200}
          visibleFrom="sm"
          value={term}
          onChange={(e) => setTerm(e.currentTarget.value)}
          onKeyDown={submitSearch}
          placeholder="Buscar…  Ctrl+K"
          aria-label="Buscar documentos"
          leftSection={<IconSearch size={14} stroke={1.8} />}
        />
        <Tooltip label="Buscar">
          <ActionIcon
            variant="subtle"
            color="gray"
            hiddenFrom="sm"
            aria-label="Buscar documentos"
            onClick={() => navigate('/search')}
          >
            <IconSearch size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={isDark ? 'Tema claro' : 'Tema oscuro'}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Cambiar de tema"
            onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Tooltip>

        <Menu position="bottom-end" width={230} shadow="md">
          <Menu.Target>
            <Avatar
              component="button"
              type="button"
              size={28}
              radius="xl"
              color="brand"
              aria-label="Cuenta"
              style={{ cursor: 'pointer', border: 0 }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </Avatar>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>
              <Text size="xs" fw={500} truncate>
                {user?.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {user?.email}
              </Text>
            </Menu.Label>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconTags size={16} />}
              onClick={() => setTagsOpened(true)}
            >
              Etiquetas
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
              Cerrar sesión
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <TagsModal opened={tagsOpened} onClose={() => setTagsOpened(false)} />
    </Group>
  );
}
