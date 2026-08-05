# `favorites/` — Estrella y sección del sidebar

Los favoritos son **del usuario y solo de documentos** (no hay favoritos de carpetas: la tabla no lo permite). Esta carpeta tiene el estado global y los dos componentes que lo pintan.

## Estructura del módulo

```
favorites/
├── FavoritesContext.tsx   ← lista + marca, y todas las llamadas a la API
├── FavoriteStar.tsx       ← la estrella, reutilizable en cualquier sitio
└── FavoritesSection.tsx   ← la sección «Favoritos» del sidebar
```

## Reglas del módulo

### El contexto es la fuente de verdad de la estrella

Misma regla que los tags, y por el mismo motivo: un documento trae su `isFavorite` en la respuesta de la API, pero ese dato envejece en cuanto se marca algo desde otra pantalla.

```ts
isFavorite(documentId, fallback) // -> la marca real, con el dato del documento como respaldo
```

- El `fallback` es el `isFavorite` que trajo la API y **solo se usa mientras `loaded` es `false`**, para que la estrella no parpadee en el primer render.
- Gracias a esto, marcar en una tarjeta se ve **al instante** en la hoja del documento y en el sidebar, sin recargar ningún listado. NORMA: no añadas un refresco de `DocumentsContext` al marcar; el problema ya está resuelto aquí.

### Dos estados, y es a propósito

`favorites` (la lista ordenada, para el sidebar) y `ids` (un `Set`, para la marca) **no son uno derivado del otro**:

- `toggle()` actualiza el `Set` **de forma optimista**, para que la estrella responda al pulsarla.
- La llamada a la API va después, y el `reload()` del `finally` vuelve a cuadrar los dos estados con la respuesta real. Si la petición falla, ese reload deshace la marca optimista.

Es una mezcla deliberada de las dos políticas que ya había: optimismo como `DocumentsContext`, recarga completa como `TagsContext`. La lista es pequeña, así que recargarla entera sale barato y evita tener que insertar el documento en su sitio a mano.

### Qué NO sabe el contexto

`FavoritesContext` **no se entera de que un documento se ha ido a la papelera**: la API lo excluye de la lista, pero nadie se lo dice al front. Por eso quien borra llama a `reload()` explícitamente:

- `Sidebar.confirmDocDelete()` — junto al `reloadTree()` que ya hacía.
- `HomePage.confirmBulkDelete()` — ídem.

NORMA: si añades otra vía de borrado de documentos, recuerda el `reload()` de favoritos. Es el mismo criterio que ya se sigue con `reloadTree()`.

### `FavoriteStar`

Un `ActionIcon` con `IconStar` / `IconStarFilled`, amarillo cuando está marcado y gris cuando no. Se usa en **cuatro** sitios: la hoja del documento, la tarjeta y la fila de lista de la vista de carpeta, y la sección del sidebar.

- NORMA: lleva **`stopPropagation`** en el `onClick`. Casi siempre está dentro de algo que ya es pulsable (una tarjeta que abre el documento, una fila del árbol); sin eso, marcar abriría el documento.
- El nombre accesible **cambia con el estado** (`Añadir a favoritos` / `Quitar de favoritos`), y es lo que usan las comprobaciones para saber cómo está. El `Tooltip` repite ese mismo texto.
- `size` acepta talla de Mantine o píxeles: `sm` en las filas y tarjetas, el default de 30 en la hoja del documento.
- En las tarjetas va **junto al checkbox** de selección múltiple, no en su lugar: esa esquina ya era la zona de controles de la tarjeta.

### `FavoritesSection`

- NORMA: **si no hay favoritos devuelve `null`** — ni título, ni hueco, ni texto de ayuda. Quien no usa la función no ve nada.
- Reutiliza las clases del árbol (`tree-row`, `tree-row-name`, `tree-row-actions`, `tree-list`), así que las filas se ven exactamente igual que las del sidebar y **no hay CSS nuevo**.
- **No tiene drag & drop**: el orden lo decide la fecha de marcado, no el usuario.
- Al abrir un favorito hace `select(null)` antes de navegar, igual que `openDoc()` del sidebar: solo un nodo marcado a la vez.
- El mismo documento puede salir **dos veces** en el sidebar (en Favoritos y en su carpeta), y los dos se marcan como activos a la vez. Es correcto: es el mismo documento abierto.

### Dónde se marca

Tres sitios, decididos con el usuario:

| Sitio | Control |
|---|---|
| Hoja del documento | Estrella junto al indicador de guardado |
| Vista de carpeta | Estrella en la tarjeta (los tres modos) |
| Sidebar | Entrada del menú de tres puntos, y la estrella de la propia sección |

`DocItem` (en `components/Sidebar.tsx`) llama a `useFavorites()` **directamente**, sin recibirlo por props: `TreeItem` es recursivo y habría que arrastrar el dato por todos los niveles.

**`SearchPage` no lleva estrella todavía.** Es lo único que muestra documentos y no la tiene; queda anotado en [PLAN.md](../../../../PLAN.md), no es un olvido.

## Validaciones requeridas

Ninguna: no hay formulario ni entrada de texto. Las dos operaciones son idempotentes en la API, así que un doble clic rápido no rompe nada.

## Cómo verificar el módulo

1. **Sin favoritos** — la sección **no aparece** en el sidebar.
2. **Marcar en la hoja** — la estrella se rellena y la sección aparece con ese documento.
3. **Recargar** — sigue marcado.
4. **Marcar en una tarjeta** — **no abre** el documento, y el sidebar lo recoge sin recargar.
5. **Los tres modos de vista** — tarjetas, compacta y lista tienen estrella.
6. **Menú del sidebar** — el texto alterna entre «Añadir a favoritos» y «Quitar de favoritos».
7. **Orden** — el último marcado sale **el primero** de la sección.
8. **Abrir desde la sección** — navega al documento y la fila queda marcada como activa.
9. **Quitar desde la sección** — la fila desaparece; al quedarse sin ninguno, la sección entera se va.
10. **Coherencia** — desmarcar en la hoja actualiza el sidebar y la tarjeta **sin recargar**.
11. **Papelera** — un favorito enviado a la papelera desaparece de la sección.
12. **Tema oscuro y móvil** — la estrella contrasta y la sección se ve con el sidebar desplegado.
13. **Consola limpia** en todo el recorrido.
