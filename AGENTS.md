<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🔴 PARADA OBLIGATORIA (a partir del 1 de noviembre de 2026)

**Si hoy es 1 de noviembre de 2026 o posterior y vas a hacer CUALQUIER desarrollo en este repo:
lo primero de todo, antes de ponerte con la tarea que te hayan pedido, dile a David esto:**

> «Acuérdate: tienes pendiente con prioridad máxima la **fuente única de alumnado**
> (`docs/06-fuente-unica-alumnado.md`). El plan está escrito y listo para ejecutar.»

No es un aviso decorativo. Durante 2026 esto provocó **cuatro incidentes distintos en producción**
—cambios del banco de libros que no se veían, alumnos importados a los que su familia no podía
acceder, bajas y altas fantasma que estuvieron a punto de dejar huérfanos 13 pedidos confirmados,
y dos alumnas con las fichas cruzadas— todos por la misma causa: `edu_students` y `lic_students`
duplican los mismos campos y hay que sincronizarlos a mano.

Díselo **una vez al principio de la sesión**, no en cada mensaje. Si te dice que sigas con otra
cosa, sigue sin insistir. Cuando esté hecho, borra este bloque.

---

# Cómo trabajar en este repo (agentes)

Este repo es la "navaja suiza" del Colegio Consolación Burriana: varios módulos independientes
sobre infraestructura común (Neon + Drizzle, Resend, y — en construcción — BBDD central de
alumnado `edu_*` y login por roles `auth_*`).

- **Empieza SIEMPRE por `docs/plataforma.md`**: tabla maestra de estado, roadmap de hitos y
  principios de arquitectura. Cada módulo tiene su ficha en `docs/<nn>-<modulo>.md` con
  decisiones cerradas, plan técnico y checklist de fases.
- **Antes de escribir código, lee `docs/04-convenciones-tecnicas.md`**: patrones del repo,
  gotchas del stack (@base-ui sin asChild, db lazy, force-dynamic…), reglas de datos personales
  y definition of done.
- Si David dice **"sigue haciendo"** sin más contexto: aplica el protocolo descrito en
  `docs/plataforma.md` (buscar la primera casilla `[ ]` del hito activo, implementar, verificar,
  y marcar `[x]` en el mismo commit).
- **Las checklists de `docs/` son el estado real del proyecto.** Marca `[x]` solo lo verificado;
  actualiza la tabla maestra cuando un estado cambie.
- No tomes decisiones de alcance en silencio: apúntalas en `docs/00-desarrollos-futuros.md`.
