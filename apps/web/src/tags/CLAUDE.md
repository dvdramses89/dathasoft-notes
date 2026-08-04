# `tags/` — Catálogo de tags y selector del documento

Los tags son **transversales** al árbol de carpetas. Esta carpeta tiene el estado global (el catálogo) y los dos componentes que lo pintan; el diálogo de gestión vive en `components/TagsModal.tsx`.

## Estructura del módulo

```
tags/
├── TagsContext.tsx   ← catálogo del usuario + todas las llamadas a la API
├── TagChips.tsx      ← chips de solo lectura (vista de carpeta)
└── TagPicker.tsx     ← chips + añadir/quitar (página del documento)
```

## Reglas del módulo

### El catálogo es la fuente de verdad del nombre y el color

Esta es **la regla que explica el diseño del módulo**. Un documento trae sus tags en la respuesta de la API, pero esos datos envejecen en cuanto se renombra o elimina un tag desde el diálogo de gestión.

Por eso `TagsContext` expone `resolve(tags)`, y **los dos componentes lo usan antes de pintar**:

```ts
resolve(docTags) // -> cada tag sustituido por su version del catalogo
```

- Un tag **renombrado o recoloreado** se ve al instante en todos los chips ya pintados.
- Un tag **eliminado** desaparece de ellos, aunque el listado en cache siga trayéndolo.
- NORMA: gracias a esto **no hace falta recargar los listados** de `DocumentsContext` tras tocar un tag. No añadas un `refreshAll()`: el problema ya está resuelto aquí.
- Mientras `loaded` es `false` se devuelven los tags del documento tal cual, para que los chips no parpadeen en el primer render.

### Todas las llamadas de tags pasan por el Context

`TagsContext` es el único que llama a `lib/api.ts` para tags, y **después de cada mutación hace `reload()`**: el catálogo y los `documentCount` se rehacen con una petición ligera. Es el mismo criterio que `CategoriesContext` (recargar entero) y no el de `DocumentsContext` (mutaciones optimistas): el catálogo es pequeño y la simplicidad compensa.

Se monta en `AppLayout`, dentro de la zona protegida, junto a los otros dos providers.

### Añadir es por nombre

El `TagPicker` no crea el tag antes de vincularlo: manda el **nombre** y la API hace get-or-create (ver `apps/api/src/tags/CLAUDE.md`). Consecuencias en la UI:

- El campo es un **`Autocomplete`**, no un `Select`: sugiere los tags que ya tienes pero **acepta texto libre**.
- Del desplegable se quitan los tags que el documento ya lleva.
- Escribir un nombre existente con otras mayúsculas **no duplica nada**: la API devuelve el mismo tag.
- Un tag creado desde aquí **nace sin color** (se pinta gris). El color se elige en el diálogo de gestión — el picker no pregunta por él para no convertir "escribir y Enter" en un formulario.
- La respuesta de vincular es **la lista completa de tags del documento**, así que el padre reemplaza su estado en lugar de recomponerlo.

### Quién es dueño del estado en la página del documento

`DocumentPage` mantiene el `DocumentFull` y le pasa `doc.tags` al picker. Cuando el picker guarda, llama a `onChange` y la página hace **dos** cosas:

```ts
setDoc(updated);      // los chips de la hoja
patchLocal(updated);  // los chips del listado y las migas de pan
```

NORMA: sin el `patchLocal`, la tarjeta de la vista de carpeta se quedaría con los tags viejos hasta el siguiente listado.

### Presentación

- Un tag sin color se pinta **gris** (`NO_COLOR`), en los dos componentes.
- `TagChips` recorta a `max` chips y resume el resto en un `+N`: 3 en la vista de tarjetas, 2 en la compacta y en la de lista.
- Los colores son **nombres de color de Mantine**, del mismo catálogo `FOLDER_COLORS` que usan las carpetas (`theme.ts`). No hay una paleta propia de tags.
- NORMA: los controles que solo llevan icono tienen nombre accesible — `Añadir etiqueta` en el botón «+», `Quitar la etiqueta X` en cada chip. Es lo que permite manejarlos sin ratón y lo que usan las comprobaciones.

## Validaciones requeridas

Ninguna propia más allá de no enviar cadenas vacías: el nombre lo valida el backend (1-50 caracteres, duplicado → 409) y el error se muestra tal cual. En el picker sale como texto rojo a la derecha; en el diálogo de gestión, en un `Alert`.

## Cómo verificar el módulo

1. **Crear desde el documento** — abrir un documento, «+», escribir un nombre nuevo y Enter: aparece el chip y el tag pasa a estar en el catálogo.
2. **Autocompletar** — en otro documento, escribir las primeras letras de ese tag: sale en el desplegable y al elegirlo se vincula.
3. **Mayúsculas** — escribir el mismo nombre en mayúsculas **no** crea un segundo chip ni un segundo tag.
4. **Quitar** — la X del chip lo quita del documento, pero el tag sigue en el diálogo de gestión.
5. **Recargar** — los tags siguen ahí.
6. **Vista de carpeta** — los chips salen en los tres modos de vista, y un documento con más de 3 muestra el `+N`.
7. **Renombrar desde el diálogo** — el nombre cambia **también en las tarjetas ya pintadas, sin recargar**. Ídem con el color.
8. **Eliminar desde el diálogo** — pide confirmación diciendo en cuántos documentos está, y al confirmar desaparece de todos los chips sin recargar.
9. **Duplicado** — crear en el diálogo un tag que ya existe (aunque sea con otras mayúsculas) muestra el 409 del backend.
10. **Tema oscuro y móvil** — los chips se leen bien y el selector cabe en el ancho pequeño.
11. **Consola limpia** en todo el recorrido.
