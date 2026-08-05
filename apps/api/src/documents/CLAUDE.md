# Módulo `documents`

CRUD de documentos (notas) dentro del árbol de carpetas. Guarda el contenido del editor BlockNote y alimenta el buscador full-text.

## Estructura del módulo

```
documents/
├── documents.module.ts
├── documents.controller.ts
├── documents.service.ts
└── dto/
    ├── create-document.dto.ts
    ├── update-document.dto.ts
    ├── move-document.dto.ts
    └── reorder-documents.dto.ts
```

## Reglas del módulo

### `fullSelect` vs `listSelect`

Hay **cuatro proyecciones** declaradas al principio del servicio, tipadas con `satisfies Prisma.DocumentSelect`, y sus tipos de respuesta se derivan de ellas. Van por parejas: una describe **la forma de la respuesta**, la otra **lo que se pide a la BD**.

| Proyección | Forma | Incluye | Papel |
|---|---|---|---|
| `fullSelect` | constante | Todo, **con `contentJson` y `contentText`** | Base del tipo `DocumentFull` |
| `fullQuerySelect(ownerId)` | **función** | `fullSelect` + tags + favorito | Lo que se **pide a la BD** en `create`, `findOne`, `update`, `move` |
| `listSelect` | constante | Sin el contenido | Base del tipo `DocumentListItem` |
| `listQuerySelect(ownerId)` | **función** | `listSelect` + `contentText` + tags + favorito | Lo que se **pide a la BD** en `list`, `search` y `listByIds` |

NORMA: **las dos de consulta son funciones de `ownerId`, no constantes**, porque la marca de favorito se filtra por el usuario que consulta (ver más abajo). Sus tipos de fila se derivan con `ReturnType<typeof …>`:

```ts
type DocumentFullRow = Prisma.DocumentGetPayload<{ select: ReturnType<typeof fullQuerySelect> }>;
```

NORMA: **los listados nunca devuelven `contentJson`.** Un documento largo pesa mucho y el sidebar solo necesita título y posición. Si añades un endpoint de listado, usa `listSelect`.

Ninguna de las cuatro incluye `ownerId` ni `deletedAt`.

### Los tags viajan en todas las respuestas

Los dos tipos de salida llevan `tags: TagItem[]`, así que **cualquier respuesta de este módulo trae los tags del documento** — el detalle, el listado, el autoguardado y el move. Un documento recién creado trae `tags: []`.

```ts
const tagsRelation = {
  select: { tag: { select: tagSelect } },
  orderBy: { tag: { name: 'asc' } },
} as const;
```

- El `as const` **no es decorativo**: sin él, `'asc'` se ensancharía a `string` y el `satisfies Prisma.DocumentSelect` fallaría.
- La consulta devuelve la tabla pivote (`[{tag: {...}}]`), así que se **aplana antes de responder**: `toFull()` para el detalle, el propio `map` de `list()` para el listado. NORMA: la API devuelve los tags directamente, nunca la forma anidada de `DocumentTag`.
- `tagSelect` y `TagItem` **se importan de `../tags/tags.service`**, para que el contrato del tag exista en un solo sitio. Es un import de tipo y de una constante: los dos módulos NestJS siguen sin conocerse.
- Ordenados por nombre desde la BD, no en memoria.

Añadir o quitar tags **no se hace desde este módulo**: está en `/api/documents/:documentId/tags`, que vive en `apps/api/src/tags/`.

### `isFavorite` también viaja en todas las respuestas

Igual que los tags: los dos tipos de salida llevan `isFavorite: boolean`, así que lo traen el detalle, el listado, el buscador, el autoguardado y el move.

```ts
function favoritesOf(ownerId: string) {
  return { where: { userId: ownerId }, select: { userId: true } } as const;
}
```

- NORMA: el `where` por `userId` **no es redundante**. Hoy solo el dueño puede marcar un documento, pero cuando la Fase 9 permita ver documentos ajenos, el favorito de otro usuario no debe contar como propio. Es lo que obliga a que las proyecciones de consulta sean funciones.
- Se pide como relación filtrada, así que **no cuesta ninguna consulta extra**: viene en el mismo `SELECT`.
- Se aplana a booleano antes de responder (`favorites.length > 0`), en `toFull()` y en `toListItems()`. La API **nunca devuelve la fila de `Favorite`**.

Marcar y desmarcar **no se hace desde este módulo**: está en `/api/documents/:documentId/favorite`, que vive en `apps/api/src/favorites/`.

### `listByIds()`: proyectar un orden que decide otro

Método público sin endpoint propio. Devuelve `DocumentListItem[]` **en el mismo orden en que llegan los ids**, descartando en silencio los que estén en la papelera o sean de otro usuario.

Existe para que `FavoritesService` pueda ordenar por la fecha de marcado —que solo conoce la tabla `Favorite`— sin duplicar aquí el `listSelect` ni el cálculo del extracto. Por eso `DocumentsModule` **exporta `DocumentsService`**.

Es el mismo reparto que usa el buscador con sus `rankedIds`, y los dos comparten el helper `orderByIds()`.

### `excerpt`: por qué hay dos selects para un listado

`GET /api/documents` devuelve un campo **`excerpt`** que no existe en la tabla: alimenta la vista previa de las tarjetas del front.

```ts
export type DocumentListItem = Prisma.DocumentGetPayload<{ select: typeof listSelect }> & {
  excerpt: string;
  tags: TagItem[];
  isFavorite: boolean;
};
```

- `list()` pide `listQuerySelect` (con `contentText`), y **descarta ese campo en el `map`** dejando solo el extracto. NORMA: `contentText` completo **no sale nunca** de un listado — un texto de 50 KB por documento multiplicado por todo el árbol es justo lo que `listSelect` evitaba.
- `toExcerpt()` recorta a **240 caracteres** (`EXCERPT_LENGTH`) cortando en el último espacio, para no partir palabras, y añade `…`. Conserva los saltos de línea a propósito: la vista de tarjetas los respeta.
- El front tiene su propia versión aproximada en `toListItem()` (ver `apps/web/src/lib/CLAUDE.md`) para no dejar la vista previa vieja tras editar. **La fuente de verdad del extracto es esta.**

### Tri-estado de `?categoryId`

El filtro del listado admite tres situaciones, y el controlador las distingue con un parseo manual (`parseCategoryFilter`) porque acepta un literal además de UUIDs:

| Query | Valor interno | Significa |
|---|---|---|
| *(ausente)* o `''` | `undefined` | Sin filtro: todos los documentos del usuario |
| `?categoryId=root` (o `null`) | `null` | Solo los de la raíz |
| `?categoryId=<uuid>` | el uuid | Solo los de esa carpeta |

Cualquier otro valor → 400 `'categoryId debe ser un UUID o "root"'`. La comprobación usa el `UUID_RE` declarado a nivel de módulo.

NORMA: `undefined` y `null` **no son intercambiables** aquí. Al propagar el filtro hacia el servicio, no uses `?? null` ni `|| undefined`: colapsarías dos casos distintos.

### El buscador: `GET /api/documents/search`

Texto completo y/o tags, ambos opcionales y combinables. **Sin ninguno de los dos devuelve `[]`**, nunca el corpus entero.

Se resuelve en **dos consultas**, y el reparto es deliberado:

1. **Solo el ranking va en SQL crudo**, porque Prisma no sabe consultar una columna `tsvector`:
   ```ts
   await this.prisma.$queryRaw<Array<{ id: string }>>`
     SELECT d."id"
     FROM "Document" d, websearch_to_tsquery('spanish', ${q}) AS query
     WHERE d."ownerId" = ${ownerId}::uuid AND d."deletedAt" IS NULL
       AND d."searchVector" @@ query
     ORDER BY ts_rank(d."searchVector", query) DESC, d."updatedAt" DESC
     LIMIT ${SEARCH_LIMIT}`
   ```
   NORMA: **template tag, nunca `$queryRawUnsafe` ni concatenación** (regla 3 de `.claude/rules/security.md`). Devuelve **solo ids**: la proyección la hace Prisma después.
2. **Todo lo demás va por Prisma**: el select de listado, los tags y el filtro por etiquetas. El orden de relevancia se reaplica en memoria con `orderByIds()`, un mapa `id → posición`.

Reglas que se derivan:

- **Los tags filtran en Y**: un `some` por cada tag (`AND: tagIds.map(...)`), así que el documento debe llevarlos **todos**. Cambiarlo a O es cambiar ese `AND` por un solo `some` con `in`.
- **Sin texto, el orden es `updatedAt` descendente**: no hay relevancia que calcular.
- `websearch_to_tsquery` entiende la sintaxis de un buscador web (comillas para frase exacta, `or`, `-`) y **nunca lanza error de sintaxis**, a diferencia de `to_tsquery`. Por eso se usa esa y no otra.
- NORMA: **no hay coincidencia por prefijo.** Buscar `post` no encuentra "postgres"; el diccionario `spanish` sí lematiza (`migracion` encuentra "migraciones"). Si algún día se quiere prefijo, es aquí y hay que cuidar el escapado.
- **Tope de `SEARCH_LIMIT` (50) sin paginación ni total**, coherente con el resto de la API. El front deduce que hay más si recibe exactamente 50.
- El `ownerId` va en el `where` de **las dos** consultas.

### `contentJson` y `contentText`

- `contentJson` es el árbol de bloques de BlockNote, guardado como **JSONB opaco**. La API **no lo interpreta, no lo valida y no lo recorre**. Ver la regla 5 de `.claude/rules/security.md`: es contenido no confiable.
- `contentText` es el texto plano **derivado en el frontend** (`extractText()`) y enviado en cada guardado. Existe para alimentar la búsqueda.
- El `searchVector` **se recalcula solo en la BD** a partir de `title` y `contentText`. Nunca se escribe desde aquí (ver `.claude/rules/database.md`).

### Otras reglas

- **Validación cruzada del destino**: crear o mover un documento a una carpeta pasa por `assertCategoryOwned()`. Sin eso se podría colocar contenido en la carpeta de otro usuario.
- `categoryId: null` significa **documento en la raíz**, no "sin asignar".
- Borrado **soft** (`deletedAt`), igual que en categorías.
- Si se borra la carpeta que lo contiene, el documento **cae a la raíz** por el `onDelete: SetNull` de la FK — no se pierde.

## Endpoints del módulo

Todos bajo `@UseGuards(JwtAuthGuard)` a nivel de clase.

| Método | Ruta | Entrada | Devuelve |
|---|---|---|---|
| POST | `/api/documents` | `CreateDocumentDto` | `DocumentFull` · 201 |
| GET | `/api/documents` | `?categoryId=<uuid>\|root` | `DocumentListItem[]` |
| GET | `/api/documents/search` | `?q=texto&tagIds=uuid,uuid` | `DocumentListItem[]` (máx. 50) |
| PATCH | `/api/documents/reorder` | `ReorderDocumentsDto` | `{ reordered: n }` |
| GET | `/api/documents/:id` | — | `DocumentFull` |
| PATCH | `/api/documents/:id` | `UpdateDocumentDto` | `DocumentFull` |
| PATCH | `/api/documents/:id/move` | `MoveDocumentDto` | `DocumentFull` |
| DELETE | `/api/documents/:id` | — | `{ deleted: 1 }` |

`search` y `reorder` **deben declararse antes que `:id`**. El `PATCH /:id` es el que recibe el autoguardado del editor, así que es el endpoint más llamado de la API.

Bajo `/api/documents/:documentId` cuelgan **cinco endpoints que no son de este módulo**: los tres de `/tags` (`DocumentTagsController`, en `apps/api/src/tags/`) y los dos de `/favorite` (`DocumentFavoriteController`, en `apps/api/src/favorites/`). No colisionan con `GET /api/documents/:id`: tienen un segmento más.

## Modelo / Entidades

`Document`, con `categoryId` opcional (`onDelete: SetNull`), soft-delete, orden manual (`position`) y la columna generada `searchVector` con índice GIN. Detalle en `.claude/rules/database.md`.

## Validaciones requeridas

- `title`: obligatorio al crear, opcional al actualizar, con `@MinLength(1, { message: 'El título no puede estar vacío' })` y `@MaxLength(200)`.
- `categoryId`: `@IsUUID` y opcional; `null` = raíz.
- `contentJson`: **solo `@IsOptional()`**, sin ningún otro validador — con `whitelist: true`, cualquier otra combinación lo eliminaría del body. Ver `.claude/rules/backend.md`.
- `contentText`: `@IsString` opcional.
- `orderedIds`: array de UUIDs no vacío.

## Cómo verificar el módulo

1. **Crear** un documento en la raíz y otro dentro de una carpeta.
2. **Listar sin filtro** → salen todos, **sin `contentJson` ni `contentText`**, y **con `excerpt`**, `tags` e `isFavorite`. Con un documento de más de 240 caracteres, el extracto acaba en `…` y no parte una palabra.
2b. **`isFavorite`** — está en las cinco respuestas (detalle, listado, buscador, `PATCH /:id` y `PATCH /:id/move`) y solo vale `true` en los documentos que el usuario ha marcado.
3. **`?categoryId=root`** → solo los de la raíz. **`?categoryId=<uuid>`** → solo los de esa carpeta. **`?categoryId=loquesea`** → 400.
4. **`GET /:id`** → sí trae `contentJson` y `contentText`.
5. **Guardar** con `PATCH /:id` — simular el autoguardado del editor y comprobar que `updatedAt` cambia.
6. **Buscar en la BD** que el `searchVector` se ha actualizado tras editar el contenido (es la señal de que `contentText` llega bien).
6b. **Buscador** — `?q=` encuentra por título y por contenido, con el título pesando más; dos palabras se combinan en Y; el singular encuentra al plural; `?tagIds=a,b` exige **ambos** tags; sin criterios devuelve `[]`; un `tagIds` que no es UUID da 400; y un documento en la papelera deja de aparecer.
7. **Mover** a otra carpeta y a la raíz (`categoryId: null`).
8. **Crear o mover a una carpeta de otro usuario** → **404**.
9. **Borrar la carpeta padre** → el documento sigue existiendo y aparece en la raíz.
10. **Reorder** dentro de una carpeta y en la raíz.
11. **Aislamiento** — cualquier operación con el token de otro usuario → 404.
