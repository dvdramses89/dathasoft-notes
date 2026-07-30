# Frontend — React + diseño

Todo lo de `apps/web`. La parte A son los patrones de código; la parte B, el sistema visual. El detalle del editor BlockNote vive en `apps/web/src/documents/CLAUDE.md`.

---

# Parte A — Patrones de React

## Estructura de carpetas

Organización **híbrida deliberada**: unas carpetas son técnicas y otras son por feature.

```
src/
├── main.tsx · App.tsx · index.css · theme.ts · vite-env.d.ts
├── auth/         ← feature: AuthContext
├── categories/   ← feature: CategoriesContext, folderIcons
├── documents/    ← feature: DocumentEditor, DocumentsContext, codeBlock
├── components/   ← técnica: AppLayout, AppHeader, ProtectedRoute, Sidebar, modales
├── lib/          ← técnica: api.ts
└── pages/        ← técnica: Home, Document, Login, Register
```

- NORMA: **no crear `hooks/`, `stores/`, `services/`, `types/` ni `features/`.** Los hooks viven junto a su Context, los tipos junto a su cliente API.
- No hay `assets/` ni `public/`: el proyecto no tiene ni un fichero estático (ni favicon).
- Una feature nueva con estado propio sigue el patrón de `categories/`: su carpeta con el Context dentro.

## Componentes

- **100% componentes de función.** La única clase de todo el frontend es `ApiError extends Error`.
- Nombres de fichero: `PascalCase.tsx` para componentes y contexts; `camelCase.ts` para módulos sin JSX (`api.ts`, `codeBlock.ts`, `theme.ts`).
- NORMA: **siempre export nombrado, nunca `export default`.**
- Props: `interface XProps` cuando son muchas; tipado inline cuando son pocas. Ambos estilos conviven y son válidos.
- Imports de tipos con `import type` o `type` inline: `import { useState, type FormEvent } from 'react'`.
- NORMA: composición de clases CSS con array + filtro, nunca concatenando strings a mano:
  ```tsx
  const classes = ['tree-row', isSelected ? 'tree-row--selected' : ''].filter(Boolean).join(' ');
  ```
- Comentarios en español, explicando **el porqué** de las decisiones no evidentes.

## Librería de componentes: Mantine 8

NORMA: **la UI se construye con Mantine** (`@mantine/core`). Antes de escribir un componente o una regla CSS, mira si Mantine ya lo trae.

- `MantineProvider` envuelve toda la app en `main.tsx`, con el tema de `theme.ts`. El CSS de Mantine se importa **antes** de `index.css`, para que lo propio pueda ajustarlo.
- En uso hoy: `AppShell`, `Modal`, `Menu`, `Button`, `ActionIcon`, `TextInput`, `PasswordInput`, `Card`, `Paper`, `Badge`, `Checkbox`, `Radio`, `SegmentedControl`, `SimpleGrid`, `Stack`, `Group`, `Text`, `Title`, `Breadcrumbs`, `Anchor`, `Avatar`, `Tooltip`, `ScrollArea`, `Loader`, `Alert`, `Center`, `Box`, `Divider`, `ColorSwatch`, `UnstyledButton`.
- De `@mantine/hooks` se usan `useDisclosure` (el sidebar plegable) y `useLocalStorage` (el modo de vista recordado). Los demás están disponibles.
- NORMA: **no se instalan más paquetes de Mantine** (`@mantine/form`, `@mantine/dates`, `@mantine/notifications`, `@mantine/spotlight`…) sin pedirlo. Solo están `core` y `hooks`.
- NORMA: **no se envuelven los componentes de Mantine en componentes propios** (`<MyButton>`). Se usan directos, con sus props.
- Estilos puntuales: props del sistema de Mantine (`mt`, `p`, `c`, `fw`, `size`) o `style` inline. Para lo que se repite, una clase en `index.css`.

## Estado: Context + useState

NORMA: **solo React Context y `useState`.** No hay ni se instalan Zustand, Redux, Jotai, TanStack Query ni SWR.

Patrón de cada Context: un `useCallback` por acción, `useMemo` para el `value`, y un hook consumidor con guard al lado del Provider:

```tsx
export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories debe usarse dentro de <CategoriesProvider>');
  return ctx;
}
```

Los tres hooks (`useAuth`, `useCategories`, `useDocuments`) viven **junto a su Provider**, no en una carpeta `hooks/`.

Dónde se monta cada uno:

- `MantineProvider` y `AuthContext` — en `main.tsx`, envuelven toda la app (las páginas de login las necesitan).
- `CategoriesContext` y `DocumentsContext` — en `AppLayout`, es decir **dentro de la zona protegida**. No se cargan datos si no hay sesión.

DEUDA: los tres hooks llevan `// eslint-disable-next-line react-refresh/only-export-components`, que hoy **no hace nada** porque no hay ESLint configurado. No los borres: volverían a hacer falta si algún día se añade.

## Cliente API

Todo el contacto con el backend pasa por `src/lib/api.ts`. **Ningún componente llama a `fetch` directamente.**

- `fetch` nativo, **sin axios**. Una función privada `request<T>()` es el wrapper único: todo endpoint nuevo se añade ahí.
- Base: `import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'`.
- Errores: clase `ApiError extends Error` con campo `status`, para poder distinguir un 401 de un 409 en la UI. Aplana el `message` cuando Nest devuelve un array de errores de validación.
- Los tipos del contrato se exportan desde el propio `api.ts`.

Detalle interno —token, tipos, catálogo de funciones y las deudas de esta capa— en `apps/web/src/lib/CLAUDE.md`.

## Formularios

NORMA: **formularios nativos controlados**, con los campos de Mantine. No hay react-hook-form, Formik, zod, yup ni `@mantine/form`, y no se instalan.

Patrón (`LoginPage`, `RegisterPage`): un `useState` por campo, más `error: string | null` y `submitting: boolean`. La validación se delega al HTML (`required`, `type="email"`, `minLength={8}`) y al backend:

```tsx
async function onSubmit(event: FormEvent) {
  event.preventDefault();
  setError(null);
  setSubmitting(true);
  try {
    await login(email, password);
    navigate('/');
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion');
  } finally {
    setSubmitting(false);
  }
}
```

El `finally` con `setSubmitting(false)` no es opcional: sin él, un error deja el botón bloqueado.

- Los campos de Mantine exponen el valor en `e.currentTarget.value` (no `e.target.value`).
- El estado de envío va en `loading` del `<Button>`, no en un texto cambiante.
- Los errores se muestran con `<Alert color="red">`.

## Routing

`react-router-dom` 7, en modo **declarativo** (`<Routes>`/`<Route>`). NORMA: no migrar a `createBrowserRouter` ni al data router.

- `BrowserRouter` en `main.tsx`; el árbol de rutas completo en `App.tsx`.
- `/login` y `/register` redirigen a `/` si ya hay sesión.
- `<ProtectedRoute>` es un **layout route sin path**; `<AppLayout>` anida dentro y monta los providers de datos.
- `*` redirige a `/`.

Detalle de la composición en `apps/web/src/components/CLAUDE.md`.

Pendiente anotado en el plan (Fase 10.3): **no hay lazy loading**; el bundle inicial va por ~1,2 MB entre BlockNote y Mantine.

## Drag & drop

NORMA: **HTML5 Drag and Drop API nativa**, sin dnd-kit ni react-beautiful-dnd. Solo se reordena **entre hermanos del mismo padre**; cambiar de nivel se hace con el diálogo de mover.

Hoy solo existe en el sidebar; la implementación y sus deudas, en `apps/web/src/components/CLAUDE.md`.

## TypeScript y build

- `apps/web/tsconfig.json` tiene **`strict: true`** (a diferencia del de la API, que es strict parcial), más `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noEmit`, `isolatedModules`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, target ES2020.
- **Sin `paths` ni alias**: todos los imports son relativos (`../lib/api`).
- `vite.config.ts` es mínimo: solo el plugin de React y `port: 5173`. Sin proxy, sin alias, sin config de build.
- `postcss.config.cjs` lleva la config que pide Mantine: `postcss-preset-mantine` (aporta `light-dark()`) y `postcss-simple-vars` con sus breakpoints.
- El typecheck se ejecuta con `npm run build:web` (`tsc --noEmit && vite build`). Es la única verificación automática que hay.
- `index.html` va en `lang="es"`, sin favicon, y lleva **un script inline** que aplica el tema guardado antes de que monte React (ver la sección de Tema).

---

# Parte B — Diseño y CSS

## Sistema de estilos

Dos capas, en este orden:

1. **Mantine** pone los componentes y sus estilos. Es la primera opción siempre.
2. **`apps/web/src/index.css`** (~320 líneas) cubre lo que Mantine no da: los tokens del shell, el árbol del sidebar, la hoja del documento y la integración del editor.

- NORMA: **todo el CSS propio vive en ese único fichero.** No crear ficheros `.css` por componente, ni CSS Modules, ni styled-components, ni CSS-in-JS. **Tampoco Tailwind.**
- NORMA: antes de escribir CSS, comprueba que no lo resuelve un componente o una prop de Mantine.
- Convención de nombres **BEM-ish**: `bloque` y `bloque--modificador` (`tree-row--selected`, `folder-card--selected`).
- El fichero está agrupado por zonas (tokens → base → shell → árbol → vista de carpeta → documento → editor). Añade cada regla en su zona, no al final.
- NORMA: usa las **variables CSS de Mantine** (`--mantine-color-text`, `--mantine-color-dimmed`, `--mantine-radius-md`, `--mantine-font-size-sm`, `--mantine-primary-color-filled`, `--mantine-spacing-*`) en lugar de valores a mano. Así el CSS propio sigue el tema activo sin duplicar nada.

## Tokens del shell

Cinco variables propias, y **cada tema declara sus valores** — los dos juegos están escritos a mano, uno debajo del otro, para que se lean de un tirón:

```css
:root                                { --app-bg  --app-surface  --app-border  --app-hover  --app-active  --app-shadow }
[data-mantine-color-scheme='dark']   { los mismos, con tonos `--mantine-color-dark-*` }
```

| Token | Para qué |
|---|---|
| `--app-bg` | Fondo de la ventana (header y sidebar lo comparten) |
| `--app-surface` | La superficie elevada: tarjetas y la hoja del documento |
| `--app-border` | Borde de 1px de todo el shell |
| `--app-hover` / `--app-active` | Estados de las filas del árbol |
| `--app-shadow` | Sombra suave de la hoja (ninguna en oscuro) |

NORMA: si necesitas un color, usa uno de estos tokens o una variable de Mantine. **No añadas hex sueltos.**

## Catálogo de clases propias

Lo que queda de CSS a mano. Todo lo demás son componentes de Mantine.

| Clase | Modificadores | Para qué |
|---|---|---|
| `.app-header` · `.app-navbar` · `.app-main` | — | Las tres zonas del `AppShell` |
| `.crumb-current` | — | El último tramo de las migas (el actual, no pulsable) |
| `.tree-row` · `.tree-row-name` · `.tree-row-actions` · `.tree-chevron` · `.tree-list` · `.tree-scroll` | `.tree-row--selected` · `--active` · `--dragging` · `--drop-before` · `--drop-after` · `.tree-chevron--open` | Árbol del sidebar |
| `.folder-card` | `.folder-card--selected` | Tarjeta de carpeta o documento en la vista de carpeta |
| `.card-preview` | — | Extracto del documento, cortado con un degradado |
| `.row-item` | — | Fila de la vista en lista |
| `.doc-surface` · `.doc-title-input` · `.doc-editor` | — | La hoja del documento y su título |

- `.tree-row` la comparten el árbol del sidebar y el selector de destino de los diálogos de mover: misma fila, mismo aspecto.
- NORMA: **el `.tree-row` es un `<div>`, no un `<button>`**, a propósito: lleva dentro el menú de acciones, y un botón dentro de otro es HTML inválido.

## Iconos

NORMA: **`@tabler/icons-react`**, importados de uno en uno (`import { IconTrash } from '@tabler/icons-react'`) para que el tree-shaking los recorte. No se instalan lucide-react, heroicons ni react-icons, y **ya no se escriben SVG a mano**.

- NORMA: **un control que solo lleva icono necesita nombre accesible.** `aria-label` en `ActionIcon`/`Burger`; en las opciones de un `SegmentedControl`, que no aceptan `aria-label` directo, se envuelve el icono en `<span role="img" aria-label="…">`. Sin eso el control no se puede describir ni pulsar por su nombre, y el texto del `Tooltip` no cuenta como nombre accesible.
- NORMA: si el nombre accesible **se repite** en dos zonas a propósito (el "Nuevo documento" del sidebar y el del estado vacío), que sea porque hacen lo mismo. Para distinguirlos hay que acotar por zona (`.app-navbar` / `.app-main`), no renombrarlos.

- Tamaño en píxeles por prop (`size={16}`) y grosor `stroke={1.7}`-`1.8` para el shell.
- **Iconos de carpeta**: `categories/folderIcons.tsx` tiene el catálogo (20 iconos). La **clave** es lo que se guarda en `Category.icon`, no el SVG, así que el catálogo puede cambiar sin migrar datos. `<FolderIcon>` resuelve la clave y es tolerante a valores desconocidos: cae a `folder` en lugar de no pintar nada.
- **Colores de carpeta**: `FOLDER_COLORS` en `theme.ts` (13 nombres de color de Mantine). Se guarda el **nombre**, no un hex, para que Mantine elija el tono de cada tema.

## Tema

NORMA: **claro por defecto, oscuro con interruptor.** Hay un único origen de verdad, el `colorScheme` de Mantine.

- El interruptor vive en `AppHeader`: `setColorScheme` de `useMantineColorScheme()`.
- Para **leer** el tema activo se usa `useComputedColorScheme('light')`, no `colorScheme`: el guardado puede ser `'auto'` y hay que resolverlo.
- Mantine persiste la elección en `localStorage` (`mantine-color-scheme-value`) y refleja el tema en `<html data-mantine-color-scheme>`.
- NORMA: `index.html` lleva **un script inline** que aplica ese valor antes de que monte React. Sin él, al recargar en oscuro se ve un fogonazo blanco — el `<ColorSchemeScript>` de Mantine no sirve aquí porque en una SPA llega tarde. **No lo borres.**
- El editor recibe el tema por prop: `<BlockNoteView theme={colorScheme}>`.
- Excepción deliberada: los **bloques de código** llevan fondo oscuro en los dos temas, porque el tema de shiki (`github-dark-default`) es oscuro y no cambia al cambiar de tema.

## Tipografía y espaciado

- Fuente de sistema (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), declarada en `theme.ts` para textos y encabezados.
- El editor importa `@blocknote/core/fonts/inter.css`, pero se **neutraliza a propósito** con `.bn-container { font-family: inherit; }` para que todo use la fuente de sistema.
- Tamaños y espacios: la escala de Mantine (`xs`…`xl`, `--mantine-font-size-*`, `--mantine-spacing-*`). NORMA: úsala en lugar de `rem` a ojo.

## Responsive

Lo lleva el `AppShell`: por debajo del breakpoint `sm` (48em) el sidebar se **pliega** y se abre con el burger del header.

- El grid de la vista de carpeta usa los cortes de `SimpleGrid` (`base`/`xs`/`sm`/`lg`/`xl`), no media queries a mano.
- NORMA: **no escribas media queries nuevas.** Usa los breakpoints de Mantine (props responsive o `$mantine-breakpoint-*` vía PostCSS).

## Animaciones

Solo `transition` cortas (0.1s–0.15s) sobre `background-color`, `color`, `opacity`, `box-shadow` y `border-color`, más la rotación de `.tree-chevron--open`. Las transiciones de modales y menús las pone Mantine.

NORMA: **no hay `@keyframes` propios ni librerías de animación** (nada de Framer Motion). Mantenlo así.

## Integración visual de BlockNote

Con la variante **Mantine** del editor, sus menús son componentes de Mantine y **heredan el tema solos**. Por eso el bloque de integración bajó de ~175 líneas a ~30: solo se quita el fondo propio del editor (la hoja ya lo pone), se recupera la fuente de la app y se estilan los bloques de código.

NORMA: al tocar el editor, ajusta **ese bloque del final de `index.css`**. No sobrescribas estilos de BlockNote con reglas sueltas repartidas por el fichero.
