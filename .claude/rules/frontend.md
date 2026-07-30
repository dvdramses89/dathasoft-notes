# Frontend — React + diseño

Todo lo de `apps/web`. La parte A son los patrones de código; la parte B, el sistema visual. El detalle del editor BlockNote vive en `apps/web/src/documents/CLAUDE.md`.

---

# Parte A — Patrones de React

## Estructura de carpetas

Organización **híbrida deliberada**: unas carpetas son técnicas y otras son por feature.

```
src/
├── main.tsx · App.tsx · index.css · vite-env.d.ts
├── auth/         ← feature: AuthContext
├── categories/   ← feature: CategoriesContext
├── documents/    ← feature: DocumentEditor, DocumentsContext, codeBlock
├── components/   ← técnica: AppLayout, ProtectedRoute, Sidebar, modales
├── lib/          ← técnica: api.ts
└── pages/        ← técnica: Home, Document, Login, Register
```

- NORMA: **no crear `hooks/`, `stores/`, `services/`, `types/` ni `features/`.** Los hooks viven junto a su Context, los tipos junto a su cliente API.
- No hay `assets/` ni `public/`: el proyecto no tiene ni un fichero estático (ni favicon).
- Una feature nueva con estado propio sigue el patrón de `categories/`: su carpeta con el Context dentro.

## Componentes

- **100% componentes de función.** La única clase de todo el frontend es `ApiError extends Error`.
- Nombres de fichero: `PascalCase.tsx` para componentes y contexts; `camelCase.ts` para módulos sin JSX (`api.ts`, `codeBlock.ts`).
- NORMA: **siempre export nombrado, nunca `export default`.**
- Props: `interface XProps` cuando son muchas; tipado inline cuando son pocas (`function Chevron({ open }: { open: boolean })`). Ambos estilos conviven y son válidos.
- Imports de tipos con `import type` o `type` inline: `import { useState, type FormEvent } from 'react'`.
- NORMA: composición de clases CSS con array + filtro, nunca concatenando strings a mano:
  ```tsx
  const classes = ['tree-item', isSelected ? 'tree-item--selected' : ''].filter(Boolean).join(' ');
  ```
- Comentarios en español, explicando **el porqué** de las decisiones no evidentes.

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

- `AuthContext` — en `main.tsx`, envuelve toda la app (las páginas de login la necesitan).
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

NORMA: **formularios nativos controlados.** No hay react-hook-form, Formik, zod ni yup, y no se instalan.

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

## Routing

`react-router-dom` 7, en modo **declarativo** (`<Routes>`/`<Route>`). NORMA: no migrar a `createBrowserRouter` ni al data router.

- `BrowserRouter` en `main.tsx`; el árbol de rutas completo en `App.tsx`.
- `/login` y `/register` redirigen a `/` si ya hay sesión.
- `<ProtectedRoute>` es un **layout route sin path**; `<AppLayout>` anida dentro y monta los providers de datos.
- `*` redirige a `/`.

Detalle de la composición en `apps/web/src/components/CLAUDE.md`.

Pendiente anotado en el plan (Fase 10): **no hay lazy loading**; el bundle pasa de 1 MB por BlockNote.

## Drag & drop

NORMA: **HTML5 Drag and Drop API nativa**, sin dnd-kit ni react-beautiful-dnd. Solo se reordena **entre hermanos del mismo padre**; cambiar de nivel se hace con el modal de mover.

Hoy solo existe en el sidebar; la implementación y sus deudas, en `apps/web/src/components/CLAUDE.md`.

## TypeScript y build

- `apps/web/tsconfig.json` tiene **`strict: true`** (a diferencia del de la API, que es strict parcial), más `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noEmit`, `isolatedModules`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, target ES2020.
- **Sin `paths` ni alias**: todos los imports son relativos (`../lib/api`).
- `vite.config.ts` es mínimo: solo el plugin de React y `port: 5173`. Sin proxy, sin alias, sin config de build.
- El typecheck se ejecuta con `npm run build:web` (`tsc --noEmit && vite build`). Es la única verificación automática que hay.
- `index.html` tiene 11 líneas, `lang="es"`, sin favicon ni metadatos.

---

# Parte B — Diseño y CSS

## Sistema de estilos

NORMA: **todo el CSS de la aplicación vive en un único fichero**, `apps/web/src/index.css` (~936 líneas), importado una sola vez desde `main.tsx`.

- **No hay Tailwind, ni shadcn/ui, ni CSS Modules, ni styled-components, ni CSS-in-JS.** No se instalan.
- NORMA: **no crear ficheros `.css` por componente.** El estilo nuevo se añade a `index.css`.
- Convención de nombres **BEM-ish**: `bloque` y `bloque--modificador` (`tree-item--selected`, `btn--danger`, `modal--wide`).
- El fichero está agrupado por zonas (base → formularios → botones → shell → sidebar → árbol → modales → documento → editor). Añade cada regla en su zona, no al final.

## Tokens de color

Variables CSS en `:root` (paleta Slate/Indigo escrita a mano):

```css
--bg: #0f172a       --card: #1e293b     --text: #e2e8f0    --muted: #94a3b8
--ok: #22c55e       --error: #ef4444    --accent: #6366f1
```

NORMA: usa el token siempre que exista uno para lo que necesitas.

DEUDA: hay bastantes colores hardcodeados fuera de los tokens — `#0b1220` (fondo del sidebar), los indigos claros `#818cf8` / `#a5b4fc` / `#e0e7ff`, `#cbd5e1`, `#243149`, `#16223c` y varios `rgba(148,163,184,·)` para bordes. No amplíes la lista, pero tampoco la refactorices por iniciativa propia.

## Catálogo de clases

**Esto es lo que sustituye a la librería de componentes que no existe. Consúltalo antes de escribir CSS nuevo.**

| Clase | Modificadores | Para qué |
|---|---|---|
| `.btn` | `--ghost` · `--danger` · `--sm` | Botones. `--danger` es el rojo de las acciones destructivas |
| `.card` | — | Contenedor con fondo `--card` y borde |
| `.badge` | `--loading` · `--ok` · `--error` | Estados breves (el "Cargando…" de `ProtectedRoute`) |
| `.form` · `.field` · `.field-hint` · `.form-error` | — | Formularios: contenedor, campo con label, ayuda y error |
| `.modal-overlay` · `.modal` · `.modal-title` · `.modal-text` · `.modal-actions` · `.modal-cancel` | `.modal--wide` · `.modal-actions--stack` | Diálogos |
| `.tree` · `.tree-item` · `.tree-children` · `.tree-name` · `.tree-chevron` · `.tree-actions` · `.tree-action` · `.tree-empty` · `.tree-hint` | `.tree-item--selected` · `--active` · `--dragging` · `--drop-before` · `--drop-after` | Árbol del sidebar |
| `.dest-tree` · `.dest-item` | `.dest-item--selected` | Selector de carpeta destino en los modales de mover |
| `.radio` · `.move-mode` | — | Elegir modo `subtree` / `single` |
| `.app-shell` · `.sidebar` · `.content` · `.content-inner` | — | Layout general |
| `.sidebar-top` · `.sidebar-title` · `.sidebar-footer` · `.sidebar-user` · `.avatar` | — | Cabecera y pie del sidebar |
| `.add-folder` · `.add-folder-input` · `.add-folder-actions` · `.rename-input` | — | Crear y renombrar en línea |
| `.doc-header` · `.doc-title-input` · `.doc-editor` · `.save-indicator` | `.save-indicator--saved` · `--error` | Vista de documento |
| `.icon-btn` · `.chevron` · `.folder-icon` · `.doc-icon` | `.chevron--open` | Iconos y botones de icono |

NORMA: **no existen componentes UI genéricos** (`<Button>`, `<Input>`, `<Modal>`). Se usan elementos nativos con estas clases. No introduzcas una capa de componentes sin pedirlo.

## Iconos

NORMA: **SVG inline escritos a mano, sin librería.** No se instalan lucide-react, heroicons ni react-icons.

Los seis existentes (`FolderIcon`, `DocIcon`, `Chevron`, `PencilIcon`, `TrashIcon`, `MoveIcon`) están definidos como componentes locales al principio de `Sidebar.tsx`. Dos "iconos" son caracteres literales: `+` para nueva carpeta y `⎋` para cerrar sesión.

Icono nuevo → SVG inline con el mismo estilo (`stroke="currentColor"`, tamaño en `em`).

## Tema

NORMA: **dark-only, sin toggle.** No hay `prefers-color-scheme`, ni clase `.dark`, ni estado de tema. El editor va forzado con `theme="dark"`. No añadas modo claro sin pedirlo.

`color-scheme: light dark` está declarado en `:root`, pero no existe paleta clara.

## Tipografía y espaciado

- Fuente de sistema: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- El editor importa `@blocknote/core/fonts/inter.css`, pero se **neutraliza a propósito** con `.bn-root.dark { font-family: inherit; }` para que todo use la fuente de sistema.
- DEUDA: los tamaños están en `rem` ad-hoc (0.72, 0.75, 0.78, 0.82, 0.85, 0.88, 0.9, 0.95, 1.1, 1.6, 2.25…), **sin escala tipográfica formal**.

## Responsive

Prácticamente inexistente y **no es prioridad**: hay **una sola media query**, que por debajo de 640px estrecha el sidebar de 264px a 210px y reduce el padding del contenido.

El `.app-shell` es `position: fixed; inset: 0; display: flex`. No hay sidebar colapsable ni layout móvil. NORMA: no rehagas el layout en responsive sin que el usuario lo pida.

## Animaciones

Solo `transition` cortas (0.05s–0.15s) sobre `background`, `color`, `opacity`, `box-shadow`, `border-color` y `transform`. La única rotación es `.chevron--open`.

NORMA: **no hay `@keyframes` ni librerías de animación** (nada de Framer Motion). Mantenlo así.

## Integración visual de BlockNote

El último tramo de `index.css` (~175 líneas) remapea las variables `--bn-colors-*` de BlockNote/Ariakit a la paleta de la app, y corrige a mano la barra de formato flotante de Ariakit (que venía con `overflow: scroll` y botones de 2.5rem).

NORMA: al tocar el editor, ajusta **ese bloque**. No sobrescribas estilos de BlockNote con reglas sueltas repartidas por el fichero.

## Deuda de diseño

- DEUDA: el markup del modal está **duplicado a mano en varios sitios** (detalle en `apps/web/src/components/CLAUDE.md`). Lo natural sería extraer un `<Modal>`, pero **no lo hagas sin pedirlo**: choca con la norma de no crear componentes UI genéricos y es una decisión del usuario.
