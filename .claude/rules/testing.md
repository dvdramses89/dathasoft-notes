# Testing — DTNotes

## Estado actual

**No hay ni un test automatizado en el repositorio.** No es un descuido: es el estado deliberado del proyecto.

- No existen ficheros `*.spec.ts`, `*.test.ts`, `*.test.tsx` ni `*.e2e-spec.ts`.
- **No están instalados**: jest, ts-jest, `@nestjs/testing`, supertest, vitest, `@testing-library/*`, `@playwright/test`, jsdom ni happy-dom.
- No hay `jest.config`, `vitest.config`, `playwright.config` ni carpeta `test/`.
- **No hay script `test`** en ningún `package.json` (ni raíz, ni `apps/api`, ni `apps/web`).

> Detalle que despista: `apps/api/tsconfig.build.json` excluye `**/*spec.ts`. Es el default del scaffold de NestJS, **no** indica que existan specs.

## Cómo se verifica hoy

Manualmente, y funciona bien para el ritmo del proyecto:

1. **Typecheck** — `npm run build:api` y `npm run build:web`. Es la única red de seguridad automática que hay; el tsconfig del front va en `strict: true` y atrapa bastante.
2. **Backend** — `npm run db:up` + `npm run dev:api`, y se prueban los endpoints afectados a mano (incluido el aislamiento entre usuarios: que un usuario no vea ni toque recursos de otro).
3. **Frontend** — `npm run dev:web` y recorrido en navegador real, comprobando además que la consola queda limpia.

Cada `CLAUDE.md` de módulo tiene una sección **"Cómo verificar el módulo"** con las comprobaciones concretas de esa zona.

## Dónde se registra

En [PLAN.md](../../PLAN.md), en la línea de la subtarea, con el número de comprobaciones realizadas. El patrón real del proyecto:

```
Verificado con 47 comprobaciones (incluido aislamiento entre usuarios...)
Verificado con Playwright: 25/25 sin errores de consola
66 comprobaciones en navegador real
```

> Importante: **esos scripts de Playwright no están versionados.** Fueron ejecuciones puntuales durante el desarrollo. No los busques en el repo ni asumas que existen.

## Qué NO hacer

NORMA, y esta regla existe precisamente para evitarlo. **Sin que el usuario lo pida explícitamente, no:**

- instales un framework de test (jest, vitest, Playwright, Testing Library…);
- crees ficheros `.spec.ts` / `.test.tsx`;
- añadas un script `test` a ningún `package.json`;
- montes CI (`.github/workflows/`);
- añadas configuración de coverage.

Si al terminar una tarea crees que merecería un test, **dilo y sigue**. Proponerlo es útil; añadirlo por tu cuenta cambia el tooling del proyecto sin decisión del usuario.

## Si algún día se añaden

Lo coherente con el stack sería `@nestjs/testing` + supertest para la API, y Vitest + Testing Library para la web. Pero es una **decisión abierta del usuario**, no una recomendación a ejecutar.
