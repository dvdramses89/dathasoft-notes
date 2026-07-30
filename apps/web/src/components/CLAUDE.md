# `components/` — Layout, rutas y sidebar

Los componentes técnicos compartidos: la composición de la app autenticada y el árbol de navegación.

## Estructura del módulo

```
components/
├── ProtectedRoute.tsx      ← guard de rutas
├── AppLayout.tsx           ← shell de la app autenticada
├── Sidebar.tsx             ← ~919 líneas, el fichero más grande del front
├── MoveModal.tsx           ← mover carpeta
└── MoveDocumentModal.tsx   ← mover documento
```

## Composición del layout

El orden importa y es deliberado:

```
main.tsx        BrowserRouter > AuthProvider > App
App.tsx         Routes
                └─ ProtectedRoute (layout route SIN path)
                   └─ AppLayout
                      └─ CategoriesProvider > DocumentsProvider
                         └─ .app-shell: <Sidebar /> + <main class="content"><Outlet /></main>
```

- `AuthProvider` envuelve **toda** la app (las páginas de login lo necesitan). Los providers de datos van **dentro de la zona protegida**: sin sesión no se piden categorías ni documentos.
- `ProtectedRoute` devuelve `<Outlet/>` si hay usuario y `<Navigate to="/login" replace/>` si no. NORMA: mientras `loading` es `true`, renderiza un `<span className="badge badge--loading">Cargando…</span>`. **Ese estado intermedio no es decorativo**: sin él, al recargar con un token válido se vería un parpadeo hacia `/login` antes de que `getMe()` responda.
- `AppLayout` no recibe props: toma todo de los contexts.

## Sidebar

El componente grande. Contiene el árbol de carpetas, los documentos de cada una, y todas sus acciones.

### Patrones propios

- **`TreeItem` es recursivo**: se renderiza a sí mismo para las hijas y reenvía las props con spread. Es lo que produce los N niveles.
- **`docActions`**: los handlers de documento se agrupan en un solo objeto tipado con `Omit<DocItemProps, 'doc' | 'depth' | 'active' | 'editing' | 'onOpen'>`, para no arrastrar ocho props sueltas por cada nivel de recursión.
- **Los seis iconos SVG** (`FolderIcon`, `DocIcon`, `Chevron`, `PencilIcon`, `TrashIcon`, `MoveIcon`) se definen como componentes locales al principio del fichero. No están exportados: son de uso interno del sidebar.
- **Edición en línea**: renombrar carpetas y documentos usa un `<input>` en el sitio (`.rename-input`), no un modal. Crear carpeta también (`.add-folder-input`).

### Drag & drop

HTML5 nativo. La posición de suelte se calcula comparando `e.clientY` con el punto medio del elemento (`getBoundingClientRect()`), lo que da los estados visuales `--drop-before` / `--drop-after`.

NORMA: **solo se permite reordenar entre hermanos del mismo padre.** Mover a otro nivel se hace con el modal de mover, que además pregunta el modo `subtree`/`single`.

DEUDA: la lógica está **implementada dos veces**, una para carpetas y otra para documentos, con la misma estructura. Unificarla es tentador pero es una decisión del usuario.

### Estado

DEUDA: `Sidebar.tsx` sostiene **14 `useState`** — expansión, creación, edición, tres targets de modal, y seis relativos al arrastre. No añadas más sin plantear antes si toca partir el componente.

## Los modales

`MoveModal` (carpetas) y `MoveDocumentModal` (documentos) comparten estructura: un árbol de destinos (`.dest-tree` / `.dest-item`) donde se elige la carpeta, más —solo en el de carpetas— los radios de modo `subtree` / `single`.

En el selector de destino, la carpeta que se está moviendo y sus descendientes aparecen **deshabilitados** (`.dest-item:disabled`), para no ofrecer un movimiento que la API va a rechazar por ciclo.

DEUDA: el markup del modal (`.modal-overlay` > `.modal` > título + texto + `.modal-actions`) está **duplicado a mano en cuatro sitios**: los dos de confirmación de borrado dentro de `Sidebar.tsx`, más estos dos ficheros. Ver `.claude/rules/frontend.md`.

## Validaciones requeridas

Ninguna propia. Los nombres se validan en el backend; el frontend solo evita enviar cadenas vacías y deshabilita el botón mientras `busy`.

## Cómo verificar el módulo

1. **Recarga con sesión válida** — se ve "Cargando…" y luego la app, **sin parpadeo hacia `/login`**.
2. **Recarga sin sesión** — va directo a `/login`.
3. **Árbol** — crear carpetas anidadas y comprobar que la indentación y los chevrons responden en todos los niveles.
4. **Expandir una carpeta** — carga sus documentos la primera vez y no vuelve a pedirlos después.
5. **Renombrar en línea** — carpeta y documento, con Enter y con Escape.
6. **Borrar** — el diálogo aparece; en carpetas con hijas, pregunta el modo.
7. **Mover con el modal** — la carpeta que se mueve y sus descendientes salen deshabilitados en el selector de destino.
8. **Drag & drop** — reordenar carpetas hermanas y documentos dentro de una carpeta; los indicadores `--drop-before`/`--drop-after` aparecen donde toca.
9. **Arrastrar a un padre distinto** — no debe permitirse.
10. **Consola limpia** en todo el recorrido.
