import { useAuth } from '../auth/AuthContext';
import { useCategories } from '../categories/CategoriesContext';

export function HomePage() {
  const { user } = useAuth();
  const { selectedNode } = useCategories();

  return (
    <div className="content-inner">
      {selectedNode ? (
        <div className="content-header">
          <h1 className="content-title">{selectedNode.name}</h1>
          <p className="content-subtitle">
            Carpeta seleccionada · los documentos se mostrarán aquí (próxima fase).
          </p>
        </div>
      ) : (
        <div className="content-empty">
          <h1 className="content-title">Hola, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="content-subtitle">
            Selecciona una carpeta en el panel izquierdo o crea una nueva con «+».
          </p>
        </div>
      )}
    </div>
  );
}
