# DTNotes — Repositorio de documentación del equipo DathaSoft

**DTNotes** (DT = DaThaSoft) es una aplicación web para gestionar, consultar, modificar, exportar, formatear y referenciar documentación y notas de cualquier tipo u origen, organizadas por **categorías** (carpetas jerárquicas) y **tags** (búsqueda). Inspirada en Craft / OneNote / Evernote, pero **sin complejidad excesiva**.

> Fuente de verdad del **contexto** del proyecto. Las **normas de código** viven en `.claude/rules/` y lo específico de cada módulo, en el `CLAUDE.md` de su carpeta.

## Cómo leer esta memoria

Las reglas usan dos marcas:

- **NORMA** — Convención vigente. Si escribes código nuevo, replícala.
- **DEUDA** — Está así a propósito. No la imites en código nuevo, pero **tampoco la refactorices sin que el usuario lo pida**.

> Si vas a cambiar algo marcado **DEUDA**, pregunta antes.

Lo que aún no existe no se marca en las reglas: su estado vive en [PLAN.md](PLAN.md).

## Comandos

Desde la **raíz** del repo:

| Comando | Qué hace |
|---|---|
| `npm install` | Instala todo el monorepo (workspaces) |
| `npm run db:up` / `db:down` | Levanta / para Postgres en Docker |
| `npm run dev:api` | API en modo watch → `http://localhost:3000/api` |
| `npm run dev:web` | SPA de Vite → `http://localhost:5173` |
| `npm run build:api` / `build:web` | Build de cada app |

Desde **`apps/api`**: `npm run prisma:generate`, `prisma:migrate` (= `prisma migrate dev`), `prisma:studio`, `db:validate`, `db:format`.

- NORMA: **no existe `npm run lint`, `format` ni `test`** en ningún workspace. La comprobación de tipos se hace con `build:api` (`nest build`) y `build:web` (`tsc --noEmit && vite build`) — son la única red de seguridad automática que hay.
- `engines.node >= 18`.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend (SPA) | **React 18 + Vite 8 + TypeScript 5.9** |
| Componentes UI | **Mantine 8** (`@mantine/core` + `@mantine/hooks`) + **`@tabler/icons-react`** |
| Editor enriquecido | **BlockNote 0.52**, variante **Mantine** (`@blocknote/mantine`) + `shiki` para resaltado de código |
| Estilos | Componentes de **Mantine** + un único `apps/web/src/index.css` (~320 líneas) para lo que no cubren. Sin Tailwind ni CSS Modules |
| Tema | **Claro por defecto, oscuro con interruptor.** Un solo origen de verdad: el `colorScheme` de Mantine, que sigue también el editor |
| Navegación / datos | **react-router-dom 7** + **React Context**. Sin TanStack Query |
| Backend (API REST) | **NestJS 11 (TypeScript)** |
| ORM | **Prisma 6** |
| Base de datos | **PostgreSQL 16** (Docker en local) |
| Autenticación | **JWT + Passport** dentro de la propia API |
| Endurecimiento | **`helmet`** (cabeceras) + **`@nestjs/throttler`** (rate limiting solo en login y registro) |
| Tareas programadas | **`@nestjs/schedule`** — una sola: la purga diaria de la papelera |
| Repo / IDE | GitHub (`https://github.com/dvdramses89/dathasoft-notes.git`) + VS Code |
| Despliegue | **Zeabur** — decidido pero **aún sin configurar** (Fase 11) |

## Arquitectura

Monorepo con **npm workspaces**. SPA → API REST bajo el prefijo `/api` → PostgreSQL vía Prisma.

- `apps/api` — NestJS. Un **feature-module por dominio** directamente bajo `src/`. La autorización vive en la capa de servicio (ver `.claude/rules/security.md`).
- `apps/web` — React SPA. Organización **híbrida**: `pages/` y `components/` técnicas; `auth/`, `categories/` y `documents/` por feature, cada una con su Context.
- `packages/shared` — **vacío**, solo contiene un README. DEUDA: los tipos del contrato API están duplicados a mano en `apps/web/src/lib/api.ts`; no hay generación ni compartición real de tipos.

## Estructura del proyecto

```
dathasoft-notes/
├── CLAUDE.md · PLAN.md · README.md · TEMPLATE.md · LICENSE
├── docker-compose.yml          ← solo Postgres 16
├── package.json                ← workspaces + scripts raíz
├── .claude/rules/              ← normas de código (se cargan con @import)
├── apps/
│   ├── api/
│   │   ├── prisma/{schema.prisma, migrations/}
│   │   └── src/
│   │       ├── main.ts · app.module.ts · env.validation.ts
│   │       ├── health/         ← controller SIN módulo (va en AppModule)
│   │       ├── prisma/         ← PrismaModule @Global
│   │       ├── users/          ← módulo SIN controller
│   │       ├── auth/           ← + decorators/ guards/ strategies/
│   │       ├── categories/
│   │       ├── documents/
│   │       ├── tags/          ← DOS controllers: /tags y /documents/:id/tags
│   │       ├── favorites/     ← DOS controllers: /favorites y /documents/:id/favorite
│   │       └── trash/         ← papelera + la unica tarea programada (purga diaria)
│   └── web/
│       ├── index.html · vite.config.ts · postcss.config.cjs
│       └── src/
│           ├── main.tsx · App.tsx · index.css · theme.ts
│           ├── auth/           ← AuthContext
│           ├── categories/     ← CategoriesContext, folderIcons
│           ├── documents/      ← DocumentEditor, DocumentsContext, codeBlock, webLinkBlock, youtubeBlock
│           ├── tags/           ← TagsContext, TagChips, TagPicker
│           ├── favorites/      ← FavoritesContext, FavoriteStar, FavoritesSection
│           ├── trash/          ← TrashContext
│           ├── components/     ← AppShell (layout + header), Sidebar, modales
│           ├── lib/api.ts      ← cliente HTTP + tipos
│           └── pages/
└── packages/shared/            ← vacío
```

- `theme.ts` — tema de Mantine: paleta de marca, radios, y los catálogos de **colores** e **iconos** que puede tener una carpeta.
- `postcss.config.cjs` — la config que pide Mantine (`light-dark()` y sus breakpoints).

Cada módulo de dominio usa `X.module.ts` + `X.controller.ts` + `X.service.ts` + `dto/`.

## Esquema de base de datos

**13 modelos + 2 enums**, creados en una única migración `20260726225224_init`.

- `User` · `Category` (árbol) · `Document` · `Tag` + `DocumentTag` · `Favorite` — con módulo NestJS (`Tag` y `DocumentTag` comparten el módulo `tags`).
- `Attachment`, `DocumentReference`, `Collective`, `CollectiveMember`, `DocumentShare`, `CategoryShare` — **las tablas ya existen, pero aún no tienen módulo**: se construirán en las fases 7-9.
- Enums: `MemberRole {MEMBER, ADMIN}`, `SharePermission {READ, EDIT}`.
- PK `uuid` nativo, soft-delete solo en `Category` y `Document`, y búsqueda full-text con una columna `searchVector` generada por la propia BD.

> Los campos exactos están en `apps/api/prisma/schema.prisma` (fuente de verdad). Las convenciones y las trampas, en `.claude/rules/database.md`.

## Reglas de código

@.claude/rules/project-workflow.md
@.claude/rules/git-workflow.md
@.claude/rules/security.md
@.claude/rules/backend.md
@.claude/rules/database.md
@.claude/rules/frontend.md
@.claude/rules/testing.md

Transversales, que no encajan en ninguna regla concreta:

- **No hay ESLint ni Prettier** en todo el repo. El estilo se mantiene a mano y es consistente: comillas simples, punto y coma, trailing commas, 2 espacios, ~100 columnas.
- **Comentarios en español**, mayormente **sin tildes** en el código; los **mensajes de error dirigidos al usuario sí llevan tildes** ("Categoría no encontrada").
- **`async/await` siempre. Cero `.then()`**, cero callbacks.
- **Imports relativos**, sin alias ni `paths` en ningún tsconfig.
- Ficheros `kebab-case` con sufijo de rol en la API; `PascalCase.tsx` para componentes React.

## Memorias por módulo

Se cargan **solas** al leer o editar un fichero de ese directorio, así que no ocupan contexto el resto del tiempo:

| Módulo | Qué documenta |
|---|---|
| `apps/api/src/auth/CLAUDE.md` | Flujo registro/login/me, `JwtPayload`, `@CurrentUser()`, `toPublicUser()` |
| `apps/api/src/categories/CLAUDE.md` | Árbol, semántica `subtree` vs `single`, ciclos, contrato de `reorder` |
| `apps/api/src/documents/CLAUDE.md` | `fullSelect`/`listSelect`, tri-estado de `?categoryId`, `contentJson`/`contentText`, tags y `isFavorite` en las respuestas |
| `apps/api/src/tags/CLAUDE.md` | Asignación por nombre, unicidad sin distinguir mayúsculas, quitar vs borrar |
| `apps/api/src/favorites/CLAUDE.md` | Idempotencia de marcar/desmarcar, orden por fecha de marcado, favoritos y papelera |
| `apps/api/src/trash/CLAUDE.md` | Lote de borrado, restaurar a la raíz, borrado físico y purga diaria |
| `apps/api/src/prisma/CLAUDE.md` | `PrismaModule` global, única puerta a la BD |
| `apps/web/src/lib/CLAUDE.md` | Cliente API: `request<T>()`, token, `ApiError`, tipos |
| `apps/web/src/documents/CLAUDE.md` | Editor BlockNote, autoguardado, cache de documentos |
| `apps/web/src/tags/CLAUDE.md` | Catálogo de tags, `resolve()`, selector por nombre del documento |
| `apps/web/src/favorites/CLAUDE.md` | Estrella, sección del sidebar, marca optimista y `isFavorite()` |
| `apps/web/src/trash/CLAUDE.md` | Contador del sidebar, por qué no hay optimismo, quién avisa a quién |
| `apps/web/src/components/CLAUDE.md` | Layout, rutas protegidas, Sidebar, drag & drop y diálogos |

## Git

Conventional Commits **en español y sin tildes**, con scope y referencia a la tarea del plan:
`feat(api): CRUD de categorias con modos subtree/single (Fase 3.1)`.

**1 commit = 1 subtarea de [PLAN.md](PLAN.md)**. Solo rama `main`. Detalle en `.claude/rules/git-workflow.md`.

## Entorno y variables

Toda la configuración entorno-dependiente vive en ficheros `.env`. **Nunca se hardcodea y nunca se commitea un `.env` real** — `.gitignore` ignora `.env` y `.env.*` con la excepción `!.env.example`. Cada app lleva su `.env.example`.

| Fichero | Claves |
|---|---|
| `.env` (raíz) | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` — solo para docker-compose |
| `apps/api/.env` | `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `THROTTLE_*`, `TRASH_RETENTION_DAYS` |
| `apps/web/.env` | `VITE_API_URL` |

- Generar un `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Las variables de la API **se validan al arrancar** con `class-validator` en `apps/api/src/env.validation.ts` (`ConfigModule.forRoot({ validate })`). `DATABASE_URL` y `JWT_SECRET` son obligatorias siempre, y `CORS_ORIGINS` lo es **solo si `NODE_ENV=production`**; `PORT`, `NODE_ENV` y `JWT_EXPIRES_IN` son opcionales y mantienen su default inline en el consumidor (`?? 3000`, `?? '1d'`).
- DEUDA: `ConfigModule.forRoot()` va **sin `envFilePath`** — no se cargan `.env.development` ni `.env.production`, solo `.env`.
- En el `.env` local de desarrollo, `THROTTLE_REGISTER_LIMIT` está subido a 200: el default de 3 altas/hora bloquea las comprobaciones que registran usuarios de prueba. Como ese fichero no se commitea, **producción conserva el default**.

## Estado y documentos relacionados

Fases **0-4 cerradas**, más el endurecimiento de seguridad de la **Fase 4.5** y el rediseño visual de la **Fase 4.6**. Cerradas también la **Fase 5** (tags + buscador global) y la **Fase 6** (favoritos + papelera). En curso la **Fase 7** (referencias externas en los documentos): hechos los bloques de enlace web y de embed de YouTube, pendientes la referencia a documento interno y el adjunto de archivo.

| Documento | Para qué |
|---|---|
| [PLAN.md](PLAN.md) | **Estado de avance**: 12 fases, `[ ]` pendiente · `[~]` en curso · `[x]` hecho y validado |
| [README.md](README.md) | Presentación y arranque en local |
| [TEMPLATE.md](TEMPLATE.md) | Qué parte del repo es reutilizable como plantilla NestJS+Prisma+React+JWT |

## Funcionalidades del producto

- **Categorías = carpetas jerárquicas** (crear/renombrar/mover/borrar; sidebar en árbol), cada una con **icono y color** propios. Al mover o borrar una carpeta con hijas, la app **pregunta el modo**: `subtree` (con toda su estructura) o `single` (sus hijas suben al padre inmediato). — **[hecho]**
- **Documentos** dentro de carpetas, con orden manual y drag & drop. — **[hecho]**
- **Vista de carpeta** en tres modos (tarjetas con vista previa, compacta, lista), con selección múltiple y acciones en lote. — **[hecho]**
- **Editor BlockNote** con Markdown y resaltado de código multi-lenguaje. — **[hecho]**
- **Autenticación** de usuarios con JWT. — **[hecho]**
- **Tema claro y oscuro** con interruptor. — **[hecho]**
- **Tags** transversales: se asignan escribiendo el nombre en el documento (se crean solos), se ven como chips en la vista de carpeta y se gestionan —nombre, color, eliminar— en el diálogo «Etiquetas» del menú de cuenta. — **[hecho]**
- **Buscador global** en la cabecera (Ctrl+K): full-text de Postgres sobre título y contenido, ordenado por relevancia, combinable con **filtro por tags en modo Y**. La búsqueda vive en la URL (`/search?q=&tags=`). — **[hecho]**
- **Favoritos** por usuario: estrella en la hoja del documento, en la vista de carpeta y en el menú del sidebar, con una sección «Favoritos» arriba del árbol que **solo aparece si hay alguno**, ordenada del último marcado al primero. — **[hecho]**
- **Papelera** de documentos **y carpetas**, con su entrada al final del sidebar (con contador) y su página `/trash`: restaurar (una carpeta vuelve con todo lo que se borró con ella), eliminar definitivamente y vaciar, por elemento o en selección múltiple. Lo que lleva más de 30 días se purga solo. — **[hecho]**
- **Referenciar fuentes** en los documentos mediante bloques custom, insertables desde el menú `/` en el grupo «Referencias»: **enlace web** (tarjeta con etiqueta y dominio) y **embed de YouTube** (reproductor 16:9 incrustado, sobre `youtube-nocookie.com`) — **[hechos]**; documento interno y adjunto de archivo — *[fases 7.3 y 7.4]*.
  - Los bloques nativos de **«Medios»** de BlockNote (imagen, vídeo, audio, archivo) funcionan **por URL**; la subida de ficheros llega con la 7.4.
- **Exportar** a Markdown y PDF; **importar** `.md` / `.txt` / `.docx` eligiendo carpeta destino. — *[Fase 8]*
- **Colectivos**: agrupar usuarios y compartir con ellos documentos sueltos o carpetas enteras (comparte el subárbol), con permiso read/edit y sección "Documentos compartidos" en el sidebar. — *[Fase 9]*

## Puntos abiertos

- **Historial de versiones**: aparcado. Se analizará más adelante (posible tabla de versiones por documento); si se aprueba, entra como fase propia antes del pulido final.
- **`packages/shared`**: sigue vacío. Compartir de verdad los tipos del contrato API entre front y back está sin planificar en ninguna fase.
