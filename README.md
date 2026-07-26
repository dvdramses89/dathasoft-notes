# DTNotes

Repositorio de documentación y notas del equipo **DathaSoft** (DT = DaThaSoft). Organiza documentos por **categorías** (carpetas jerárquicas estilo Craft) y **tags** (búsqueda enriquecida), con editor enriquecido, importación/exportación, favoritos, papelera, colectivos y compartición.

## Stack

- **Frontend (SPA):** React 18 + Vite + TypeScript · editor **BlockNote**
- **Backend (API REST):** NestJS (TypeScript) + Prisma
- **Base de datos:** PostgreSQL
- **Auth:** JWT
- **Despliegue:** Zeabur (todo en un proyecto)

## Estructura (monorepo)

```
apps/
  ├── api/        Backend NestJS (REST)
  └── web/        Frontend React + Vite
packages/
  └── shared/     Tipos TypeScript compartidos
```

## Documentación del proyecto

- [`CLAUDE.md`](CLAUDE.md) — decisiones, stack, modelo de datos y requisitos.
- [`PLAN.md`](PLAN.md) — plan de desarrollo por fases.

## Desarrollo local

Pendiente de las Fases 1+ del plan. Toda la configuración va en archivos `.env` (ver `.env.example` de cada app).
