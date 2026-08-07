# `documents/` — Editor y estado de documentos

El módulo con más trampas del frontend. Casi todo lo que hay aquí resuelve un problema concreto de sincronización o de ciclo de vida; si algo parece innecesario, probablemente no lo sea.

## Estructura del módulo

```
documents/
├── DocumentEditor.tsx     ← el editor BlockNote + autoguardado + menu slash
├── DocumentsContext.tsx   ← cache de listados por carpeta
├── codeBlock.ts           ← bloque de código con resaltado (shiki)
└── webLinkBlock.tsx       ← bloque custom de referencia a una URL externa
```

La página que los usa (`pages/DocumentPage.tsx`) vive fuera, pero varias reglas de aquí la afectan.

## Reglas del módulo

### El editor: BlockNote, variante Mantine

- Paquetes: `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` + `shiki`.
- NORMA: **se usa la variante Mantine**, la que corresponde a la librería de componentes de la app. Sus menús son componentes de Mantine, así que **heredan el tema solos** y no hay que remapear casi nada de `--bn-colors-*`. No la cambies por la de Ariakit ni por la de shadcn.
  > Dato para no repetir el análisis: las **tres** variantes de BlockNote 0.52 declaran `react: ^18.0 || ^19.0`. Que la de Mantine exigiera React 19 fue cierto en su día, pero ya no lo es.
- NORMA: **el tema del editor se pasa por prop**, leyendo el de la app:
  ```tsx
  const colorScheme = useComputedColorScheme('light');
  <BlockNoteView editor={editor} theme={colorScheme} … />
  ```
  Nada de `theme="dark"` fijo: dejaría el editor descolgado del interruptor del header.
- **No hay ningún paquete `@tiptap/*` instalado.** BlockNote usa TipTap/ProseMirror por debajo, pero el código **nunca toca esa API**. No importes de TipTap.
- El schema parte de `defaultBlockSpecs`, **sustituye `codeBlock`** y **añade los bloques custom**:
  ```ts
  const schema = BlockNoteSchema.create({
    blockSpecs: { ...defaultBlockSpecs, codeBlock: codeBlockSpec, webLink: webLinkBlockSpec },
  });
  ```
  Se declara **a nivel de módulo**, fuera del componente: crearlo en cada render reinstanciaría el editor.
- NORMA: **la clave del objeto tiene que ser igual que el `type` del config del bloque** (`webLink: webLinkBlockSpec` ↔ `type: 'webLink'`). Si no coinciden, el bloque no se resuelve y la inserción falla **en silencio**, sin excepción.
- Locale español con `dictionary: es` de `@blocknote/core/locales`.
- `initialContent: initialContent?.length ? initialContent : undefined` — un array vacío rompe el arranque del editor; tiene que ser `undefined`.

### Autoguardado

Cuatro piezas que trabajan juntas. Quitar cualquiera pierde datos:

1. **Debounce de 900 ms** (`AUTOSAVE_DELAY`) con `window.setTimeout` guardado en un `useRef`. Cada `onChange` reinicia el contador.
2. **`onBlur={flush}`** — guarda al salir del editor sin esperar al debounce.
3. **Flush en el cleanup del `useEffect`** — al desmontar (cambiar de documento, navegar) guarda **si había un timer pendiente**. Sin esto, escribir y navegar en menos de 900 ms perdería el cambio.
4. **`onSaveRef.current = onSave`** en cada render — el debounce lee siempre el callback actual sin necesidad de reprogramarse. Si se pasara `onSave` directamente al `useEffect`, habría que recrear el timer en cada render del padre.

NORMA: si tocas el autoguardado, mantén las cuatro. El `useEffect` de cleanup depende solo de `[editor]` a propósito.

### Bloques custom (`webLinkBlock.tsx`)

El primero de los bloques de referencia de la Fase 7. Sirve de plantilla para los que faltan.

- Se define con **`createReactBlockSpec`** de `@blocknote/react`, y `content: 'none'` porque no lleva texto editable: todo su estado son props (`url`, `caption`).
- NORMA: **`createReactBlockSpec` devuelve una _factory_, no el `BlockSpec`.** Hay que invocarla:
  ```ts
  export const webLinkBlockSpec = createReactBlockSpec({ … }, { render: … })();
  //                                                                        ^^ obligatorio
  ```
  Es distinto de `createCodeBlockSpec`, que devuelve el spec directamente. Olvidar el `()` no da error de tipos evidente pero deja el schema inservible.
- NORMA: en un bloque `content: 'none'` con formulario propio, **cada `onKeyDown` hace `e.stopPropagation()`**. Sin eso BlockNote captura `Enter` y `Escape` como si fueran del editor y el formulario no puede usarlos.
- El bloque **no toca la API ni el esquema**: se guarda dentro de `contentJson` como `{ type: 'webLink', props: { url, caption } }`, que para el backend es JSONB opaco. Los bloques de referencia que necesiten fila propia en la BD (el adjunto de la 7.4) son otra historia.
- Cancelar distingue dos casos: si el bloque **nunca tuvo URL** se elimina con `removeBlocks` (era un bloque a medio crear); si ya la tenía, solo se revierten los borradores.

### El menú slash es propio

NORMA: el menú `/` **no es el de BlockNote**. `BlockNoteView` lleva `slashMenu={false}` y un `<SuggestionMenuController triggerCharacter="/">` como hijo, cuyo `getItems` compone `getDefaultReactSlashMenuItems(editor)` **más** los ítems de los bloques custom. Al añadir un bloque de referencia nuevo, su ítem se registra ahí, en el grupo «Referencias».

- El filtrado por `query` se hace **a mano** sobre `title` y `aliases` porque la lista ya no es la de BlockNote.
- NORMA: **el `onItemClick` inserta con `insertOrUpdateBlockForSlashMenu`** (de `@blocknote/core/extensions`), la misma función que usan los ítems por defecto:
  ```ts
  onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'webLink' }),
  ```
  Reutiliza el bloque actual si está vacío o solo tiene `/`, y **si ya tiene texto inserta debajo**. No lo sustituyas por `replaceBlocks`: escribir «Mira esto: /enlace» perdería el «Mira esto: ».

### `extractText()`

Recorre bloques e inline content **recursivamente** (incluidos los hijos anidados y los nodos con contenido dentro, como enlaces) y devuelve el texto plano. Ese texto se manda como `contentText` y es lo que alimenta la columna `searchVector` de Postgres.

NORMA: **cada bloque custom nuevo necesita su rama en `extractText`**, o su contenido no será buscable. Los bloques `content: 'none'` no tienen texto que recorrer: se leen sus **props**. Así entra `webLink`:

```ts
if (block.type === 'webLink') {
  const text = [caption, url].filter(Boolean).join(' ');   // "GitHub https://github.com"
  if (text.trim()) lines.push(text);
} else {
  … fromInline(block.content)
}
```

NORMA: la firma es **`extractText(blocks: readonly unknown[])`**, con un tipo `RawBlock` interno para leer las props. No es dejadez: el schema extendido produce `Block<CustomSchema>[]`, que TypeScript no considera asignable a `Block[]`. Por lo mismo, los tres puntos donde se llama a `onSaveRef.current()` castean con `as unknown as Block[]`. Si tipas el parámetro como `Block[]`, el `build:web` deja de compilar.

### Reglas que afectan a `DocumentPage`

- NORMA: **`key={doc.id}` al montar `<DocumentEditor>`.** `initialContent` de BlockNote **no es reactivo**: sin la key, al cambiar de documento se quedaría el contenido del anterior. Es un remount deliberado, no un descuido.
- NORMA: **guarda de carrera con `currentId = useRef<string|undefined>()`.** Un guardado lento del documento A puede resolverse cuando ya se ha abierto el B; sin comparar contra `currentId`, escribiría el estado del documento equivocado.

### `codeBlock.ts`

`createCodeBlockSpec` con **21 lenguajes** declarados con nombre y aliases, tema shiki `github-dark-default` e `indentLineWithTab: true`.

> Ese tema es oscuro y **no cambia con el tema de la app**. Por eso el bloque de código lleva fondo oscuro también en modo claro: es deliberado (ver `.claude/rules/frontend.md`), no un olvido.

NORMA: **shiki se carga de forma diferida**, y así debe seguir:
```ts
createHighlighter: () => import('shiki').then(({ createHighlighter }) => createHighlighter({ ... })),
```
Importarlo de forma estática mete todo el resaltador en el bundle inicial.

Para añadir un lenguaje, se declara en esa lista con sus aliases.

### `DocumentsContext`

Cache manual de listados, con **carga perezosa**:

- `byCategory: Record<string, DocumentListItem[]>`, indexado con `keyOf()`: el id de la carpeta, o `'root'` para la raíz.
- NORMA: **una clave ausente significa "todavía no cargado"**, y es distinto de un array vacío ("cargado, y no hay documentos"). El sidebar usa esa diferencia para decidir si pide los datos al expandir. No inicialices las claves a `[]`.
- **Dedupe de peticiones en vuelo** con `inFlight = useRef<Set<string>>`: expandir y colapsar rápido no lanza dos veces el mismo listado. Se usa una ref y no estado porque debe leerse de forma síncrona.
- Si la petición falla, la clave se rellena con `[]` para no dejar la carpeta en carga infinita.
- A diferencia de `CategoriesContext` (que recarga entero tras cada mutación), aquí **sí hay actualizaciones optimistas**: `create`, `move`, `remove` y `reorder` mutan el mapa en local. `reorder` reordena antes de llamar a la API para que el drag & drop no parpadee.
- `patchLocal()` existe para reflejar en el listado un cambio ya guardado por otra vía — el caso real es el título editado desde `DocumentPage`.
- NORMA: los endpoints que devuelven un documento entero (`create`, `move`, `update`) dan un **`DocumentFull`**, y el mapa guarda **`DocumentListItem`**. La conversión pasa **siempre** por `toListItem()` de `lib/api.ts`: los dos tipos ya no son compatibles, porque el del listado lleva `excerpt` y no `contentText`.
- **`current` / `setCurrent`** guardan el documento abierto para las migas de pan del header. Lo publica `DocumentPage` al cargarlo y lo limpia al desmontarse. Las mutaciones de aquí (`rename`, `move`, `remove`, `patchLocal`) lo mantienen al día, así que renombrar desde el sidebar también actualiza las migas.

## Validaciones requeridas

Ninguna propia: el título se valida en el backend (1-200 caracteres) y el contenido no se valida en ningún sitio.

`contentJson` se recibe tipado como `unknown` desde `lib/api.ts` y se castea a `PartialBlock[]` en la frontera de `DocumentPage`. Ver la regla 5 de `.claude/rules/security.md`: es contenido no confiable y no debe acabar nunca en HTML sin sanitizar.

## Cómo verificar el módulo

1. **Autoguardado por inactividad** — escribir, esperar ~1 s sin tocar nada, recargar: el cambio está.
2. **Guardado al salir del foco** — escribir y hacer clic fuera del editor: guarda sin esperar.
3. **Guardado al navegar** — escribir y **cambiar de documento en menos de 900 ms**. El cambio debe persistir. Es el caso que se rompe si se toca el cleanup.
4. **Cambio de documento** — abrir A, abrir B: el contenido de B aparece de verdad (si se ve el de A, falta la `key`).
5. **Carrera** — con la red lenta, escribir en A y saltar a B enseguida: el documento B **no** debe quedar con el contenido de A.
6. **Buscabilidad** — tras editar, comprobar en la BD que `contentText` refleja el texto plano, incluidos los bloques anidados.
7. **Resaltado** — insertar un bloque de código, probar varios lenguajes y comprobar en la pestaña de red que el chunk de shiki se carga **aparte**, no en el bundle inicial.
8. **Carga perezosa** — expandir una carpeta lanza **una sola** petición; colapsar y volver a expandir no lanza otra.
9. **Bloques custom** — teclear `/enlace`, insertarlo, guardar una URL y comprobar que la tarjeta muestra etiqueta y hostname; recargar y verificar que vuelven **las dos props**. Escape en un bloque recién creado lo elimina.
10. **Texto previo** — escribir «Mira esto: » y luego `/enlace`: el texto **no** se pierde y el bloque entra debajo.
11. **Consola limpia** en todo el recorrido.

> Al automatizar esto con Playwright: **seleccionar el ítem del menú `/` con `Enter`, no con `click()`**. Los ítems hacen `preventDefault` en `mousedown` para no perder el foco del editor, así que un clic sintético cierra el menú sin ejecutar el `onItemClick` — y no lanza ningún error, así que parece que el bloque «no se renderiza». Conviene además escuchar `page.on('pageerror')`: `page.on('console')` no ve las excepciones no capturadas.
