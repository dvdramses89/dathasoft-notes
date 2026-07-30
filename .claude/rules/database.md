# Base de datos — Prisma + PostgreSQL

Los campos exactos están en `apps/api/prisma/schema.prisma`, que es la **fuente de verdad**. Aquí va lo que el esquema no dice: las convenciones, el porqué de cada decisión y las trampas.

## Prisma y migraciones

- **Prisma 6** sobre **PostgreSQL 16** (`postgres:16-alpine` en `docker-compose.yml`, contenedor `dtnotes-postgres`, volumen `dtnotes_pgdata`, con healthcheck `pg_isready`).
- Flujo normal en local: `npm run db:up` en la raíz → `npm run prisma:migrate` en `apps/api` (es `prisma migrate dev`).
- **Una sola migración**: `20260726225224_init`, que crea las 13 tablas de golpe.
- NORMA: **no hay `seed.ts`** ni `prisma.seed` configurado. Los datos de prueba se crean por la API.
- NORMA: **no existe script de `prisma migrate deploy`**. Hará falta para producción (Fase 11); hasta entonces, no añadirlo.

> Decisión ya tomada, importante para las fases 5-9: **el esquema completo se creó de una vez**. Las tablas de tags, favoritos, adjuntos, referencias y colectivos **ya existen**. Esas fases solo construyen la API y la UI encima; **no vuelven a tocar el esquema** salvo ajustes puntuales.

## Convenciones del esquema

- NORMA: PK simples siempre `String @id @default(uuid()) @db.Uuid` — UUID nativo de Postgres, **no `cuid`**, no autoincremental.
- NORMA: **todas las FK llevan `@db.Uuid`**. Olvidarlo genera un tipo incompatible en la migración.
- NORMA: las **tablas pivote usan clave primaria compuesta** (`@@id([a, b])`), sin `id` sintético. Así lo hacen `DocumentTag`, `Favorite` y `CollectiveMember`.
  - Excepción deliberada: `DocumentShare` y `CategoryShare` **sí** tienen `id` propio, porque llevan datos adicionales (`permission`) y se identifican de forma individual; su unicidad se garantiza con `@@unique`.
- Comentarios del schema en español y sin tildes, igual que el resto del código.

## Soft-delete y timestamps

- NORMA: **`deletedAt DateTime?` existe solo en `Category` y `Document`.** El resto de modelos borra de verdad.
- NORMA: en consecuencia, **toda lectura de categorías o documentos filtra `deletedAt: null`** en el `where`. Omitirlo devuelve elementos de la papelera.
- `updatedAt @updatedAt` solo en `User`, `Category`, `Document` y `Collective` — los modelos que se editan. Los demás solo llevan `createdAt`.
- Todos los modelos tienen `createdAt DateTime @default(now())`.

## Política onDelete

- **`Cascade`** en la mayoría: todo lo que cuelga de `ownerId → User`, la auto-relación `Category.parentId` (borrar un padre borra el subárbol en la BD), ambos lados de `DocumentTag`, y `Favorite`, `DocumentReference`, `CollectiveMember`, `DocumentShare`, `CategoryShare`.
- **`SetNull` en dos casos**, deliberados para no perder contenido:
  - `Document.categoryId → Category` — **borrar una carpeta deja sus documentos en la raíz**, no los destruye.
  - `Attachment.documentId → Document` — un adjunto sobrevive al documento que lo referenciaba.
- Todas las FK son `ON UPDATE CASCADE`.

> Ojo con la interacción entre el `Cascade` de la BD y el soft-delete de la aplicación: el borrado de carpetas que hace el servicio es **soft** (marca `deletedAt`), así que el `Cascade` de `Category.parentId` solo entra en juego si alguna vez se borra físicamente.

## Índices

Pensados para las consultas reales, no por defecto:

| Modelo | Índice | Para qué |
|---|---|---|
| `Category` | `@@index([ownerId, parentId, position])` | Listar las hermanas de un nivel, ya ordenadas |
| `Document` | `@@index([ownerId, categoryId, position])` | Listar los documentos de una carpeta, ya ordenados |
| `Document` | `@@index([searchVector], type: Gin)` | Buscador full-text |
| `Tag` | `@@unique([ownerId, name])` | Un tag no se repite dentro del mismo usuario |
| `DocumentReference` | `@@unique([sourceDocumentId, targetDocumentId])` | No duplicar una referencia |
| Pivotes | índice en la columna que no encabeza la PK compuesta | Recorrer la relación en sentido inverso |

NORMA: al añadir una consulta nueva que filtre y ordene, comprueba si encaja con un índice existente antes de crear otro.

## searchVector — no tocar

La columna de búsqueda full-text es el punto más delicado del esquema.

En `schema.prisma`:

```prisma
searchVector Unsupported("tsvector")? @default(dbgenerated())
```

**El `dbgenerated()` sin argumento es deliberado.** Prisma no sabe modelar columnas generadas de tipo `tsvector`; sin ese default, cada `prisma migrate dev` detectaría una diferencia y generaría una **migración fantasma** que intentaría redefinir la columna.

La definición real vive en el SQL de la migración inicial:

```sql
"searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce("contentText", '')), 'B')
) STORED,
```

Diccionario `spanish`, título con peso A y cuerpo con peso B, columna `STORED` con índice GIN.

Reglas que se derivan de esto:

- NORMA: **la BD recalcula el vector sola.** Nunca escribas `searchVector` desde el código; Postgres rechazaría el `INSERT`/`UPDATE`.
- NORMA: **nunca "arregles" el `dbgenerated()`** ni lo sustituyas por un valor. Si `prisma migrate dev` propone tocar esa columna, la migración está mal: revísala antes de aplicarla.
- Consecuencia para el buscador (Fase 5): **basta con mantener `contentText` al día**. El front lo deriva del contenido del editor y lo manda en cada guardado; el vector se actualiza en cascada.

## Consultas desde los servicios

- NORMA: **todo acceso a la BD pasa por `PrismaService` inyectado.** No se instancia `PrismaClient` en ningún sitio.
- NORMA: **`prisma.$transaction`** para cualquier operación que escriba varias filas que deban quedar consistentes. El caso real es `reorder`, que reasigna las posiciones de todas las hermanas de un nivel.
- Ver `security.md` para las dos reglas que no son negociables aquí: **nada de SQL crudo sin parametrizar** y **`ownerId` siempre en el `where`**.

## Modelos sin módulo todavía

9 de los 13 modelos existen en la BD pero **no tienen módulo NestJS**: `Tag`, `DocumentTag`, `Favorite`, `Attachment`, `DocumentReference`, `Collective`, `CollectiveMember`, `DocumentShare`, `CategoryShare`. Los enums `MemberRole` y `SharePermission` tampoco tienen lógica asociada.

No es un olvido ni una deuda: el reparto por fases está en [PLAN.md](../../PLAN.md).
