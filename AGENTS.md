<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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
- **Antes de pintar una pantalla, lee `docs/diseno.md`**: de dónde sale cada pieza
  (`src/components/ui/`), las reglas (azul para actuar, 44 px, cabecera común…) y lo que no se
  hace. `pnpm diseno:guardia` tiene que quedar en verde.
- Si David dice **"sigue haciendo"** sin más contexto: aplica el protocolo descrito en
  `docs/plataforma.md` (buscar la primera casilla `[ ]` del hito activo, implementar, verificar,
  y marcar `[x]` en el mismo commit).
- **Las checklists de `docs/` son el estado real del proyecto.** Marca `[x]` solo lo verificado;
  actualiza la tabla maestra cuando un estado cambie.
- **Si `src/db/sql/pendientes.txt` no está vacío, hay schema sin aplicar en Neon.** Con
  `DATABASE_URL` en el entorno (o en `.env.local`), aplícalo tú:
  `pnpm db:sql --pendientes` (`--dry` para ver antes qué haría). Son ficheros idempotentes.
  Al aplicarlos, quítalos de `pendientes.txt` y marca las casillas `[~]` → `[x]` de la
  ficha del módulo en el mismo commit. Si no tienes `DATABASE_URL`, dilo al terminar en vez
  de dar el trabajo por acabado.
- No tomes decisiones de alcance en silencio: apúntalas en `docs/00-desarrollos-futuros.md`.
