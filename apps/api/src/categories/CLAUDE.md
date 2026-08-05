# Módulo `categories`

El árbol de carpetas estilo Craft: N niveles, orden manual entre hermanas, papelera. Contiene **la regla de negocio más particular del proyecto** (los modos `subtree` / `single`).

## Estructura del módulo

```
categories/
├── categories.module.ts
├── categories.controller.ts
├── categories.service.ts
└── dto/
    ├── create-category.dto.ts
    ├── update-category.dto.ts
    ├── move-category.dto.ts
    ├── reorder-categories.dto.ts
    └── tree-mode.enum.ts
```

## Reglas del módulo

### Los dos modos: `subtree` vs `single`

`TreeMode` (`dto/tree-mode.enum.ts`) tiene dos valores, y **cambian el resultado de mover y de borrar**. El front pregunta al usuario cuál quiere cuando la carpeta tiene hijas.

| Modo | Al **mover** | Al **borrar** |
|---|---|---|
| `SUBTREE` (default) | La carpeta se lleva consigo toda su estructura | Se borran la carpeta, todo su subárbol **y los documentos de todas ellas** |
| `SINGLE` | Solo esa carpeta cambia de sitio; **sus hijas directas suben a colgar del padre de origen** | Solo esa carpeta; **sus hijas y sus documentos suben al padre de origen** |

En ambos casos, `SINGLE` **desvincula las hijas antes** de tocar la carpeta (`updateMany` sobre `parentId`).

### Borrar una carpeta decide también qué pasa con sus documentos

NORMA: **ninguna vía puede dejar un documento vivo colgando de una carpeta borrada.** Sería invisible — no está en el árbol, `?categoryId` de una carpeta borrada da 404, y tampoco aparecería en la papelera. Por eso `remove()` toca las dos tablas:

- En `SUBTREE`, la carpeta, su subárbol y sus documentos se marcan con **el mismo `deletedAt`**, dentro de una `$transaction`. Ese instante compartido **identifica el lote** y es lo que permite restaurarlo entero después. Detalle en `apps/api/src/trash/CLAUDE.md`.
- En `SINGLE`, los documentos directos suben al padre de origen, igual que las subcarpetas.

NORMA: el `deletedAt` se calcula **una vez** al principio del método y se reparte a todas las filas. No lo sustituyas por un `new Date()` por consulta: rompería el lote y la papelera dejaría de saber qué se borró junto.

### Prevención de ciclos

Al mover se rechaza que una carpeta sea su propia padre, y en modo `SUBTREE` se calcula el conjunto de descendientes y se rechaza moverla dentro de uno de ellos (sería un ciclo). En `SINGLE` **no hace falta**: las hijas ya se han desvinculado, así que no puede formarse.

### Contrato de `reorder`

Es estricto a propósito: la lista debe contener **exactamente** los hermanos vivos de ese nivel — mismo número, mismos IDs, sin duplicados. Cualquier desviación es 400. Después reasigna las posiciones (`0..n-1`) dentro de una `$transaction`.

El motivo: una lista parcial dejaría posiciones duplicadas o huecos, y el orden del sidebar quedaría indefinido.

### Otras reglas

- El borrado es **soft** (`deletedAt`), nunca físico **desde aquí**: el borrado definitivo vive en el módulo `trash`. Toda consulta de este módulo filtra `deletedAt: null`.
- `nextPosition()` coloca lo nuevo al final de su nivel (`última + 1`, o 0 si está vacío).
- `update()` es edición **en el sitio**: no cambia de carpeta padre. Para eso está `move`.
- DEUDA (local): `create`, `update` y `move` devuelven la **entidad Prisma completa**, con `ownerId` y `deletedAt` incluidos. Solo `tree()` proyecta a un DTO limpio. El patrón correcto es el de `documents.service.ts`, con `select`.

## Endpoints del módulo

Todos bajo `@UseGuards(JwtAuthGuard)` a nivel de clase.

| Método | Ruta | Entrada | Devuelve |
|---|---|---|---|
| POST | `/api/categories` | `CreateCategoryDto` | `Category` · 201 |
| GET | `/api/categories` | — | `{ tree, rootDocumentCount }` |
| PATCH | `/api/categories/reorder` | `ReorderCategoriesDto` | `{ reordered: n }` |
| PATCH | `/api/categories/:id` | `UpdateCategoryDto` | `Category` |
| PATCH | `/api/categories/:id/move` | `MoveCategoryDto` `{parentId, mode}` | `Category` |
| DELETE | `/api/categories/:id` | `?mode=subtree\|single` | `{ deleted: n }` |

- `reorder` **debe declararse antes que `:id`** (ver `.claude/rules/backend.md`).
- El `?mode` del DELETE usa `DefaultValuePipe(TreeMode.SUBTREE)` + `ParseEnumPipe`.

### La respuesta de `GET /api/categories`

```ts
{ tree: CategoryNode[], rootDocumentCount: number }
```

`CategoryNode` lleva `documentCount`: **los documentos directos de esa carpeta**, sin contar los de sus subcarpetas. Existe para que el front sepa si una carpeta tiene contenido **sin cargar sus documentos** — la carga es perezosa y solo ocurre al expandir.

`rootDocumentCount` son los documentos que viven fuera de cualquier carpeta.

El árbol se construye en memoria a partir de una consulta plana, y los contadores salen de un único `groupBy`; ambas consultas van en paralelo con `Promise.all`.

## Modelo / Entidades

`Category`, con auto-relación `parentId → Category` (`onDelete: Cascade`) y soft-delete. Índice `[ownerId, parentId, position]`, que cubre justo la consulta de "hermanas de un nivel, ordenadas". Detalle en `.claude/rules/database.md`.

## Validaciones requeridas

- `name`: obligatorio en `create`, opcional en `update`, con `@MaxLength`.
- `parentId`: `@IsUUID` y opcional. `null` significa raíz.
- `mode`: `@IsEnum(TreeMode)`.
- `orderedIds`: `@IsArray` + `@ArrayNotEmpty` + `@IsUUID(undefined, { each: true })`.
- La propiedad de la carpeta padre se valida **en el servicio** con `assertOwned()`, no en el DTO.

## Cómo verificar el módulo

1. **Crear** una carpeta en la raíz y una anidada; comprobar que `position` va incrementando por nivel.
2. **Árbol** — `GET /api/categories` devuelve la jerarquía correcta con `documentCount` por carpeta y `rootDocumentCount` aparte.
3. **Mover en `SUBTREE`** — la carpeta llega con sus hijas.
4. **Mover en `SINGLE`** — la carpeta llega sola y **sus hijas quedan colgando del padre de origen**. Este es el caso que más se rompe.
5. **Ciclo** — mover una carpeta dentro de su propia subcarpeta en modo `SUBTREE` → 400.
6. **Auto-padre** — `parentId === id` → 400.
7. **Borrar en `SUBTREE`** — `deleted` cuenta la carpeta más todos sus descendientes, y **sus documentos se van a la papelera con ella** (comprobar que dejan de salir en `GET /api/documents` y en el buscador).
8. **Borrar en `SINGLE`** — `deleted: 1`; las hijas **y los documentos directos** suben al padre.
9. **Reorder correcto** — el nuevo orden se refleja en el árbol.
10. **Reorder con lista incompleta, con un ID de otro nivel o con duplicados** → 400 en los tres casos.
11. **Aislamiento** — con el token de otro usuario, cualquier operación sobre estas carpetas devuelve **404** (no 403).
