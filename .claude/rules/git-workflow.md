# Git — DTNotes

## Formato de commit

Conventional Commits **en español y SIN TILDES** en la descripción, con la referencia a la tarea de [PLAN.md](../../PLAN.md) entre paréntesis al final:

```
<tipo>(<scope>): <descripcion en minuscula, sin tildes> (Fase N.M[, cierra Fase N])
```

NORMA: la **descripción del commit va sin tildes** (ASCII puro: "categorias", "autenticacion", "codigo", "arbol", "tamano"). El resto de la documentación del proyecto sí las lleva. Es deliberado y consistente en los 22 commits del repo.

## Tipos y scopes

- **Tipos usados**: `feat` (lo habitual), `docs`, `chore`, `style`.
- **Scopes usados**: `web`, `api`, `auth`, `db`. Sin scope cuando el cambio es transversal (documentación, estructura).

Ejemplos reales del log, a imitar:

```
feat(web): resaltado de codigo multi-lenguaje (4.3, cierra Fase 4)
feat(api): CRUD de categorias con modos subtree/single (Fase 3.1)
feat(auth): guard JWT + endpoint protegido /api/auth/me (2.3.c)
feat(db): esquema completo + migracion inicial (Postgres/Prisma)
docs: anotar el proyecto como plantilla reutilizable (TEMPLATE.md)
style(web): boton Eliminar en rojo (btn--danger) e igualar tamano
chore: estructura inicial del monorepo DTNotes (Fase 0)
```

## Relación commit ↔ PLAN.md

NORMA: **1 commit = 1 subtarea del PLAN**.

- La referencia entre paréntesis usa el número exacto de la subtarea (`Fase 3.1`, `4.2.b`, `3.2.c-1`).
- Cuando esa subtarea **cierra la fase**, se añade `, cierra Fase N`.
- Al hacer el commit, se marca la subtarea `[x]` en `PLAN.md` y se añade su nota de validación.
- Los cambios transversales (documentación, memoria, plantilla) **no llevan referencia de fase**, como el commit `7cdf741`.

## Ramas y push

- **Solo existe `main`.** Todo va directo a `main`, sin ramas de feature ni pull requests.
- Remoto `origin`: `https://github.com/dvdramses89/dathasoft-notes.git`.
- Push tras cada hito (fin de subtarea o de fase).
- NORMA: **no hacer commit ni push sin que el usuario lo pida.** Tampoco crear ramas ni PRs por iniciativa propia.

## Lo que no hay

No existen y no se añaden sin pedirlo:

- Husky, lint-staged, commitlint — la convención se mantiene a mano.
- CI: **no hay `.github/workflows/`** (el `CLAUDE.md` antiguo lo mencionaba, pero nunca existió).
- Hooks de git más allá de los `.sample` por defecto.
