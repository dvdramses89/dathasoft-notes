# Método de trabajo — DTNotes

Cómo se trabaja en este proyecto y cómo se mantiene esta memoria.

## Método de entrega

- **Tareas pequeñas, concretas y validables en local**, entregadas **una a una** y **al ritmo del usuario**. No adelantar la siguiente tarea sin que la pida.
- **No adelantar fases.** El orden lo marca [PLAN.md](../../PLAN.md). Si algo pertenece a una fase futura, se menciona y se deja anotado; no se implementa.
- Cada tarea termina en un estado **probable en local**, y cada hito en **commit + push**.
- Se desarrolla y prueba **en local**. El despliegue va al final del todo (Fase 11).

## Nada inventado

- Si falta un dato — contenido, credenciales, una decisión de producto, un nombre —, **se pregunta**. No se asume ni se rellena con un valor plausible.
- Esto aplica también al código: si no está claro qué debe hacer un caso límite, se pregunta antes de elegir por el usuario.
- No inventar convenciones. Si una regla no está escrita aquí ni se deduce del código existente, preguntar en vez de imponer un criterio nuevo.

## Cómo marcar una regla

Las reglas de este directorio usan **dos marcas**:

- **NORMA** — Convención vigente. Si escribes código nuevo, replícala.
- **DEUDA** — Está así a propósito. **No la imites** en código nuevo, pero **tampoco la refactorices sin que el usuario lo pida**. Cada DEUDA explica por qué está así.

Reglas de uso:

1. Una marca **por bullet**, no por sección. En un mismo párrafo puede haber una NORMA y una DEUDA (ejemplo real: `documents.service.ts` usa `select`, `categories.service.ts` no).
2. Lo que **no lleva marca es descriptivo**, no prescriptivo: es contexto para entender el código, no una obligación.
3. Cuando una DEUDA se resuelve, **la línea se borra**. No se marca como "resuelta": la memoria describe el presente, no el historial.
4. **Lo que todavía no existe no se marca aquí.** Vive en [PLAN.md](../../PLAN.md), que es el único sitio que lleva el estado de avance.

## Fuente de verdad de cada documento

| Documento | Es fuente de verdad de | NO debe contener |
|---|---|---|
| `CLAUDE.md` (raíz) | Stack real, arquitectura, estructura, comandos, entorno, índice de reglas | Estado de avance; detalle de convenciones; detalle de un módulo |
| `.claude/rules/*.md` | Normas de codificación transversales, por tema | Estado de avance; detalle de un módulo concreto |
| `apps/**/CLAUDE.md` | Lo específico de ese módulo | Cualquier regla que ya esté en `.claude/rules/` |
| [PLAN.md](../../PLAN.md) | **Estado de avance**: fases, `[ ]/[~]/[x]`, notas de validación, pendientes anotados | Convenciones de código |
| [README.md](../../README.md) | Puerta de entrada humana: qué es DTNotes, cómo levantarlo en local | Decisiones internas; reglas de código |
| [TEMPLATE.md](../../TEMPLATE.md) | Qué parte del repo es genérica y reutilizable vs específica de DTNotes | Estado de avance; reglas de código |
| `apps/api/prisma/schema.prisma` | Campos, tipos y relaciones de la base de datos | — |

**Regla operativa: si un dato aparece en dos ficheros, uno de los dos está mal.** El que no es dueño enlaza al que sí lo es.

## Cómo se carga esta memoria

Tres niveles, con mecanismos distintos:

| Nivel | Fichero | Cuándo entra en contexto |
|---|---|---|
| Proyecto | `CLAUDE.md` de la raíz | Siempre, al abrir sesión |
| Reglas | `.claude/rules/*.md` | Siempre, vía `@import` desde el `CLAUDE.md` raíz |
| Módulo | `apps/**/CLAUDE.md` | **Solo al leer o editar un fichero de ese directorio** |

Por eso el reparto: lo transversal va en las reglas, lo local va en el módulo. Un `CLAUDE.md` de módulo **nunca repite** una regla global.

## Mantenimiento de la memoria

Cuando algo cambia, se actualiza **un solo sitio**:

- Cierro una subtarea → la marco `[x]` en `PLAN.md` con su nota de validación.
- Cambia una decisión de stack o arquitectura → `CLAUDE.md` de la raíz.
- Se establece una convención transversal nueva → la regla de `.claude/rules/` que corresponda.
- Cambia algo interno de un módulo → el `CLAUDE.md` de ese módulo.
- Toco algo que `TEMPLATE.md` clasifica como genérico → reviso `TEMPLATE.md`.

NORMA: si al escribir código descubres una convención que no está documentada, dilo. Es mejor añadirla a la regla que dejarla solo en el código.
