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

Hay **tres proyecciones** declaradas al principio del servicio, tipadas con `satisfies Prisma.DocumentSelect`, y sus tipos de respuesta se derivan de ellas:

| Proyección | Incluye | Se usa en |
|---|---|---|
| `fullSelect` → `DocumentFull` | Todo, **con `contentJson` y `contentText`** | `create`, `findOne`, `update`, `move` |
| `listSelect` | Sin el contenido | Es la **forma de la respuesta** de `list` |
| `listQuerySelect` | `listSelect` + `contentText` | Es lo que se **pide a la BD** en `list` |

NORMA: **los listados nunca devuelven `contentJson`.** Un documento largo pesa mucho y el sidebar solo necesita título y posición. Si añades un endpoint de listado, usa `listSelect`.

Ninguna de las tres incluye `ownerId` ni `deletedAt`.

### `excerpt`: por qué hay dos selects para un listado

`GET /api/documents` devuelve un campo **`excerpt`** que no existe en la tabla: alimenta la vista previa de las tarjetas del front.

```ts
export type DocumentListItem = Prisma.DocumentGetPayload<{ select: typeof listSelect }> & {
  excerpt: string;
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
| PATCH | `/api/documents/reorder` | `ReorderDocumentsDto` | `{ reordered: n }` |
| GET | `/api/documents/:id` | — | `DocumentFull` |
| PATCH | `/api/documents/:id` | `UpdateDocumentDto` | `DocumentFull` |
| PATCH | `/api/documents/:id/move` | `MoveDocumentDto` | `DocumentFull` |
| DELETE | `/api/documents/:id` | — | `{ deleted: 1 }` |

`reorder` **debe declararse antes que `:id`**. El `PATCH /:id` es el que recibe el autoguardado del editor, así que es el endpoint más llamado de la API.

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
2. **Listar sin filtro** → salen todos, **sin `contentJson` ni `contentText`**, y **con `excerpt`**. Con un documento de más de 240 caracteres, el extracto acaba en `…` y no parte una palabra.
3. **`?categoryId=root`** → solo los de la raíz. **`?categoryId=<uuid>`** → solo los de esa carpeta. **`?categoryId=loquesea`** → 400.
4. **`GET /:id`** → sí trae `contentJson` y `contentText`.
5. **Guardar** con `PATCH /:id` — simular el autoguardado del editor y comprobar que `updatedAt` cambia.
6. **Buscar en la BD** que el `searchVector` se ha actualizado tras editar el contenido (es la señal de que `contentText` llega bien).
7. **Mover** a otra carpeta y a la raíz (`categoryId: null`).
8. **Crear o mover a una carpeta de otro usuario** → **404**.
9. **Borrar la carpeta padre** → el documento sigue existiendo y aparece en la raíz.
10. **Reorder** dentro de una carpeta y en la raíz.
11. **Aislamiento** — cualquier operación con el token de otro usuario → 404.
