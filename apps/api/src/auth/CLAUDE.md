# Módulo `auth`

Registro, login y sesión. Es el único módulo que expone al usuario, y el que provee `@CurrentUser()` al resto de la API.

Las normas de autenticación y autorización están en `.claude/rules/security.md`.

## Estructura del módulo

```
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── decorators/current-user.decorator.ts
├── dto/{login,register}.dto.ts
├── guards/jwt-auth.guard.ts
└── strategies/jwt.strategy.ts
```

`auth/` es la **única carpeta con subcarpetas transversales** (`decorators/`, `guards/`, `strategies/`). Todo lo relativo a la sesión vive aquí; no hay `common/`.

Depende de `users/`, que es un **módulo sin controller**: solo expone `UsersService` (`findByEmail`, `findById`, `create`) para que `AuthService` acceda a la tabla `User`. Los usuarios no tienen superficie HTTP propia.

## Reglas del módulo

- **`toPublicUser()` es la única salida de un `User`.** Proyecta a `{id, email, name, createdAt}`. Ningún otro sitio construye la respuesta de usuario a mano: si añades un campo público, se añade ahí.
- El guard se aplica **a nivel de método** (`@UseGuards(JwtAuthGuard)` sobre `me()`), no de clase — es el único controlador donde ocurre, porque `register` y `login` son públicos. En el resto de controladores el guard va sobre la clase.
- `@CurrentUser()` lee `request.user`, que es exactamente lo que devuelve `JwtStrategy.validate()`: un `PublicUser` recién cargado de la BD, no el payload del token.
- Las interfaces `PublicUser`, `LoginResult` y `JwtPayload` se exportan desde `auth.service.ts`. Todo el resto de la API las importa de ahí con `import type`.

## Endpoints del módulo

| Método | Ruta | Guard | Body | Devuelve |
|---|---|---|---|---|
| POST | `/api/auth/register` | Throttler (`register`) | `RegisterDto` | `PublicUser` · **201** |
| POST | `/api/auth/login` | Throttler (`login`) | `LoginDto` | `{ accessToken, user }` · **200** |
| GET | `/api/auth/me` | JWT | — | `PublicUser` · 200 |

- `register` lleva `@HttpCode(HttpStatus.CREATED)`, que es redundante (201 ya es el default de un POST) pero explícito.
- `login` lleva `@HttpCode(HttpStatus.OK)` y **eso sí es necesario**: sin él, Nest devolvería 201 por ser POST, y un login no crea nada.
- `register` y `login` son los **únicos endpoints de la API con rate limiting**, cada uno con su propio contador (`@SkipThrottle` descarta el del otro). `me()` no lo lleva. Los límites y el porqué del diseño están en `.claude/rules/security.md`.
- Este es el **único controlador que declara el tipo de retorno** de sus métodos (`Promise<PublicUser>`, `Promise<LoginResult>`).

## Modelo / Entidades

Solo `User` (ver `apps/api/prisma/schema.prisma`). Es el único modelo **genérico y reutilizable** del esquema — ver [TEMPLATE.md](../../../../TEMPLATE.md).

El payload del token es mínimo a propósito: `{ sub: userId, email }`. No metas ahí nombre, roles ni permisos: `validate()` recarga el usuario en cada petición, así que el token no necesita transportar estado.

## Validaciones requeridas

- `RegisterDto`: `email` con `@IsEmail`, `password` con mínimo 8 caracteres, `name` obligatorio. Mensajes en español.
- `LoginDto`: `email` y `password`, sin restricciones de longitud (validar aquí la longitud filtraría credenciales antiguas y daría un error distinto según el caso).
- Email duplicado → `ConflictException` (409) desde el servicio, no desde el DTO: la unicidad no se puede validar sin consultar la BD.

## Cómo verificar el módulo

1. **Registro** — alta correcta devuelve 201 con el usuario **sin `passwordHash`**.
2. **Email duplicado** — repetir el alta devuelve 409.
3. **Contraseña corta** — menos de 8 caracteres devuelve 400 con el mensaje en español.
4. **Campo extra en el body** — devuelve 400 (`forbidNonWhitelisted`).
5. **Login correcto** — devuelve **200** (no 201) con `accessToken` y `user`.
6. **Login con email inexistente** y **login con contraseña mala** — ambos devuelven 401 con **el mismo mensaje**. Si difieren, se ha roto la anti-enumeración.
7. **`/me` sin token** → 401. **Con token válido** → el usuario. **Con token manipulado** → 401.
8. **Usuario borrado de la BD con su token aún vigente** → `/me` devuelve 401 (lo comprueba `validate()`).
9. **Rate limiting** — pasado el límite de login, la siguiente petición devuelve **429** con el mensaje en español; al expirar el TTL vuelve a aceptar. Agotar el contador de login **no** bloquea `register` (ni al revés), y ningún otro endpoint devuelve 429. Para probarlo sin esperar, arranca con `THROTTLE_LOGIN_TTL=5 THROTTLE_LOGIN_LIMIT=3`.
