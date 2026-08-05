# Módulo `trash`

La papelera: lo que se hace con `Category.deletedAt` y `Document.deletedAt` **después** de escribirlos. Es el único módulo que consulta esas columnas en vez de filtrarlas, y el único que borra de verdad.

## Estructura del módulo

```
trash/
├── trash.module.ts
├── trash.controller.ts
├── trash.service.ts        ← listar, restaurar, purgar
└── trash-purge.service.ts  ← la tarea diaria
```

Sin carpeta `dto/`: ninguna operación lleva body.

## Reglas del módulo

### El lote de borrado

**La idea central del módulo.** Al enviar una carpeta a la papelera en modo `subtree`, `categories.service.ts` marca con **el mismo `deletedAt`** la carpeta, sus subcarpetas y **todos sus documentos**. Ese instante compartido identifica el lote.

Sirve para dos cosas:

1. **Listar solo las raíces.** Borrar una carpeta con 10 subcarpetas produce **una** entrada en la papelera, no once. Un elemento es raíz cuando su contenedor **no** está en la papelera con ese mismo `deletedAt`.
2. **Restaurar exactamente lo que se borró junto.** `batchSubtree()` recorre solo por hijas que compartan el timestamp de la raíz, así que una subcarpeta que **ya estaba** en la papelera de antes **no** se restaura con ella: no se borró con ella.

```ts
private batchSubtree(all, rootId, deletedAt) // -> ids del subarbol DEL MISMO LOTE
```

NORMA: la comparación es de igualdad exacta de `Date` (`getTime()` en memoria, `=` en Prisma). Funciona porque el `deletedAt` se genera **una vez** por operación de borrado y se reparte a todas las filas. Si alguna vez se marca fila a fila con `new Date()` en cada una, el lote se rompe.

### Ningún documento vivo puede quedar colgando de una carpeta borrada

Es la razón de ser de media Fase 6.2. Antes, borrar una carpeta dejaba sus documentos vivos pero **inalcanzables**: no salían en el árbol, `?categoryId=<borrada>` daba 404, y tampoco estaban en la papelera. Seguían apareciendo en el buscador y en favoritos.

Ahora hay dos vías y las dos cierran el agujero:

| Modo de borrado | Qué pasa con los documentos |
|---|---|
| `subtree` | Van a la papelera **con** la carpeta, en el mismo lote |
| `single` | **Suben al padre inmediato**, igual que las subcarpetas |

NORMA: cualquier vía nueva que marque `deletedAt` en una carpeta tiene que decidir explícitamente qué hace con sus documentos.

### Restaurar siempre deja las cosas visibles

- Un **documento** cuya carpeta ya no existe o sigue borrada vuelve **a la raíz** (`categoryId: null`).
- Una **carpeta** cuyo padre sigue borrado pasa a colgar **de la raíz** (`parentId: null`).
- En los dos casos se recalcula `position` para dejarlo al final de su nivel, con los mismos helpers que usan `categories` y `documents`.

NORMA: restaurar **nunca** puede devolver algo a un contenedor que está en la papelera. Sería volver a crear el problema que arregla este módulo.

### Borrado definitivo

Es **físico**: la fila se va de la BD y con ella todo lo que cuelga por `onDelete: Cascade` — los vínculos de `DocumentTag`, los `Favorite`, y más adelante los adjuntos y los compartidos. El tag en sí **sobrevive** (es del usuario, no del documento) y su `documentCount` baja.

Al purgar una carpeta se borran su subárbol del lote y **los documentos de dentro que estén en la papelera**.

> NORMA: un documento **vivo** dentro de ese subárbol no se destruye nunca. Con los cambios de esta fase no debería existir ninguno, pero destruir contenido vivo por un dato inconsistente es irreversible. Los deja el `onDelete: SetNull` de `Document.categoryId`, que los manda a la raíz.
>
> Ojo con el `Cascade` de `Category.parentId`: al borrar físicamente una carpeta, la BD se lleva por delante **todos** sus descendientes, incluidos los que estuvieran en la papelera en otro lote.

### La purga automática

`trash-purge.service.ts`, con `@nestjs/schedule`:

```ts
@Cron(CronExpression.EVERY_DAY_AT_3AM)
```

- Borra definitivamente lo que lleve más de `TRASH_RETENTION_DAYS` días en la papelera, **de todos los usuarios**. Es la única operación del proyecto que no está acotada por `ownerId`, porque no la lanza ningún usuario.
- El plazo sale del `.env` con **default 30** inline en el servicio; se valida en `env.validation.ts`. Un valor no numérico o `<= 0` cae al default.
- Solo escribe en el log **cuando ha borrado algo**, para no llenarlo de líneas vacías una vez al día.
- `ScheduleModule.forRoot()` se registra en **`TrashModule`**, no en `AppModule`: es la única tarea programada de la API.
- DEUDA: **con varias instancias de la API, el cron corre en todas.** Hoy da igual (los `deleteMany` son idempotentes), pero al desplegar en Zeabur con réplicas habría que dejarlo en una sola.

> El plazo es **de instalación, no de usuario**. Cuando exista la sección de Configuración por usuario (anotada en `PLAN.md`), este valor pasará a ser el default y cada usuario podrá fijar el suyo.

## Endpoints del módulo

Todos bajo `@UseGuards(JwtAuthGuard)` a nivel de clase.

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/trash` | `{ categories: TrashCategory[], documents: TrashDocument[] }` |
| DELETE | `/api/trash` | `{ purged: n }` — vacía la papelera entera |
| POST | `/api/trash/documents/:id/restore` | `{ restored: 1 }` · 201 |
| POST | `/api/trash/categories/:id/restore` | `{ restored: n }` · 201 — cuenta carpetas + documentos |
| DELETE | `/api/trash/documents/:id` | `{ purged: 1 }` |
| DELETE | `/api/trash/categories/:id` | `{ purged: n }` |

- `DELETE /api/trash` se declara **antes** que las rutas con parámetro, por la costumbre del proyecto (aunque aquí no hay ambigüedad real: los segmentos son distintos).
- Restaurar es **POST**, no PATCH: no es una edición parcial del recurso, es una acción.
- Las dos formas de salida son **planas y mínimas**: el documento va sin contenido y la carpeta sin `position` ni `parentId`. Ninguna lleva `ownerId`.

`TrashCategory` incluye `contains: { categories, documents }` — lo que arrastra ese lote. Existe para poder avisar en la UI antes de restaurar o de borrar definitivamente.

## Modelo / Entidades

Ninguno propio: trabaja sobre `Category` y `Document`, los **dos únicos modelos con soft-delete**. Detalle en `.claude/rules/database.md`.

## Validaciones requeridas

- `:id` de ruta: `ParseUUIDPipe` → 400.
- Que el elemento exista **y esté en la papelera** se valida en el servicio (`deletedAt: { not: null }`), con 404. Restaurar algo que está vivo devuelve 404, no 400: desde fuera no se distingue de que no exista.
- Aislamiento por `ownerId` en todas las consultas, con 404 y nunca 403.

## Cómo verificar el módulo

1. **Documento suelto** — borrarlo lo mete en la papelera y lo saca de `GET /api/documents`; restaurarlo lo devuelve.
2. **Carpeta con estructura** — borrar en `subtree` una carpeta con 2 subcarpetas y 2 documentos deja **una sola entrada** en la papelera, con `contains: {categories: 2, documents: 2}`. Sus documentos **no** se listan sueltos, **no** salen en el buscador y su URL directa da **404**.
3. **Restaurar la carpeta** — vuelve la estructura completa y los documentos a sus carpetas.
4. **Modo `single`** — la carpeta se va sola: sus hijas **y sus documentos** suben al padre, y la papelera dice que no arrastra nada.
5. **Restaurar con el contenedor borrado** — restaurar solo una subcarpeta del lote la deja **colgando de la raíz**, no invisible. Ídem con un documento suelto.
6. **Borrado definitivo** — desaparece de la papelera y ya no se puede restaurar (404). Si tenía tags, el **tag sobrevive** con `documentCount` a 0.
7. **Vaciar** — borra todo lo de la papelera, **no toca lo vivo**, y sobre una papelera vacía devuelve `{ purged: 0 }`.
8. **Aislamiento** — restaurar o purgar algo de otro usuario → **404**; vaciar la papelera de uno no toca la del otro.
9. **Purga automática** — envejecer un elemento en la BD (`deletedAt = now() - interval '31 days'`), bajar el cron a `EVERY_10_SECONDS` **temporalmente**, comprobar que borra el viejo, respeta el reciente y **no vuelve a loguear** cuando ya no queda nada. Revertir el cron.
