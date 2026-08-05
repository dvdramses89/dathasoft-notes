# Backend — NestJS + contrato de la API

Todo lo de `apps/api`: cómo se organiza el código y cómo se diseña la superficie HTTP. La autorización tiene su propia regla en `security.md`; el esquema de datos, en `database.md`.

---

# Parte A — Estructura y estilo

## Estructura de módulos

Un **feature-module por dominio**, directamente bajo `src/` (no hay carpeta `modules/`):

```
src/<dominio>/
├── <dominio>.module.ts
├── <dominio>.controller.ts
├── <dominio>.service.ts
└── dto/
    ├── create-<x>.dto.ts
    └── update-<x>.dto.ts
```

- Las carpetas transversales (`decorators/`, `guards/`, `strategies/`) viven **dentro de `auth/`**, no en un `common/` global.
- NORMA: **no crear `common/`, `config/`, `filters/`, `interceptors/`, `pipes/` ni barrel files (`index.ts`)** sin que el usuario lo pida. Hoy no existe ninguno y el proyecto funciona así a propósito.
- NORMA: por eso la validación del entorno es un **fichero suelto en `src/`**, `env.validation.ts`, al lado de `main.ts` y `app.module.ts`, y **no** una carpeta `config/`. Es el único sitio donde se usa `class-validator` fuera de un DTO: valida `process.env` con la misma herramienta que ya valida los bodies, sin añadir Joi.
- Carpetas de dominio en **plural** (`categories`, `documents`, `users`); las transversales en singular (`auth`, `prisma`, `health`).

Dos excepciones reales, ambas deliberadas:

- `health/` es un **controller sin módulo**: se declara directamente en `AppModule.controllers`.
- `users/` es un **módulo sin controller**: solo expone `UsersService` para que lo consuma `AuthModule`. No tiene superficie HTTP propia.

NORMA: **la única tarea programada de la API es la purga de la papelera**, y `ScheduleModule.forRoot()` se registra en `TrashModule`, no en `AppModule`. Si algún día hay una segunda, ese `forRoot()` sube a `AppModule`; mientras haya una sola, se queda con ella.

## TypeScript: strict parcial

`apps/api/tsconfig.json` **no tiene `"strict": true`**. Activa a mano cinco flags y deja tres desactivados:

| Activado | Desactivado |
|---|---|
| `strictNullChecks` | `strictPropertyInitialization` |
| `noImplicitAny` | `strictFunctionTypes` |
| `strictBindCallApply` | `noImplicitThis` |
| `noFallthroughCasesInSwitch` | |
| `forceConsistentCasingInFileNames` | |

- NORMA: **`strictPropertyInitialization` está desactivado, y por eso los DTO declaran `email: string;` sin `!`**. No añadas el operador de aserción: rompería la consistencia con los DTOs existentes.
- `module: commonjs`, `target: ES2021`, con `experimentalDecorators` y `emitDecoratorMetadata` (obligatorios para Nest).
- `baseUrl: "./"` pero **sin `paths`**: no hay alias de importación. Todos los imports son relativos (`../prisma/prisma.service`).
- Subir a `strict: true` es una decisión del usuario, no un arreglo de paso.

## Nombrado

- Ficheros: `kebab-case` con **sufijo de rol** — `.controller.ts`, `.service.ts`, `.module.ts`, `.dto.ts`, `.guard.ts`, `.strategy.ts`, `.decorator.ts`, `.enum.ts`.
- Clases: `PascalCase` con el mismo sufijo (`CategoriesService`, `JwtAuthGuard`, `CreateDocumentDto`).
- Métodos de controlador con nombre CRUD estándar: `create`, `list` / `tree`, `findOne`, `update`, `move`, `remove`, `reorder`.

## Servicios y controladores

- NORMA: inyección por constructor con **`private readonly` y nombre corto de dominio**:
  ```ts
  constructor(private readonly prisma: PrismaService) {}
  constructor(private readonly documents: DocumentsService) {}
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}
  ```
- NORMA: **los servicios siempre declaran el tipo de retorno explícito** (`Promise<Category>`, `Promise<{ deleted: number }>`). Los controladores casi nunca lo declaran y dejan la inferencia — la excepción es `auth.controller.ts`, que sí lo hace.
- NORMA: **los métodos que solo delegan omiten `async`** y devuelven la promesa directamente:
  ```ts
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user.id, dto);
  }
  ```
- `async/await` en toda la capa de servicio. **Cero `.then()`**, cero callbacks, cero observables.
- `Promise.all` cuando las consultas son independientes (ejemplo: el árbol y sus contadores se piden en paralelo en `categories.service.ts`).

## DTOs y validación

- Nomenclatura: `CreateXDto`, `UpdateXDto`, `MoveXDto`, `ReorderXDto`, en `kebab-case.dto.ts`.
- NORMA: **no se usa `PartialType` ni `@nestjs/mapped-types`**. Los `UpdateXDto` se escriben a mano con todos los campos marcados `@IsOptional()`. Se gana claridad sobre qué se puede editar y con qué reglas.
- NORMA: **mensajes de validación en español y personalizados**, con tildes (son texto de cara al usuario):
  ```ts
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MinLength(1, { message: 'El título no puede estar vacío' })
  ```
- NORMA: **los campos JSON llevan solo `@IsOptional()`**, sin ningún otro validador:
  ```ts
  @IsOptional()
  contentJson?: unknown;
  ```
  Es obligatorio así: con `whitelist: true`, un campo sin decoradores de validación sería eliminado del body.
- Validación de arrays de UUID: `@IsUUID(undefined, { each: true })`.
- Decoradores en uso: `@IsEmail`, `@IsString`, `@IsUUID`, `@IsInt`, `@IsEnum`, `@IsArray`, `@ArrayNotEmpty`, `@IsOptional`, `@MinLength`, `@MaxLength`, `@Min`.

## Comentarios y organización interna

- Comentarios **en español**, mayormente **sin tildes** en el código (`// Validacion automatica de DTOs`); los mensajes de error al usuario sí las llevan.
- Comentario `// GET /api/...` encima de cada método de controlador — hoy es la única documentación de la superficie HTTP, porque no hay Swagger.
- JSDoc `/** */` solo para **reglas de negocio no obvias** (los modos `SUBTREE`/`SINGLE`, la semántica tri-estado de `categoryId`).
- NORMA: **los helpers privados van al final de la clase**, bajo un separador:
  ```ts
  // ---------------- helpers ----------------
  ```

---

# Parte B — Contrato de la API

## Rutas y verbos

- **Prefijo global `/api`** (`app.setGlobalPrefix('api')` en [main.ts:10](../../apps/api/src/main.ts#L10)).
- **Sin versionado**: no hay `/v1`, ni `enableVersioning()`, ni versionado por header.
- Controladores con el nombre del recurso en **plural y minúscula**: `@Controller('categories')`.
- Las sub-acciones que no son un update simple van **como sufijo de ruta**: `PATCH /:id/move`, `PATCH /reorder`.

> **Gotcha obligatorio.** Las rutas estáticas se declaran **antes** que las paramétricas, o Nest captura `reorder` como si fuera un `:id`:
> ```ts
> @Patch('reorder')   // <- primero
> @Patch(':id')       // <- después
> ```
> Está comentado en el código de ambos controladores. Al añadir una sub-acción nueva, respeta el orden.

## Validación de entrada

`ValidationPipe` **global** en [main.ts:13-19](../../apps/api/src/main.ts#L13-L19):

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

- `forbidNonWhitelisted` significa que **un campo extra en el body devuelve 400**, no se ignora en silencio.
- Consecuencia práctica para el frontend: **no puede reenviar tal cual un objeto que recibió de un GET**; tiene que mandar solo los campos que el DTO declara.

## Pipes de parámetros

- `ParseUUIDPipe` en **todos** los `:id`.
- Enums de query con default, encadenando pipes:
  ```ts
  @Query('mode', new DefaultValuePipe(TreeMode.SUBTREE), new ParseEnumPipe(TreeMode)) mode: TreeMode
  ```
- Excepción documentada: `?categoryId` se parsea **a mano** en [documents.controller.ts:86-97](../../apps/api/src/documents/documents.controller.ts#L86-L97), con un `UUID_RE` a nivel de módulo, porque además de un UUID admite el literal `'root'`.

## Contrato de respuesta

- **Sin envoltorio.** Se devuelve el recurso plano, nunca `{ data: ... }`.
- Códigos por defecto de Nest: 200 en GET/PATCH/DELETE, 201 en POST.
- El único `@HttpCode` explícito está en `auth.controller.ts`: `HttpStatus.OK` en login, para forzar 200 en lugar del 201 que Nest pondría por ser un POST.
- Las operaciones masivas devuelven un contador: `{ deleted: n }`, `{ reordered: n }`.

## Contrato de error

**Crítico: no hay `ExceptionFilter` custom.** El formato es el estándar de NestJS:

```json
{ "statusCode": 400, "message": "...", "error": "Bad Request" }
```

donde `message` es un **`string`, o un `string[]`** cuando viene del `ValidationPipe`.

NORMA: **el frontend depende de este contrato exacto** ([api.ts:58](../../apps/web/src/lib/api.ts#L58)):

```ts
const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
```

Si algún día se añade un filtro global de excepciones, **hay que tocar `api.ts` en el mismo cambio** o el front dejará de mostrar los errores.

Excepciones HTTP en uso: `BadRequestException` (400), `UnauthorizedException` (401), `NotFoundException` (404), `ConflictException` (409).

## Serialización

**No hay `ClassSerializerInterceptor` ni `@Exclude`/`@Expose`.** Los campos sensibles se ocultan **a mano en la capa de servicio**, por dos vías:

1. **Mapper explícito** — `toPublicUser()` en `auth.service.ts` es la única forma en que un `User` sale de la API.
2. **Objetos `select` de Prisma tipados con `satisfies`** — en `documents.service.ts` hay dos proyecciones, y el tipo de respuesta se deriva de ellas:
   ```ts
   const listSelect = { id: true, title: true, categoryId: true, position: true,
                        createdAt: true, updatedAt: true } satisfies Prisma.DocumentSelect;
   export type DocumentListItem = Prisma.DocumentGetPayload<{ select: typeof listSelect }>;
   ```
   Ninguna de las dos incluye `ownerId` ni `deletedAt`.

DEUDA: **`categories.service.ts` no usa `select`** y devuelve la entidad Prisma completa —con `ownerId` y `deletedAt`— en `create`, `update` y `move`. Solo `tree()` proyecta a un DTO de salida. No lo imites en módulos nuevos: usa el patrón de `documents.service.ts`.

Los tipos de respuesta se exportan **desde el propio service**, no desde ficheros de tipos aparte. Dos estilos, ambos vigentes: interfaces a mano (`PublicUser`, `LoginResult`, `CategoryNode`) y alias derivados de Prisma (`DocumentFull`, `DocumentListItem`).

## Lo que no hay

Ausencias deliberadas. No las "arregles" sin pedirlo:

- **Paginación** — ningún endpoint la tiene; `GET /api/documents` devuelve todo sin `take`/`skip`.
- **Versionado** de la API.
- **Envoltorio** de respuesta.
- **Exception filter** global (ver arriba: el front depende del formato actual).
- **Interceptores** de cualquier tipo.
- **Swagger / OpenAPI** — `@nestjs/swagger` no está instalado. La superficie HTTP se documenta con los comentarios `// GET /api/...` y, de facto, con el cliente tipado `apps/web/src/lib/api.ts`.
