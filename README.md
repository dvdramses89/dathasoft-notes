# DTNotes

Repositorio de documentación y notas del equipo **DathaSoft** (DT = DaThaSoft). Organiza documentos por **categorías** (carpetas jerárquicas estilo Craft) y **tags** (búsqueda enriquecida), con editor enriquecido, importación/exportación, favoritos, papelera, colectivos y compartición.

## Stack

- **Frontend (SPA):** React 18 + Vite + TypeScript · editor **BlockNote** · CSS propio
- **Backend (API REST):** NestJS + Prisma
- **Base de datos:** PostgreSQL 16 (Docker en local)
- **Auth:** JWT
- **Despliegue:** Zeabur (previsto, aún sin configurar)

## Estructura (monorepo)

```
apps/
  ├── api/        Backend NestJS (REST)
  └── web/        Frontend React + Vite
packages/
  └── shared/     Tipos compartidos (aún vacío)
```

## Desarrollo local

Requisitos: Node >= 18 y Docker.

```bash
# 1. Dependencias (desde la raíz, instala todos los workspaces)
npm install

# 2. Variables de entorno: copiar cada .env.example a .env
#    en la raíz, en apps/api y en apps/web
#    Generar un JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Base de datos
npm run db:up
npm run prisma:migrate --workspace apps/api

# 4. Arrancar (en dos terminales)
npm run dev:api    # http://localhost:3000/api
npm run dev:web    # http://localhost:5173
```

Comprobación rápida: `http://localhost:3000/api/health/db` debe responder `{"db":"ok"}`.

Para parar la base de datos: `npm run db:down`.

## Documentación del proyecto

- [`CLAUDE.md`](CLAUDE.md) — contexto del proyecto: stack, arquitectura, comandos y entorno.
- [`.claude/rules/`](.claude/rules/) — normas de código por tema (seguridad, backend, base de datos, frontend, testing, git, método de trabajo).
- [`PLAN.md`](PLAN.md) — plan de desarrollo por fases y estado de avance.
- [`TEMPLATE.md`](TEMPLATE.md) — el proyecto como plantilla reutilizable NestJS + Prisma + React + JWT.

Cada módulo relevante tiene además su propio `CLAUDE.md` con las particularidades de esa zona del código.
