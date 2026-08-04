# Módulo `tags`

Tags **transversales** al árbol de carpetas: un documento vive en una sola carpeta, pero puede llevar N tags. Cada tag pertenece a un usuario.

## Estructura del módulo

```
tags/
├── tags.module.ts
├── tags.controller.ts           ← /api/tags            (gestión del tag en sí)
├── document-tags.controller.ts  ← /api/documents/:documentId/tags (vínculos)
├── tags.service.ts
└── dto/
    ├── create-tag.dto.ts
    ├── update-tag.dto.ts
    └── attach-tag.dto.ts
```

Es el **único módulo con dos controladores**. El segundo cuelga de la ruta de documentos pero vive aquí porque toda la lógica está en `TagsService`; `DocumentsModule` no lo conoce ni lo inyecta.

## Reglas del módulo

### Asignar es por nombre, no por id

NORMA: `POST /api/documents/:documentId/tags` recibe un **nombre**, no un `tagId`. Si el usuario ya tiene ese tag lo reutiliza; si no, lo crea sobre la marcha. Es lo que necesita un input de chips: escribes y Enter, sin dos llamadas.

- La operación es **idempotente**: repetirla no duplica el vínculo (`documentTag.upsert` con la PK compuesta `documentId_tagId`).
- El `color` del DTO **solo se aplica si el tag hay que crearlo**. Sobre uno existente se ignora — para cambiarlo está `PATCH /api/tags/:id`.
- Devuelve **la lista completa de tags del documento**, ya ordenada, no solo el que se acaba de añadir. Así el front no tiene que recomponerla.

### Nombres: normalización y mayúsculas

- `normalizeName()` hace trim y **colapsa los espacios internos** (`"  React   Native  "` → `"React Native"`). Si queda vacío → 400. El `@MinLength(1)` del DTO no lo cubre: `"   "` tiene longitud 3.
- NORMA: la unicidad se comprueba **sin distinguir mayúsculas** (`findByName` con `mode: 'insensitive'`), para que "React" y "react" no acaben siendo dos tags. Se guarda tal y como lo escribió el usuario.
  > El índice `@@unique([ownerId, name])` de la BD **sí distingue** mayúsculas, así que esta garantía es de la aplicación, no de la base de datos. Dos peticiones simultáneas con el mismo nombre en distinto case podrían colarse; se asume.
- Nombre duplicado → **409** con `'Ya tienes una etiqueta con ese nombre'`, tanto al crear como al renombrar. No hay fuga de información: los tags son privados del usuario.
- Renombrar un tag cambiando solo las mayúsculas (`Infra` → `INFRA`) **no colisiona consigo mismo**: la comprobación excluye el propio id.

### Borrar tag ≠ quitar tag

Dos operaciones distintas que conviene no confundir:

| Operación | Ruta | Efecto |
|---|---|---|
| **Quitar** del documento | `DELETE /api/documents/:documentId/tags/:tagId` | Borra el vínculo. El tag sigue existiendo y en sus demás documentos |
| **Borrar** el tag | `DELETE /api/tags/:id` | Borrado **físico**; desaparece de todos los documentos por el `onDelete: Cascade` de `DocumentTag` |

- `Tag` **no tiene soft-delete** (no hay columna `deletedAt`), así que el borrado es real y no hay papelera de tags.
- Quitar un vínculo que no existe devuelve `{ removed: 0 }`, no 404: la operación es idempotente. Eso cubre también el caso de pasar el `tagId` de otro usuario — no se filtra si existe o no.

### `documentCount`

`GET /api/tags` devuelve cada tag con el número de documentos que lo usan. Sale de un único `groupBy` sobre `DocumentTag` en paralelo con la lista, igual que los contadores del árbol de carpetas.

NORMA: el contador **ignora los documentos en la papelera** (`document: { deletedAt: null }`). Un tag cuyos documentos se han borrado aparece con `documentCount: 0`, no desaparece.

### Terminología

El código y las rutas dicen **tag**; los mensajes de cara al usuario dicen **etiqueta** (`'Etiqueta no encontrada'`), en línea con el resto de mensajes en español del proyecto.

## Endpoints del módulo

Todos bajo `@UseGuards(JwtAuthGuard)` a nivel de clase, en los dos controladores.

| Método | Ruta | Entrada | Devuelve |
|---|---|---|---|
| POST | `/api/tags` | `CreateTagDto` | `TagItem` · 201 |
| GET | `/api/tags` | — | `TagWithCount[]` (alfabético) |
| PATCH | `/api/tags/:id` | `UpdateTagDto` | `TagItem` |
| DELETE | `/api/tags/:id` | — | `{ deleted: 1 }` |
| GET | `/api/documents/:documentId/tags` | — | `TagItem[]` |
| POST | `/api/documents/:documentId/tags` | `AttachTagDto` `{name, color?}` | `TagItem[]` · 201 |
| DELETE | `/api/documents/:documentId/tags/:tagId` | — | `{ removed: n }` |

No hay colisión con `GET /api/documents/:id`: son rutas de distinto número de segmentos.

## Los tags en las respuestas de documentos

`DocumentsService` incluye `tags: TagItem[]` en **todas** sus respuestas (detalle y listado). El `tagSelect` que usa se **importa de aquí**, para que el contrato del tag esté definido en un solo sitio:

```ts
import { tagSelect, type TagItem } from '../tags/tags.service';
```

Es un import de tipo y de una constante, no de un provider: `TagsModule` y `DocumentsModule` siguen sin conocerse. Detalle en `apps/api/src/documents/CLAUDE.md`.

## Modelo / Entidades

`Tag` (con `@@unique([ownerId, name])`) y la pivote `DocumentTag`, con PK compuesta `@@id([documentId, tagId])` e índice en `tagId` para recorrer la relación al revés. Ninguna de las dos tiene soft-delete. Detalle en `.claude/rules/database.md`.

## Validaciones requeridas

- `name`: obligatorio al crear y al vincular, opcional al actualizar. `@MinLength(1)` + `@MaxLength(50)`. El caso "solo espacios" lo cubre el servicio, no el DTO.
- `color`: `@IsString` opcional, `@MaxLength(50)`. Es un **nombre de color de Mantine**, igual que en las carpetas — no un hex.
  > Como en `categories`, el `?? undefined` de `update()` significa que **no se puede vaciar el color** una vez puesto. Mismo comportamiento que las carpetas; si algún día se quiere, se cambia en los dos sitios a la vez.
- `documentId` y `tagId` de ruta: `ParseUUIDPipe`.
- La propiedad del documento y la del tag se validan **en el servicio** (`assertDocumentOwned`, `assertOwned`), con 404.

## Cómo verificar el módulo

1. **Crear** dos tags y listarlos → orden alfabético, `documentCount: 0`, y la respuesta **sin `ownerId`**.
2. **Duplicado** — crear "backend" teniendo "Backend" → 409. Renombrar un tag al nombre de otro → 409. Renombrar un tag a su propio nombre en mayúsculas → 200.
3. **Normalización** — crear `"  React   Native  "` → se guarda `"React Native"`. Crear `"   "` → 400.
4. **Vincular** por nombre a un documento → 201 con la lista del documento. Repetir → no duplica. Repetir en otras mayúsculas → reutiliza el tag, no crea otro.
5. **Contador** — el mismo tag en dos documentos → `documentCount: 2`. Enviar uno a la papelera → baja a 1.
6. **Quitar vs borrar** — `DELETE` del vínculo deja el tag vivo; `DELETE /api/tags/:id` lo quita de todos sus documentos.
7. **Documentos** — `GET /api/documents/:id` y `GET /api/documents` traen `tags` ordenados; un documento nuevo trae `tags: []`.
8. **Aislamiento** — con el token de otro usuario: renombrar o borrar un tag ajeno, y leer, vincular o desvincular en un documento ajeno → **404** en todos los casos. Dos usuarios pueden tener un tag con el mismo nombre.
