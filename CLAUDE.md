# DTNotes — Repositorio de documentación del equipo DathaSoft

**DTNotes** (DT = DaThaSoft) es una aplicación web para gestionar, consultar, modificar, exportar, formatear y referenciar documentación y notas de cualquier tipo u origen, organizadas por **categorías** (carpetas jerárquicas) y **tags** (búsqueda). Inspirada en Craft / OneNote / Evernote, pero **sin complejidad excesiva**.

> Este archivo es la fuente de verdad del proyecto para futuras sesiones. Manténlo actualizado cuando cambien decisiones.

## Stack tecnológico (decidido)

| Capa | Tecnología |
|---|---|
| Frontend (SPA) | **React 18 + Vite + TypeScript** |
| Editor enriquecido | **BlockNote** (sobre TipTap/ProseMirror) — UX tipo Craft/Notion, Markdown import/export nativo, bloques custom para referencias |
| UI | Tailwind CSS + shadcn/ui |
| Navegación / datos | React Router + TanStack Query |
| Backend (API REST) | **NestJS (TypeScript)** |
| ORM | **Prisma** |
| Base de datos | **PostgreSQL** |
| Autenticación | JWT + Passport (dentro de la propia API) |
| Repo / IDE | GitHub (`https://github.com/dvdramses89/dathasoft-notes.git`) + VS Code |
| Despliegue | **Zeabur** — un solo proyecto: servicios `web` + `api` + `postgres` (gratis, sin caducar) |

## Estructura del repositorio (monorepo)

```
dathasoft-notes/
├── CLAUDE.md                     ← este archivo
├── package.json                  ← workspaces
├── apps/
│   ├── web/                      ← Frontend SPA (React + Vite + BlockNote)
│   │   └── src/{components,features,pages,lib}
│   └── api/                      ← Backend NestJS (REST)
│       ├── src/modules/{auth,users,documents,categories,tags,collectives,import,export}
│       └── prisma/schema.prisma
├── packages/
│   └── shared/                   ← tipos TS compartidos front/back
└── .github/workflows/            ← CI opcional
```

## Modelo de datos

```
User          id · email · passwordHash · name · createdAt

Category      id · name · color · parentId(→Category|null) · position · ownerId
                └─ ÁRBOL de carpetas/subcarpetas (estilo Craft), N niveles, orden manual (position)

Document      id · title · contentJson(JSONB, doc de BlockNote) · contentText(búsqueda)
                · categoryId · ownerId · createdAt · updatedAt · deletedAt(|null → papelera)

Tag           id · name · color · ownerId
DocumentTag   documentId · tagId            (N:M → búsqueda enriquecida por tags)

Favorite      userId · documentId · createdAt    (favoritos por usuario)

Attachment    id · documentId(|null) · fileName · mimeType · storageRef · ownerId
                └─ archivos importados/referenciados (docx, pdf, etc.)

Collective    id · name · description · ownerId
CollectiveMember  collectiveId · userId · role(member|admin)
DocumentShare     documentId · collectiveId · permission(read|edit)
CategoryShare     categoryId · collectiveId · permission(read|edit)
                └─ compartir DOCUMENTOS sueltos o CARPETAS/subcarpetas enteras con colectivos.
                   Compartir una categoría comparte su subárbol (documentos y subcarpetas).
                   Lo compartido aparece en la sección "Documentos compartidos" del sidebar.
```

## Funcionalidades clave (requisitos)

- **Categorías = carpetas jerárquicas gestionables** (crear/renombrar/mover/borrar; sidebar en árbol tipo Craft).
- **Tags = búsqueda enriquecida** transversal, combinable con búsqueda de texto (`contentText`).
- **Buscador global**: busca en título + `contentText` (Postgres full-text) y filtra por tags/carpetas.
- **Favoritos**: marcar documentos como favoritos (por usuario) con su sección en el sidebar.
- **Papelera**: borrado suave (`deletedAt`) con sección en el sidebar para restaurar o borrar definitivamente.
- **Editor (BlockNote)** con Markdown y **resaltado de código multi-lenguaje**.
- **Referenciar fuentes externas** dentro de los documentos (bloques custom de BlockNote):
  - Otros documentos internos del repositorio.
  - Archivos importados/guardados en cualquier formato (docx, pdf…).
  - Enlaces a sitios web.
  - Vídeos de YouTube (embed).
- **Exportar** cada documento a **PDF** o **Markdown**.
- **Importar** documentación externa en **Markdown / TXT / DOCX**, eligiendo la **subcarpeta (categoría) destino**.
- **Autenticación** de usuarios (JWT).
- **Colectivos**: agrupar usuarios registrados y **compartir con esos colectivos** para que sea **visible por varios usuarios**. Se puede compartir tanto **documentos sueltos** como **carpetas/subcarpetas enteras** (comparte el subárbol).
- **Sidebar estilo Craft**: el menú lateral izquierdo incluye una sección **"Documentos compartidos"** donde a cada usuario le aparece lo que se ha compartido con sus colectivos, además de su árbol de carpetas propio.

## Reglas de trabajo

- **Método de entrega**: plan de desarrollo local en **tareas pequeñas, concretas y validables en local**, entregadas **una a una y al ritmo del usuario**. No adelantar fases sin que las pida.
- **Nada inventado**: si falta un dato (contenido, credenciales, decisiones), preguntar; no asumir.
- Todo pasa por **GitHub** con control de versiones; se desarrolla y prueba **en local** antes de desplegar en Zeabur.

## Configuración (variables de entorno)

Toda la configuración entorno-dependiente vive en **archivos `.env`**, reutilizables en todo el proyecto y fáciles de sustituir entre entornos (**dev / prod**). Nunca se hardcodea; nunca se commitea un `.env` real (solo `.env.example`).

- **API (NestJS)**: `@nestjs/config` cargando `.env` / `.env.development` / `.env.production`. Claves previstas:
  - `DATABASE_URL` (Postgres), `JWT_SECRET`, `PORT`, `NODE_ENV`.
  - **Almacenamiento de archivos** (attachments importados): `STORAGE_DRIVER` (`local` | `s3`/objeto), `STORAGE_LOCAL_PATH`, y credenciales/bucket/endpoint del proveedor de objetos cuando aplique. Así en dev puede ser disco local y en prod objeto, cambiando solo el `.env`.
- **Web (Vite)**: variables con prefijo `VITE_` (p. ej. `VITE_API_URL`) en `.env` propios del front.
- Cada app lleva su `.env.example` documentando las claves.

## Puntos abiertos / a decidir más adelante

- **Historial de versiones**: aparcado, a analizar más adelante (posible campo/tabla de versiones por documento).

## Plan de desarrollo

Ver [PLAN.md](PLAN.md) — plan por fases y tareas pequeñas, validables en local una a una, con subida a GitHub por hitos y el despliegue en Zeabur al final.
