# Plan 001: Proteger `/api/reports/[id]` con auth (hoy es público: lee y borra informes ABC sin sesión)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If anything
> in the "STOP conditions" section occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/app/api/reports/`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

`src/app/api/reports/[id]/route.ts` no tiene NINGÚN guard de autenticación. El GET
devuelve un informe de conducta del Registro ABC completo, con el alumno (menor con NEE,
nombre completo) y el profesor unidos por join — a cualquier petición anónima que conozca
el UUID. El DELETE borra el informe, también sin sesión. Todos los demás endpoints del
módulo ABC están protegidos (`/api/reports` lista con `hasModule('abc')`, `/api/students`
y `/api/teachers` igual); este quedó fuera. Es el dato más sensible de la plataforma
(conductas de menores) expuesto en la única ruta sin candado.

## Current state

- `src/app/api/reports/[id]/route.ts` — GET y DELETE sin guard. Extracto (líneas 1-10):

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { behaviorReports, students, teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [report] = await db
```

  El DELETE (más abajo en el mismo fichero) hace `db.delete(behaviorReports)` directamente.

- Convención del repo (el patrón a imitar) — `src/app/api/students/route.ts:8`:

```ts
if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
```

  `hasModule` viene de `src/lib/auth-guards.ts` (guard central; `hasModule('abc')`
  comprueba sesión + permiso del módulo vía `canAccess`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope** (only file to modify):
- `src/app/api/reports/[id]/route.ts`

**Out of scope**:
- `src/app/api/reports/route.ts` — ya está protegido (GET con `hasModule('abc')`, POST con `requireSession`). No tocar.
- `src/lib/auth-guards.ts` — no cambiar los guards, solo consumirlos.
- Cualquier componente que consume esta API (`src/app/gestion/abc/registros/[id]/page.tsx`): las páginas de gestión ya van tras login, así que el fetch seguirá funcionando con la cookie de sesión.

## Git workflow

- Branch: trabajar en `main` directamente o `fix/guard-api-reports` (el repo usa ambos estilos; commits tipo `fix(abc): …`).
- Mensaje sugerido: `fix(abc): guard de auth en /api/reports/[id] (GET y DELETE)`

## Steps

### Step 1: Añadir el guard a GET y DELETE

En `src/app/api/reports/[id]/route.ts`:

1. Añade el import: `import { hasModule } from '@/lib/auth-guards';`
2. Como primera línea del cuerpo de `GET` (antes del `try`), añade:
   `if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });`
3. Exactamente igual como primera línea de `DELETE`.

**Verify**: `pnpm lint && pnpm build` → ambos exit 0.

### Step 2: Comprobar manualmente el candado

Con el dev server (`pnpm dev`):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/reports/00000000-0000-0000-0000-000000000000
```

**Verify**: imprime `401` (antes devolvía `404`/`200`). Repetir con `-X DELETE` → `401`.

## Test plan

No hay runner de tests en el repo todavía (lo introduce el plan 004). La verificación
es el curl del Step 2. Si el plan 004 ya está ejecutado cuando llegues aquí, añade en
su suite un test de humo no es necesario (route handlers no se testean en ese baseline).

## Done criteria

- [ ] `grep -n "hasModule" "src/app/api/reports/[id]/route.ts"` muestra el import y 2 usos (GET y DELETE)
- [ ] `pnpm lint` y `pnpm build` exit 0
- [ ] curl anónimo a GET y DELETE devuelve 401
- [ ] `git status` no muestra ficheros modificados fuera del in-scope
- [ ] Fila de este plan actualizada en `plans/README.md`

## STOP conditions

- Si el fichero ya contiene un guard (`hasModule`/`requireModule`) — el problema ya se arregló; marca el plan DONE-obsoleto y reporta.
- Si el panel `/gestion/abc/registros/[id]` deja de cargar el informe tras el cambio (sesión iniciada): STOP y reporta — indicaría que ese fetch no manda cookies (no debería pasar: es same-origin).

## Maintenance notes

- Cualquier ruta nueva bajo `/api/reports/**` (o cualquier `/api/<mod>/admin/**`) debe nacer con guard; el proxy (`src/proxy.ts`) NO cubre `/api/*`, solo `/gestion`, `/admin` y `/registro-abc`.
- Revisor: comprobar que no se añadió lógica extra — el diff debe ser ~4 líneas.
