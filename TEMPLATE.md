# Plantilla reutilizable — NestJS + Prisma + React + Auth

Este proyecto sirve además como **plantilla base** para arrancar nuevas aplicaciones con el stack:
**NestJS (API REST) + Prisma + PostgreSQL + React (Vite) + autenticación JWT completa**, en un monorepo con Docker Compose.

> DTNotes es la app concreta construida sobre esta base. La **capa de arranque** (stack + auth + infra) es genérica y reutilizable; lo único específico de DTNotes es el **modelo de datos** (`schema.prisma`) y el branding.

## Qué incluye la base (todo verificado y funcionando)

- **Monorepo** con workspaces (`apps/api`, `apps/web`, `packages/shared`) y scripts raíz (`dev:api`, `dev:web`, `build:*`, `db:up`, `db:down`).
- **PostgreSQL** en `docker-compose.yml` + Prisma (migraciones) + `.env`/`.env.example` por app.
- **API (NestJS 11 / TypeScript 5)**: prefijo `/api`, CORS, `ConfigModule` global, `ValidationPipe` global, `PrismaModule`/`PrismaService`, health (`/api/health`, `/api/health/db`).
- **Auth completa**: registro (`bcryptjs`), login **JWT** (`@nestjs/jwt`), guard `passport-jwt`, `@CurrentUser`, ruta protegida `/api/auth/me`.
- **Web (React 18 + Vite + TS)**: `react-router-dom`, `AuthContext` (token en `localStorage`, revalidación con `/me`, auto-login tras registro), `ProtectedRoute`, páginas Login/Register/Home y cliente API con Bearer + `ApiError`.

## Genérico vs. específico de DTNotes

| Parte | ¿Reutilizable tal cual? |
|---|---|
| Estructura monorepo, scripts, `.gitignore`, `.env.example` | ✅ Genérico |
| `docker-compose.yml` (Postgres) | ✅ Genérico (renombrar contenedor/BD) |
| `apps/api/src/{main,app.module,config}` | ✅ Genérico |
| `apps/api/src/prisma/*` (Prisma module/service) | ✅ Genérico |
| `apps/api/src/health/*` | ✅ Genérico |
| `apps/api/src/auth/*` y `apps/api/src/users/*` | ✅ Genérico |
| `apps/web/*` (auth, rutas, cliente API) | ✅ Genérico (cambiar branding "DTNotes") |
| **`apps/api/prisma/schema.prisma`** | ⚠️ **Solo `User` es genérico.** El resto (Category, Document, Tag, DocumentTag, Favorite, Attachment, DocumentReference, Collective, CollectiveMember, DocumentShare, CategoryShare) y los enums (MemberRole, SharePermission) son **de DTNotes** → recortar. |
| **`apps/api/prisma/migrations/*`** | ⚠️ Regenerar (la migración `init` crea las tablas de DTNotes + el `searchVector`). |
| `CLAUDE.md`, `PLAN.md`, `README.md`, branding del `HomePage` | ⚠️ Específico de DTNotes → reescribir. |

> Nota clave: **el código TypeScript de la API es hoy 100% genérico** (solo `auth`, `users`, `health`, `prisma`). No hay que borrar módulos de dominio porque todavía no existen; lo único que arrastra dominio es el esquema de la BD.

## Receta para arrancar un proyecto NUEVO desde esta base

1. **Copiar** el contenido del repo a una carpeta nueva (sin el `.git`) e **iniciar un repo nuevo** (`git init` + nuevo remoto en GitHub).
2. **Renombrar**: `name` en los `package.json` (raíz y apps), `container_name`/`POSTGRES_DB`/`POSTGRES_USER` en `docker-compose.yml` y las credenciales de los `.env`.
3. **Recortar `apps/api/prisma/schema.prisma`** dejando solo `User` (y los enums/modelos que el nuevo proyecto sí necesite). Eliminar los modelos de DTNotes.
4. **Regenerar la migración**: borrar `apps/api/prisma/migrations/` y crear una limpia:
   ```
   npm run db:up
   cd apps/api && npx prisma migrate dev --name init
   ```
   (Si el nuevo proyecto no usa full-text search, no hace falta el paso manual del `searchVector`.)
5. **Reescribir la documentación**: `CLAUDE.md`, `PLAN.md`, `README.md` y el branding "DTNotes" del frontend (`HomePage`, `index.html`, `README`).
6. Copiar `.env.example` → `.env` en raíz y en `apps/api` / `apps/web`, generar un `JWT_SECRET` nuevo:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
7. `npm install` en la raíz y listo: `npm run dev:api` + `npm run dev:web`.

## Mejoras habituales pendientes (no incluidas en la base)

- **Refresh token** (ahora solo access token con expiración).
- Roles/permores globales, rate limiting, logging estructurado, tests e2e.
- Endpoint de logout con invalidación (si se añade refresh token / lista negra).
