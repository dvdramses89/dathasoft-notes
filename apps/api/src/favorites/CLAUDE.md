# Módulo `favorites`

Favoritos **por usuario** sobre sus propios documentos. Es el módulo más pequeño de la API: la tabla no tiene más columnas que las dos claves y la fecha.

## Estructura del módulo

```
favorites/
├── favorites.module.ts
├── favorites.controller.ts           ← /api/favorites            (listar)
├── document-favorite.controller.ts   ← /api/documents/:documentId/favorite (marcar/desmarcar)
└── favorites.service.ts
```

**No hay carpeta `dto/`**: ninguna de las tres operaciones lleva body. El documento va en la ruta y el usuario en el token, así que no hay nada que validar con `class-validator`.

Es el segundo módulo con **dos controladores**, por el mismo motivo que `tags`: la ruta cuelga de `/documents` pero la lógica vive aquí, y `DocumentsModule` no conoce este módulo.

## Reglas del módulo

### Solo documentos, y solo propios

`Favorite` tiene PK compuesta `@@id([userId, documentId])`: **no se pueden marcar carpetas**. Si algún día se quisiera, es un cambio de esquema, no de este módulo.

Marcar y desmarcar pasan por `assertDocumentOwned()`, que exige `ownerId` **y** `deletedAt: null`. Consecuencia: **un documento de la papelera no se puede marcar** → 404.

### Las dos operaciones son idempotentes

| Operación | Implementación | Repetirla |
|---|---|---|
| Marcar | `favorite.upsert` con la PK compuesta | 201 otra vez, sin duplicar la fila |
| Desmarcar | `favorite.deleteMany` | 200 otra vez, aunque no hubiera nada que borrar |

NORMA: las dos devuelven **el estado final** (`{ favorite: true }` / `{ favorite: false }`), no un contador como `{ removed: n }` de los tags. Es lo que necesita un botón de estrella: saber cómo debe quedar pintado, sin tener que deducirlo.

> Se usa `POST` y no `PUT` **a propósito**: la allowlist de CORS de `main.ts` solo abre GET, POST, PATCH, DELETE y OPTIONS. Añadir `PUT` sería ampliar esa lista para una ruta.

### La papelera no borra el favorito

`GET /api/favorites` filtra `document: { deletedAt: null }`, así que un documento enviado a la papelera **desaparece de la lista pero conserva su fila en `Favorite`**. Al restaurarlo (Fase 6.2) vuelve a aparecer, y en la misma posición de orden que tenía.

NORMA: no añadas un borrado de favoritos al enviar a la papelera. Ese comportamiento es el que hace que restaurar sea reversible de verdad. El borrado físico sí los limpia, por el `onDelete: Cascade` de la FK.

### El listado lo proyecta `DocumentsService`

`FavoritesService` **no sabe dar forma a un documento**. Resuelve la lista en dos pasos:

1. Consulta `Favorite` (que es quien tiene el `createdAt` por el que se ordena) y se queda con los **ids**.
2. Se los pasa a `DocumentsService.listByIds(ownerId, ids)`, que devuelve `DocumentListItem[]` **en ese mismo orden**.

```ts
const rows = await this.prisma.favorite.findMany({
  where: { userId: ownerId, document: { ownerId, deletedAt: null } },
  orderBy: { createdAt: 'desc' },
  select: { documentId: true },
});
return this.documents.listByIds(ownerId, rows.map((row) => row.documentId));
```

- Es el mismo reparto que usa el buscador con sus `rankedIds`: **primero los ids en el orden bueno, después la proyección**. Prisma no sabe ordenar `Document` por un campo de una relación to-many, así que la consulta tiene que salir de `Favorite`.
- Por eso `FavoritesModule` **importa `DocumentsModule`** y `DocumentsModule` exporta su servicio. Es el mismo patrón que `AuthModule` con `UsersModule`, y el motivo de que aquí no se dupliquen `listSelect` ni el cálculo del `excerpt`.
- El `where` lleva `ownerId` **dos veces** (el del favorito y el del documento). No es redundante de más: la segunda condición es la que impide que un favorito sobre un documento ajeno —posible a partir de la compartición de la Fase 9— se cuele en la lista.

### El orden es la fecha de marcado

Del **último marcado al primero** (`createdAt: 'desc'` de `Favorite`). No es alfabético ni por `updatedAt` del documento: la sección de favoritos del sidebar se lee como una pila de accesos recientes.

Desmarcar y volver a marcar **manda el documento al principio**, porque la fila se borra y se crea de nuevo.

## Endpoints del módulo

Todos bajo `@UseGuards(JwtAuthGuard)` a nivel de clase, en los dos controladores.

| Método | Ruta | Entrada | Devuelve |
|---|---|---|---|
| GET | `/api/favorites` | — | `DocumentListItem[]` (último marcado primero) |
| POST | `/api/documents/:documentId/favorite` | — | `{ favorite: true }` · 201 |
| DELETE | `/api/documents/:documentId/favorite` | — | `{ favorite: false }` |

No colisiona con `GET /api/documents/:id`: tiene un segmento más, igual que las rutas de tags.

## `isFavorite` en las respuestas de documentos

**Todas** las respuestas de `documents` llevan `isFavorite: boolean` — detalle, listado, buscador, autoguardado y move. Sale de una relación filtrada por el usuario que consulta, así que **no cuesta ninguna consulta extra**. La implementación está en `documents.service.ts`; el detalle, en `apps/api/src/documents/CLAUDE.md`.

## Modelo / Entidades

`Favorite`: PK compuesta `[userId, documentId]`, índice en `documentId` para recorrer la relación al revés, `Cascade` por los dos lados y **sin soft-delete**. Detalle en `.claude/rules/database.md`.

## Validaciones requeridas

- `documentId` de ruta: `ParseUUIDPipe` → 400 si no es un UUID.
- La propiedad del documento se valida **en el servicio** (`assertDocumentOwned`), con 404 — nunca 403.
- No hay DTO: el body, si llega alguno, se ignora por completo. El `userId` sale siempre de `@CurrentUser()`.

## Cómo verificar el módulo

1. **Vacío al empezar** — `GET /api/favorites` devuelve `[]`.
2. **Marcar** — 201 con `{ favorite: true }`; repetirlo devuelve lo mismo y **no duplica** la fila en la BD.
3. **Forma del listado** — el favorito sale con `excerpt` y `tags`, y **sin `contentJson`, `contentText`, `ownerId` ni `deletedAt`**.
4. **`isFavorite`** — `GET /api/documents/:id`, `GET /api/documents`, `GET /api/documents/search`, `PATCH /:id` y `PATCH /:id/move` lo traen, y solo vale `true` en los marcados.
5. **Orden** — marcar un segundo documento y comprobar que **se pone el primero**.
6. **Desmarcar** — 200 con `{ favorite: false }`; repetirlo también.
7. **Papelera** — enviar un favorito a la papelera lo saca de `/api/favorites`, pero **la fila de `Favorite` sigue en la BD**. Marcar un documento ya en la papelera → 404.
8. **Aislamiento** — con el token de otro usuario, marcar o desmarcar un documento ajeno → **404**. Los favoritos de un usuario **no aparecen** en la lista del otro, y dos usuarios pueden tener favoritos a la vez.
9. **Errores** — sin token → 401 en las tres rutas; UUID inválido → 400; documento inexistente → 404.
