import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { CategoriesProvider } from '../categories/CategoriesContext';
import { DocumentsProvider } from '../documents/DocumentsContext';
import { FavoritesProvider } from '../favorites/FavoritesContext';
import { TagsProvider } from '../tags/TagsContext';
import { TrashProvider } from '../trash/TrashContext';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

// Shell de la app autenticada: cabecera + sidebar de carpetas/documentos.
export function AppLayout() {
  // Por debajo de `sm` el sidebar se pliega y se abre con el burger del header.
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <CategoriesProvider>
      <DocumentsProvider>
        <TagsProvider>
          <FavoritesProvider>
            <TrashProvider>
              <AppShell
                header={{ height: 52 }}
                navbar={{ width: 276, breakpoint: 'sm', collapsed: { mobile: !opened } }}
                padding="md"
              >
                <AppShell.Header className="app-header">
                  <AppHeader navbarOpened={opened} onToggleNavbar={toggle} />
                </AppShell.Header>

                <AppShell.Navbar className="app-navbar" p="xs">
                  <Sidebar />
                </AppShell.Navbar>

                <AppShell.Main className="app-main">
                  <Outlet />
                </AppShell.Main>
              </AppShell>
            </TrashProvider>
          </FavoritesProvider>
        </TagsProvider>
      </DocumentsProvider>
    </CategoriesProvider>
  );
}
