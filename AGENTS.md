<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
