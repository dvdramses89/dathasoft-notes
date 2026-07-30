# Seguridad — DTNotes

## Reglas base (siempre)

Innegociables. Aplican a **todo código nuevo**, esté o no reflejado en el código actual.

1. **Todo endpoint va protegido con el token del usuario.** Las únicas rutas públicas son `/api/health`, `/api/health/db`, `/api/auth/register` y `/api/auth/login`. Cualquier endpoint nuevo lleva `@UseGuards(JwtAuthGuard)`. Si alguno tuviera que ser público, se justifica antes de escribirlo.
2. **Nunca confiar en el `ownerId` que venga del cliente.** Siempre se toma de `@CurrentUser()`. Jamás del body, de la query ni de un parámetro de ruta. Un DTO **no debe declarar** un campo `ownerId`/`userId`.
3. **Sin SQL crudo.** Todo acceso a datos va por el cliente de Prisma, que parametriza. Si algún día hiciera falta SQL a mano, **solo** con la forma de template tag — `` prisma.$queryRaw`SELECT ... WHERE id = ${id}` `` —, que parametriza de verdad. **Nunca `$queryRawUnsafe`, nunca `$executeRawUnsafe`, nunca concatenar strings** para construir una consulta.
4. **Toda entrada externa se valida con un DTO y `class-validator`.** El `ValidationPipe` global lleva `whitelist` + `forbidNonWhitelisted`, así que un campo no declarado se rechaza con 400. NORMA: no leer `@Body()` sin tipo ni saltarse el DTO "porque es un caso simple".
5. **`contentJson` es contenido no confiable.** Llega del editor del usuario y se guarda como JSONB opaco. Nunca se ejecuta, nunca se interpola en HTML, nunca se pasa a `dangerouslySetInnerHTML`. En el front lo renderiza BlockNote, que escapa. NORMA: cuando la Fase 8 exporte a HTML o PDF, **hay que sanitizar en ese punto** — es donde el contenido deja de ser un árbol de datos y pasa a ser marcado.
6. **Nada de `eval`, `new Function` ni `dangerouslySetInnerHTML`** en el frontend. Hoy no hay ninguno; que siga así.
7. **Los ficheros subidos no se sirven desde el origen de la app** sin `Content-Type` forzado y `Content-Disposition: attachment`. Un SVG o un HTML servido inline desde el mismo origen es XSS almacenado con acceso a la sesión. Aplica cuando se implementen los adjuntos (Fase 7).
8. **Ningún secreto en variables `VITE_*`.** Todo lo que lleva ese prefijo acaba en el bundle del navegador y es público. Las claves de servidor van en `apps/api/.env` y no salen de ahí.
9. **Ningún secreto en logs ni en mensajes de error devueltos al cliente**: ni `passwordHash`, ni el token, ni la `DATABASE_URL`, ni la traza de una excepción de Prisma.
10. **Los errores de autorización devuelven 404, no 403.** Ver la sección de ownership: no se revela que un recurso ajeno existe.

## Autenticación

- **JWT simétrico, sin refresh token.** `JwtModule.registerAsync` lee `JWT_SECRET` y `JWT_EXPIRES_IN` del `ConfigService`, con default `'1d'` si falta la expiración.
- Payload mínimo: `{ sub: userId, email }` (tipo `JwtPayload`, exportado desde `auth.service.ts`).
- Extracción: `ExtractJwt.fromAuthHeaderAsBearerToken()`, con `ignoreExpiration: false`.
- NORMA: **`validate()` recarga el usuario desde la BD en cada petición** ([jwt.strategy.ts:23-27](../../apps/api/src/auth/strategies/jwt.strategy.ts#L23-L27)) y lanza `UnauthorizedException` si ya no existe. Cuesta una query por request autenticada, y a cambio un usuario borrado queda invalidado al instante sin esperar a que caduque su token. Es deliberado: no sustituirlo por confiar solo en el payload.
- NORMA: **solo existe `JwtAuthGuard`** (`extends AuthGuard('jwt')`), aplicado con `@UseGuards(JwtAuthGuard)` **a nivel de clase** en los controladores protegidos. **No hay `RolesGuard`, ni decorador `@Roles`, ni `@Public()`, ni `APP_GUARD` global — no los inventes.** El enum `MemberRole {MEMBER, ADMIN}` existe en la BD pero no tiene lógica asociada todavía.

## Autorización: ownership en la capa de servicio

**Este es el patrón central del proyecto. Replícalo en cada endpoint nuevo.**

La autorización **no está en guards**: está en los servicios. El guard solo dice *quién eres*; el servicio decide *a qué puedes llegar*.

- Toda operación recibe `ownerId` como **primer argumento**, y el controlador se lo pasa desde `@CurrentUser()`:
  ```ts
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.id, dto);
  }
  ```
- Los helpers privados `assertOwned()` / `assertCategoryOwned()` buscan filtrando **siempre por los tres campos** y lanzan **404, no 403** ([categories.service.ts:194-202](../../apps/api/src/categories/categories.service.ts#L194-L202)):
  ```ts
  private async assertOwned(ownerId: string, id: string): Promise<Category> {
    const cat = await this.prisma.category.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }
  ```
  El 404 es intencionado: un 403 confirmaría que ese recurso existe y pertenece a otro.
- **Toda lectura incluye `ownerId` en el `where`.** NORMA: nunca `findUnique({ where: { id } })` a secas sobre un recurso de usuario — usa `findFirst` con el filtro completo.
- **Al mover o vincular, se valida también el recurso destino.** Crear un documento dentro de una carpeta o moverlo a otra pasa por `assertCategoryOwned()`; si no, se podría insertar contenido en la carpeta de otro usuario.

## Fuga de información

- NORMA: **login usa el mismo mensaje** `'Credenciales invalidas'` tanto si el email no existe como si la contraseña falla ([auth.service.ts:50-61](../../apps/api/src/auth/auth.service.ts#L50-L61)). Sin esto, el endpoint sería un oráculo de qué emails están registrados.
- DEUDA: **`register` sí revela emails existentes** con un 409 `'El email ya esta registrado'`. Es el compromiso de UX habitual (el usuario necesita saber por qué falla el alta), pero es una vía de enumeración. Está asumido; no cambiarlo por sorpresa.
- `passwordHash` **nunca sale de la API**: la única forma de devolver un `User` es el mapper `toPublicUser()`, que proyecta a `{id, email, name, createdAt}`.

## Contraseñas

- `bcryptjs` (implementación JS pura, no el binario nativo), **cost factor 10** en [auth.service.ts:39](../../apps/api/src/auth/auth.service.ts#L39).
- Comparación con `bcrypt.compare`, nunca comparando hashes a mano.
- Longitud mínima 8, validada en el DTO con mensaje en español.

## Integridad de datos

Validaciones que protegen la estructura, no solo el acceso. Son parte de la seguridad porque un árbol corrupto o un reorder malicioso rompen la aplicación de otros modos.

- **Prevención de ciclos en el árbol de carpetas** ([categories.service.ts:108-121](../../apps/api/src/categories/categories.service.ts#L108-L121)): se rechaza `parentId === id` y, en modo `SUBTREE`, se calcula el conjunto de descendientes y se rechaza mover una carpeta dentro de uno de ellos. En `SINGLE` no hay riesgo porque las hijas se desvinculan antes.
- **Validación estricta de `reorder`** ([categories.service.ts:173-183](../../apps/api/src/categories/categories.service.ts#L173-L183)): rechaza IDs duplicados y exige que la lista coincida **exactamente** —mismo tamaño y mismos elementos— con los hermanos reales de ese nivel. Luego aplica las posiciones dentro de `prisma.$transaction`, para que no quede un orden a medias.
- NORMA: cualquier operación que escriba varias filas que deban quedar consistentes va en `$transaction`.

## Secretos y configuración

- **Nunca se commitea un `.env` real.** `.gitignore` ignora `.env` y `.env.*` con la excepción `!.env.example`. Cada app documenta sus claves en su `.env.example`.
- Generar un secreto nuevo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Nada de valores sensibles hardcodeados en el código, ni siquiera como default de desarrollo.

## Deuda de seguridad conocida

Asumida a sabiendas mientras el proyecto corre **solo en local**. Se aborda en la **Fase 4.5** de [PLAN.md](../../PLAN.md), no antes y no de paso.

- DEUDA: `secretOrKey: config.get<string>('JWT_SECRET') ?? ''` ([jwt.strategy.ts:17](../../apps/api/src/auth/strategies/jwt.strategy.ts#L17)) — **fallback a cadena vacía**. Si la variable falta, la API arranca igualmente y acepta tokens firmados con `''`. Es la deuda más grave de la lista.
- DEUDA: `app.enableCors()` **sin opciones** ([main.ts:22](../../apps/api/src/main.ts#L22)) — CORS totalmente abierto, sin allowlist ni distinción por `NODE_ENV`.
- DEUDA: **sin `helmet`** — no se envían cabeceras de seguridad.
- DEUDA: **sin rate limiting** (`@nestjs/throttler` no está instalado). `/api/auth/login` no tiene ninguna protección de fuerza bruta.
- DEUDA: el token se guarda en **`localStorage`** (clave `dtnotes_token`), expuesto a XSS. Cambiarlo a cookie httpOnly implicaría rehacer el cliente API y añadir CSRF, así que se mantiene.
- DEUDA: `ConfigModule.forRoot({ isGlobal: true })` **sin `validationSchema`** — ninguna variable de entorno es obligatoria al arrancar.
- DEUDA: **sin refresh token y sin logout con invalidación**. Un token robado es válido hasta que caduca (`JWT_EXPIRES_IN`, por defecto 1 día). Fuera del alcance de la Fase 4.5 por decisión ya tomada en [TEMPLATE.md](../../TEMPLATE.md).
