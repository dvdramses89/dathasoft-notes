import { Outlet } from 'react-router-dom';
import { CategoriesProvider } from '../categories/CategoriesContext';
import { DocumentsProvider } from '../documents/DocumentsContext';
import { Sidebar } from './Sidebar';

// Shell de la app autenticada: sidebar de carpetas/documentos + contenido principal.
export function AppLayout() {
  return (
    <CategoriesProvider>
      <DocumentsProvider>
        <div className="app-shell">
          <Sidebar />
          <main className="content">
            <Outlet />
          </main>
        </div>
      </DocumentsProvider>
    </CategoriesProvider>
  );
}
