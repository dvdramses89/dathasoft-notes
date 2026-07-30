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
| Editor enriquecido | **BlockNote 0.52**, variante **Ariakit** (la de Mantine exige React 19) + `shiki` para resaltado de código |
| Estilos | **CSS global plano** en un único `apps/web/src/index.css`. Sin Tailwind ni librería de componentes |
| Navegación / datos | **react-router-dom 7** + **React Context**. Sin TanStack Query |
| Backend (API REST) | **NestJS 11 (TypeScript)** |
| ORM | **Prisma 6** |
| Base de datos | **PostgreSQL 16** (Docker en local) |
| Autenticación | **JWT + Passport** dentro de la propia API |
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
│   │       ├── main.ts · app.module.ts
│   │       ├── health/         ← controller SIN módulo (va en AppModule)
│   │       ├── prisma/         ← PrismaModule @Global
│   │       ├── users/          ← módulo SIN controller
│   │       ├── auth/           ← + decorators/ guards/ strategies/
│   │       ├── categories/
│   │       └── documents/
│   └── web/
│       ├── index.html · vite.config.ts
│       └── src/
│           ├── main.tsx · App.tsx · index.css
│           ├── auth/           ← AuthContext
│           ├── categories/     ← CategoriesContext
│           ├── documents/      ← DocumentEditor, DocumentsContext, codeBlock
│           ├── components/     ← AppLayout, ProtectedRoute, Sidebar, modales
│           ├── lib/api.ts      ← cliente HTTP + tipos
│           └── pages/
└── packages/shared/            ← vacío
```

Cada módulo de dominio usa `X.module.ts` + `X.controller.ts` + `X.service.ts` + `dto/`.

## Esquema de base de datos

**13 modelos + 2 enums**, creados en una única migración `20260726225224_init`.

- `User` · `Category` (árbol) · `Document` — los tres con módulo NestJS.
- `Tag`, `DocumentTag`, `Favorite`, `Attachment`, `DocumentReference`, `Collective`, `CollectiveMember`, `DocumentShare`, `CategoryShare` — **las tablas ya existen, pero aún no tienen módulo**: se construirán en las fases 5-9.
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
| `apps/api/src/documents/CLAUDE.md` | `fullSelect`/`listSelect`, tri-estado de `?categoryId`, `contentJson`/`contentText` |
| `apps/api/src/prisma/CLAUDE.md` | `PrismaModule` global, única puerta a la BD |
| `apps/web/src/lib/CLAUDE.md` | Cliente API: `request<T>()`, token, `ApiError`, tipos |
| `apps/web/src/documents/CLAUDE.md` | Editor BlockNote, autoguardado, cache de documentos |
| `apps/web/src/components/CLAUDE.md` | Layout, rutas protegidas, Sidebar y drag & drop |

## Git

Conventional Commits **en español y sin tildes**, con scope y referencia a la tarea del plan:
`feat(api): CRUD de categorias con modos subtree/single (Fase 3.1)`.

**1 commit = 1 subtarea de [PLAN.md](PLAN.md)**. Solo rama `main`. Detalle en `.claude/rules/git-workflow.md`.

## Entorno y variables

Toda la configuración entorno-dependiente vive en ficheros `.env`. **Nunca se hardcodea y nunca se commitea un `.env` real** — `.gitignore` ignora `.env` y `.env.*` con la excepción `!.env.example`. Cada app lleva su `.env.example`.

| Fichero | Claves |
|---|---|
| `.env` (raíz) | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` — solo para docker-compose |
| `apps/api/.env` | `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` |
| `apps/web/.env` | `VITE_API_URL` |

- Generar un `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- DEUDA: `ConfigModule.forRoot({ isGlobal: true })` va **sin `envFilePath` y sin `validationSchema`** — no se cargan `.env.development`/`.env.production` y ninguna variable es obligatoria al arrancar. Los consumidores usan defaults inline (`?? 3000`, `?? '1d'`).

## Estado y documentos relacionados

Fases **0-4 cerradas**; la siguiente es la **Fase 5** (tags + buscador).

| Documento | Para qué |
|---|---|
| [PLAN.md](PLAN.md) | **Estado de avance**: 12 fases, `[ ]` pendiente · `[~]` en curso · `[x]` hecho y validado |
| [README.md](README.md) | Presentación y arranque en local |
| [TEMPLATE.md](TEMPLATE.md) | Qué parte del repo es reutilizable como plantilla NestJS+Prisma+React+JWT |

## Funcionalidades del producto

- **Categorías = carpetas jerárquicas** (crear/renombrar/mover/borrar; sidebar en árbol). Al mover o borrar una carpeta con hijas, la app **pregunta el modo**: `subtree` (con toda su estructura) o `single` (sus hijas suben al padre inmediato). — **[hecho]**
- **Documentos** dentro de carpetas, con orden manual y drag & drop. — **[hecho]**
- **Editor BlockNote** con Markdown y resaltado de código multi-lenguaje. — **[hecho]**
- **Autenticación** de usuarios con JWT. — **[hecho]**
- **Tags** transversales y **buscador global** (título + `contentText`, full-text de Postgres, combinable con tags). — *[Fase 5]*
- **Favoritos** por usuario, con su sección en el sidebar. — *[Fase 6]*
- **Papelera**: borrado suave con restaurar / borrar definitivo. — *[Fase 6]*
- **Referenciar fuentes** en los documentos mediante bloques custom: enlace web, embed de YouTube, documento interno y adjunto de archivo. — *[Fase 7]*
- **Exportar** a Markdown y PDF; **importar** `.md` / `.txt` / `.docx` eligiendo carpeta destino. — *[Fase 8]*
- **Colectivos**: agrupar usuarios y compartir con ellos documentos sueltos o carpetas enteras (comparte el subárbol), con permiso read/edit y sección "Documentos compartidos" en el sidebar. — *[Fase 9]*

## Puntos abiertos

- **Historial de versiones**: aparcado. Se analizará más adelante (posible tabla de versiones por documento); si se aprueba, entra como fase propia antes del pulido final.
- **`packages/shared`**: sigue vacío. Compartir de verdad los tipos del contrato API entre front y back está sin planificar en ninguna fase.
