# `trash/` — Estado de la papelera

Una sola pieza de estado. La pantalla vive en `pages/TrashPage.tsx` y la entrada del sidebar, en `components/Sidebar.tsx`; las dos leen de aquí.

## Estructura del módulo

```
trash/
└── TrashContext.tsx   ← lista, contador y todas las llamadas a la API
```

## Reglas del módulo

### Por qué hay Context y no estado local en la página

Porque **el contador del sidebar y la pantalla tienen que ver lo mismo**. Restaurar algo desde `/trash` baja el número de la fila «Papelera» al instante, y enviar algo a la papelera desde el árbol lo sube sin recargar.

Es el mismo motivo por el que `FavoritesContext` existe, con una diferencia: aquí **no hay `resolve()` ni fallback**, porque un documento no lleva encima "estoy en la papelera" — si está, no aparece en ningún listado.

### Sin actualizaciones optimistas

NORMA: las tres mutaciones (`restore`, `purge`, `empty`) **llaman a la API y luego recargan**. Nada de adivinar el resultado en local, a diferencia de `DocumentsContext`.

El motivo es que restaurar **mueve cosas**: una carpeta vuelve con su subárbol y sus documentos, y si su contenedor sigue borrado aparece en otro sitio. Reproducir eso en el cliente sería duplicar la lógica del servidor para una lista que siempre es corta.

### El plazo de purga lo dice la API

`retentionDays` viene en la respuesta de `GET /api/trash`. NORMA: **no lo escribas a mano en la UI** — sale del `.env` del servidor y ahí puede valer otra cosa.

### Quién avisa al contexto

`TrashContext` **no se entera de que algo se ha ido a la papelera**: lo provoca otra pantalla. Por eso quien borra llama a su `reload()`:

- `Sidebar.confirmDocDelete()` y `Sidebar.confirmDelete()` (carpetas).
- `HomePage.confirmBulkDelete()`.

NORMA: si añades otra vía de borrado, acuérdate del `reload()`. Es el mismo criterio que ya se sigue con `reloadTree()` y con los favoritos, y a estas alturas los tres suelen ir juntos.

### En sentido contrario: lo que cambia al restaurar

`TrashPage` hace lo inverso — tras cualquier acción refresca **los otros tres contextos** en `refreshEverything()`: el árbol de carpetas, el listado de la raíz y los favoritos. Restaurar devuelve carpetas y documentos al árbol, y el borrado definitivo puede dejar documentos sueltos en la raíz.

## La pantalla (`pages/TrashPage.tsx`)

- Dos listas separadas, **Carpetas** y **Documentos**, con las filas `.row-item` de la vista de lista. Sin CSS nuevo.
- Cada carpeta dice **lo que arrastra** (`Contiene 2 subcarpetas · 7 documentos`), a partir del `contains` que da la API. Los elementos arrastrados **no se listan por separado**.
- **Acciones por fila** (restaurar / eliminar definitivamente) y **selección múltiple** con la misma barra flotante que la vista de carpeta.
- NORMA: la selección usa **los endpoints en lote** (`POST /api/trash/restore` y `/purge`), no N llamadas seguidas como hace el borrado en lote de `HomePage`. Con muchos elementos, N peticiones es justo lo que se quería evitar.
- El borrado definitivo y el vaciado **siempre piden confirmación**, y el texto dice que no se puede deshacer. Restaurar no la pide: es reversible.
- El aviso del plazo y la explicación de qué pasa al restaurar una carpeta van **arriba de la lista**, no en el diálogo: es información que ayuda antes de decidir.

## Validaciones requeridas

Ninguna propia. La API rechaza la selección vacía con 400 y las selecciones desactualizadas con 404; el mensaje se muestra tal cual en la pantalla.

## Cómo verificar el módulo

1. **Vacía** — la fila del sidebar no tiene número y la pantalla lo dice; **no** hay botón de vaciar.
2. **Contador** — enviar algo a la papelera desde la vista de carpeta o desde el árbol lo sube **sin recargar**.
3. **Contenido** — una carpeta borrada con estructura sale **una vez**, con su `Contiene …`, y lo que arrastra **no** aparece suelto.
4. **Restaurar por fila** — desaparece de la papelera, baja el contador y **vuelve al árbol**.
5. **Restaurar una carpeta** — vuelve con su subárbol y sus documentos.
6. **Selección múltiple** — marcar dos y restaurarlos de una vez; comprobar en la pestaña de red que es **una sola petición**.
7. **Eliminar definitivamente** — pide confirmación; al aceptar desaparece para siempre.
8. **Vaciar** — con confirmación, deja la papelera vacía.
9. **Navegación** — la fila queda marcada, «Mi espacio» deja de estarlo, las migas dicen «Papelera» y pulsar una carpeta del árbol **sale** de `/trash`.
10. **URL directa** — `/trash` funciona al recargar.
11. **Tema oscuro y móvil**, y **consola limpia**.
