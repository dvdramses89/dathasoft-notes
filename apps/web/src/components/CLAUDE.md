# `components/` — Shell, rutas y sidebar

Los componentes técnicos compartidos: la composición de la app autenticada, la cabecera y el árbol de navegación.

## Estructura del módulo

```
components/
├── ProtectedRoute.tsx      ← guard de rutas
├── AppLayout.tsx           ← shell (AppShell de Mantine)
├── AppHeader.tsx           ← migas de pan, tema, menú de cuenta
├── Sidebar.tsx             ← ~910 líneas, el fichero más grande del front
├── DestinationPicker.tsx   ← selector de carpeta destino (compartido)
├── FolderFormModal.tsx     ← crear carpeta / editar icono y color
├── MoveModal.tsx           ← mover carpeta
└── MoveDocumentModal.tsx   ← mover documento
```

## Composición del layout

El orden importa y es deliberado:

```
main.tsx        MantineProvider > BrowserRouter > AuthProvider > App
App.tsx         Routes
                └─ ProtectedRoute (layout route SIN path)
                   └─ AppLayout
                      └─ CategoriesProvider > DocumentsProvider
                         └─ AppShell: Header(AppHeader) + Navbar(Sidebar) + Main(<Outlet/>)
```

- `MantineProvider` y `AuthProvider` envuelven **toda** la app (las páginas de login los necesitan). Los providers de datos van **dentro de la zona protegida**: sin sesión no se piden categorías ni documentos.
- `ProtectedRoute` devuelve `<Outlet/>` si hay usuario y `<Navigate to="/login" replace/>` si no. NORMA: mientras `loading` es `true` renderiza un `<Loader/>` centrado. **Ese estado intermedio no es decorativo**: sin él, al recargar con un token válido se vería un parpadeo hacia `/login` antes de que `getMe()` responda.
- `AppLayout` no recibe props: toma todo de los contexts. Su único estado es el `useDisclosure` del sidebar plegable.
- NORMA: **el scroll no vive en el shell.** `.app-main` es `height: 100dvh; overflow: hidden` y cada página monta su propio `ScrollArea`. Así la cabecera y el sidebar no se mueven.

## AppHeader

- **Las migas de pan se calculan, no se guardan**: `pathOf(tree, id)` (exportado desde `CategoriesContext`) da la ruta desde la raíz. El último tramo es el documento abierto, y no es pulsable.
- Con un documento abierto la ruta es la de **su** carpeta; si no, la de la carpeta marcada en el árbol.
- NORMA: el documento abierto llega por `current` de `DocumentsContext`, que **publica `DocumentPage` al cargarlo**. Es la única forma de tener título y carpeta cuando se ha entrado por una URL directa, sin pasar por ningún listado.
- El interruptor de tema usa `useComputedColorScheme('light')` para **leer** y `setColorScheme` para **escribir** (ver la sección Tema de `.claude/rules/frontend.md`).

## Sidebar

El componente grande. Contiene el árbol de carpetas, los documentos de cada una, y todas sus acciones.

### Patrones propios

- **`TreeItem` es recursivo**: se renderiza a sí mismo para las hijas y reenvía las props con spread. Es lo que produce los N niveles.
- **`docActions`**: los handlers de documento se agrupan en un solo objeto tipado con `Omit<DocItemProps, 'doc' | 'depth' | 'active' | 'editing' | 'onOpen'>`, para no arrastrar ocho props sueltas por cada nivel de recursión.
- **Las acciones de fila van en un menú** (`RowMenu`, un `Menu` de Mantine tras un botón de tres puntos), no en botones sueltos. Aparece al pasar el ratón (`.tree-row-actions`), y en pantallas táctiles se queda visible.
- NORMA: `RowMenu` monta su `Menu.Target` como `ActionIcon component="div" role="button"`. **Es a propósito**: la fila entera ya es un `<div>` clicable y un `<button>` dentro de otro es HTML inválido.
- **Edición en línea**: renombrar carpetas y documentos usa un `TextInput` en el sitio, no un diálogo. **Crear** carpeta sí usa diálogo, porque además pide icono y color.
- El **contador de documentos** solo se pinta con la carpeta cerrada: abierta ya se ven.

### Drag & drop

HTML5 nativo. La posición de suelte se calcula comparando `e.clientY` con el punto medio del elemento (`getBoundingClientRect()`), lo que da los estados visuales `--drop-before` / `--drop-after`.

NORMA: **solo se permite reordenar entre hermanos del mismo padre.** Mover a otro nivel se hace con el diálogo de mover, que además pregunta el modo `subtree`/`single`.

DEUDA: la lógica está **implementada dos veces**, una para carpetas y otra para documentos, con la misma estructura. Unificarla es tentador pero es una decisión del usuario.

### Estado

DEUDA: `Sidebar.tsx` sostiene **13 `useState`** — expansión, el diálogo de carpeta, edición, tres targets de diálogo, y seis relativos al arrastre. No añadas más sin plantear antes si toca partir el componente.

## Los diálogos

Todos son `Modal` de Mantine, así que **el markup del diálogo ya no está duplicado**: overlay, caja, título y cierre los pone Mantine. Solo se escribe el contenido.

- **`DestinationPicker`** es el árbol de destinos, compartido por los tres sitios que eligen carpeta (mover carpeta, mover documento, mover en lote). Reutiliza la clase `.tree-row` del sidebar, así que la fila se ve igual en los dos contextos.
  - Convención de su valor: **`undefined` = nada elegido todavía**, `null` = la raíz, un id = esa carpeta. Los tres estados son distintos y el botón de confirmar solo se activa con `undefined` descartado.
  - Los destinos inválidos llegan por `disabledIds` y salen **deshabilitados**, para no ofrecer un movimiento que la API va a rechazar por ciclo. `MoveModal` mete ahí la carpeta que se mueve y todos sus descendientes.
- **`FolderFormModal`** sirve para crear y para editar el aspecto, según las props `title`/`submitLabel`/`initial`.
  - NORMA: se monta **condicionalmente** (`{folderForm && <FolderFormModal opened .../>}`), no con `opened={bool}`. Su estado interno se inicializa desde `initial` en el primer render, así que reutilizar la instancia dejaría los datos de la carpeta anterior.
  - No tiene campo de descripción porque **`Category` no tiene esa columna**. No lo añadas sin cambiar el esquema.

## Validaciones requeridas

Ninguna propia. Los nombres se validan en el backend; el frontend solo evita enviar cadenas vacías y deshabilita el botón mientras `busy`.

## Cómo verificar el módulo

1. **Recarga con sesión válida** — se ve el cargador y luego la app, **sin parpadeo hacia `/login`**.
2. **Recarga sin sesión** — va directo a `/login`.
3. **Migas de pan** — abrir un documento de una subcarpeta y comprobar la ruta completa; **recargar con esa URL** y comprobar que sigue saliendo igual.
4. **Árbol** — crear carpetas anidadas y comprobar que la indentación y los chevrons responden en todos los niveles.
5. **Expandir una carpeta** — carga sus documentos la primera vez y no vuelve a pedirlos después.
6. **Renombrar en línea** — carpeta y documento, con Enter y con Escape.
7. **Icono y color** — crear una carpeta con icono y color, y comprobar que se ven en el árbol, en las migas y en la tarjeta.
8. **Borrar** — el diálogo aparece; en carpetas con hijas, pregunta el modo.
9. **Mover** — la carpeta que se mueve y sus descendientes salen deshabilitados en el selector de destino, y la carpeta actual sale marcada.
10. **Drag & drop** — reordenar carpetas hermanas y documentos dentro de una carpeta; los indicadores `--drop-before`/`--drop-after` aparecen donde toca.
11. **Arrastrar a un padre distinto** — no debe permitirse.
12. **Menú de fila** — abrirlo **no** debe seleccionar la carpeta ni abrir el documento (el `stopPropagation`).
13. **Estrechar la ventana** por debajo de 48em — el sidebar se pliega y el burger lo abre.
14. **Cambiar de tema** — el shell, el árbol y el editor cambian juntos; al recargar se mantiene y **no hay fogonazo blanco**.
15. **Consola limpia** en todo el recorrido.
