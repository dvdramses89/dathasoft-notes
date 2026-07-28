import { Outlet } from 'react-router-dom';
import { CategoriesProvider } from '../categories/CategoriesContext';
import { Sidebar } from './Sidebar';

// Shell de la app autenticada: sidebar de carpetas + contenido principal.
export function AppLayout() {
  return (
    <CategoriesProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </CategoriesProvider>
  );
}
