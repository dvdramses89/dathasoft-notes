# Módulo `prisma`

La única puerta de acceso a la base de datos.

## Estructura del módulo

```
prisma/
├── prisma.module.ts    ← @Global
└── prisma.service.ts   ← extends PrismaClient
```

## Reglas del módulo

- **`PrismaModule` es `@Global`.** NORMA: **no lo importes en los `imports` de cada feature-module** — basta con inyectar `PrismaService` en el constructor del servicio. Ya está registrado una sola vez en `AppModule`.
- `PrismaService extends PrismaClient` e implementa `OnModuleInit` / `OnModuleDestroy`: se conecta al arrancar y se desconecta al apagar. El cierre ordenado funciona porque `main.ts` llama a `app.enableShutdownHooks()`.
- NORMA: **nunca instancies `new PrismaClient()`** en ningún otro sitio. Se abriría un pool de conexiones paralelo que nadie cierra.
- Este servicio no contiene lógica de negocio ni helpers de consulta: es solo el cliente. Las reglas de acceso (filtrar por `ownerId`, `deletedAt: null`, usar `$transaction`) viven en cada servicio de dominio.

## Modelo / Entidades

Ninguna propia. El esquema completo está en `apps/api/prisma/schema.prisma`, y sus convenciones y trampas —sobre todo la columna generada `searchVector`— en `.claude/rules/database.md`.

## Cómo verificar el módulo

- `GET /api/health/db` devuelve `{ db: 'ok' }` con la base levantada (`npm run db:up`).
- Con Postgres parado, el mismo endpoint devuelve `{ db: 'error', message }` en vez de tumbar la API.
- Al arrancar `npm run dev:api`, el log muestra `Conectado a PostgreSQL`.
