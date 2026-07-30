# `lib/` — Cliente de la API

`api.ts` es el **único punto de contacto con el backend** de toda la aplicación. Ningún componente ni Context llama a `fetch` por su cuenta.

## Estructura del módulo

Un solo fichero, `api.ts` (~270 líneas), que hace tres cosas a la vez:

1. El transporte HTTP (`request<T>()`, token, errores).
2. El catálogo de funciones de endpoint.
3. Los tipos del contrato con la API.

Está organizado por bloques con separadores `// ---------------- Categorias ----------------`, en el mismo orden que los módulos del backend.

## Reglas del módulo

- NORMA: **todo endpoint nuevo se añade aquí** y pasa por `request<T>()`. Esa función centraliza la URL base, la cabecera `Content-Type`, el `Authorization`, el parseo del JSON y la conversión de errores. Saltársela deja esas cinco cosas sin hacer.
- NORMA: cada función de endpoint es una línea que devuelve `request<T>(...)`, **sin `async`** y sin `try/catch`. El manejo de errores es responsabilidad de quien llama.
- El **token vive en una variable de módulo** (`let authToken`), mutada con `setAuthToken()`. Es deliberado: el cliente no sabe nada de `localStorage` ni de React. **Quien persiste el token es `AuthContext`**, que llama a `setAuthToken()` al iniciar sesión, al restaurar la sesión y al cerrarla.
- `request()` hace `res.json().catch(() => null)` antes de mirar el status, para que una respuesta sin cuerpo no reviente el parseo.

## Errores

`ApiError extends Error` lleva un campo `status`, que permite distinguir casos en la UI (`err.status === 409` para "email ya registrado"):

```ts
const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
throw new ApiError(msg ?? `Error HTTP ${res.status}`, res.status);
```

Ese `Array.isArray` **depende del formato de error crudo de NestJS**: el `ValidationPipe` devuelve `message` como array de strings. Si el backend añadiera un exception filter, esta línea habría que cambiarla en el mismo commit (ver `.claude/rules/backend.md`).

En los componentes, el patrón es siempre:

```ts
catch (err) {
  setError(err instanceof ApiError ? err.message : 'Mensaje por defecto');
}
```

DEUDA: **no hay interceptor de 401 ni logout automático.** Si el token caduca en pleno uso, cada llamada lanza un `ApiError` que los Contexts capturan con `.catch()`, dejando listas vacías. El usuario ve la app vacía en lugar de volver al login.

## Tipos exportados

Son el contrato con la API, y se importan desde aquí en todo el frontend:

| Tipo | Nota |
|---|---|
| `HealthResponse` | |
| `PublicUser`, `LoginResult` | `createdAt` es **`string`**, no `Date`: viene serializado del JSON |
| `CategoryNode`, `CategoryTreeResult` | `CategoryNode` es recursivo (`children`) |
| `TreeMode` | `'subtree' \| 'single'` |
| `DocumentListItem`, `DocumentFull` | Reflejan `listSelect` / `fullSelect` del backend |

- NORMA: **`contentJson` se tipa como `unknown`**, a propósito, para que el cliente no se acople a los tipos de BlockNote. Quien lo consume (`DocumentPage`) hace el cast en su frontera.
- DEUDA: estos tipos están **duplicados a mano** respecto a los del backend, porque `packages/shared` está vacío. Al cambiar un contrato hay que tocar los dos lados y no hay nada que avise si se desincronizan.

## Validaciones requeridas

Ninguna en esta capa: **no se valida antes de enviar**. La validación es del HTML en el formulario y del `ValidationPipe` en la API; el cliente se limita a transportar el error de vuelta.

Lo que sí hay que respetar: el backend usa `forbidNonWhitelisted`, así que **no se puede reenviar un objeto entero recibido de un GET**. Cada función manda solo los campos que el DTO acepta.

## Cómo verificar el módulo

1. Con la sesión iniciada, comprobar en la pestaña de red del navegador que **todas** las peticiones llevan `Authorization: Bearer …`.
2. Provocar un error de validación (título vacío al guardar) y comprobar que el mensaje que llega a la UI es el del backend, **con los errores unidos por comas** si eran varios.
3. Borrar el token de `localStorage` y recargar: la app debe llevar al login sin errores en consola.
4. Parar la API y hacer una acción: el error debe ser un `ApiError` manejado, no una excepción sin capturar.
