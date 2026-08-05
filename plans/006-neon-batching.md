# Plan 006: Batching de escrituras Neon — sync de licencias en un `db.batch`, bulk de bancolibros en un insert, y `Promise.all` en lecturas independientes

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/lib/licencias-server.ts src/lib/bancolibros-server.ts src/app/api/bancolibros/admin/registro/route.ts`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (cambia semántica de fallo de los syncs a todo-o-nada — que es lo deseado)
- **Depends on**: plans/004-test-baseline-vitest.md recomendado (gate `pnpm test`), no bloqueante
- **Category**: perf
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

El driver es `@neondatabase/serverless` por HTTP (`src/db/index.ts`, drizzle
`neon-http`): **cada statement `await`eado es una ronda HTTPS completa**. Tres sitios
pagan esto de más:

1. `syncStudentsFromSheet` (`src/lib/licencias-server.ts:1045`) hace un upsert POR
   ALUMNO en un `for` secuencial — con 642 alumnos son ~642 rondas ≈ 25-50 s de wall
   clock en una sola invocación serverless (zona de timeout de Vercel), y sin
   transacción: un timeout a mitad deja el sync medio aplicado.
   `syncBooksFromSheet` (`:869`) tiene la misma forma.
2. El bulk "todos MB" de bancolibros (`src/app/api/bancolibros/admin/registro/route.ts:25`)
   hace hasta 60 upserts secuenciales — 2-5 s de spinner en iPad durante la recogida de
   libros, y no atómico.
3. Varias lecturas de panel awaitean en serie queries independientes
   (`getDashboardStats`, `getMissingStudents`, `getRecipients`, `getFamiliaRecipients`
   en `licencias-server.ts`) — latencia x3 gratuita en páginas force-dynamic.

**El patrón correcto ya existe en el repo**: el sync de Educamos acumula
`BatchItem<'pg'>[]` y lanza UN `db.batch(...)` (`src/lib/educamos-server.ts:153` y
`:355`: `await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);`).

## Current state

- `src/lib/licencias-server.ts:1050-1090` — extracto del loop de alumnos:

```ts
for (const r of rows) {
  await db
    .insert(licStudents)
    .values({ campaignId, studentCode: r.studentCode, ... })
    .onConflictDoUpdate({
      target: [licStudents.campaignId, licStudents.studentCode],
      set: { ...(r.educamosId ? { educamosId: r.educamosId } : {}), eduStudentId: r.eduStudentId, ... },
    });
}
```

  Tras el loop hay una cola de "desactivar los que ya no están" (`currentCodes`) —
  también debe entrar en el mismo batch.

- `src/lib/licencias-server.ts:869-906` — `syncBooksFromSheet`, misma forma
  (`onConflictDoUpdate` target `[campaignId, curso, cod]`, luego desactivación).

- `src/app/api/bancolibros/admin/registro/route.ts:25-27`:

```ts
for (const asignacionId of asignacionIds) {
  await upsertRegistro({ asignacionId, bookCod, campos, revisorEmail: user?.email ?? '' });
}
```

  `upsertRegistro` (`src/lib/bancolibros-server.ts:242`) es un solo
  `insert().onConflictDoUpdate()` sobre `blLibroRegistros` con unique
  `(asignacionId, bookCod)` (`src/db/schema.ts:454`).

- `src/lib/licencias-server.ts:131-146` — `getDashboardStats`: tres awaits en serie
  (students, orders, count de items) sin dependencia entre sí. Lo mismo en
  `getMissingStudents` (~:237), `getRecipients` (~:275), `getFamiliaRecipients` (~:368).
  El propio fichero ya usa `Promise.all` en `listOrders` (~:562) — imitar ese estilo.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `pnpm test` | all pass (si existe el runner del plan 004) |
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 (si existe el script) |

## Scope

**In scope**:
- `src/lib/licencias-server.ts` (solo `syncStudentsFromSheet`, `syncBooksFromSheet`, `getDashboardStats`, `getMissingStudents`, `getRecipients`, `getFamiliaRecipients`)
- `src/lib/bancolibros-server.ts` (dar forma array a `upsertRegistro` o añadir `upsertRegistros`)
- `src/app/api/bancolibros/admin/registro/route.ts` (usar la forma bulk)

**Out of scope**:
- `src/lib/educamos-server.ts` — es el ejemplar, no lo toques.
- Cambiar el driver o `src/db/index.ts`.
- Cualquier cambio de comportamiento visible (mismo resultado, menos rondas).

## Git workflow

- Branch: `perf/neon-batching`; mensaje `perf: sync de licencias y bulk de bancolibros en db.batch, lecturas en Promise.all`.

## Steps

### Step 1: `syncStudentsFromSheet` a `db.batch`

Copia el patrón de `educamos-server.ts:153`: importa `BatchItem` de `drizzle-orm/batch`
(mira el import exacto en `educamos-server.ts`), acumula en el loop
`statements.push(db.insert(licStudents).values({...}).onConflictDoUpdate({...}))` (sin
`await`), añade al final el update de desactivación existente como último statement, y
ejecuta `await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);` solo si
`statements.length > 0`. Mantén los contadores de retorno (`upserted`, `deactivated`,
`outOfScope`) calculándolos como hasta ahora.

**Verify**: `pnpm build` exit 0; `grep -n "db.batch" src/lib/licencias-server.ts` → 1 hit en esta función.

### Step 2: `syncBooksFromSheet` igual

Misma transformación.

**Verify**: `pnpm build` exit 0; `grep -c "db.batch" src/lib/licencias-server.ts` → 2.

### Step 3: Bulk de bancolibros en un solo insert

En `src/lib/bancolibros-server.ts`, añade una variante que reciba
`asignacionIds: string[]` y haga UN `db.insert(blLibroRegistros).values(ids.map(...))`
con el MISMO `onConflictDoUpdate` (target `[asignacionId, bookCod]`) y `set` que la
actual. Cambia el route handler para llamarla una vez en lugar del `for`. Conserva
`upsertRegistro` singular si tiene otros callers (compruébalo con
`grep -rn "upsertRegistro" src/`).

**Verify**: `pnpm build` exit 0; el route handler ya no contiene `for (const asignacionId`.

### Step 4: `Promise.all` en las 4 lecturas

En cada una de `getDashboardStats`, `getMissingStudents`, `getRecipients`,
`getFamiliaRecipients`: agrupa los awaits independientes en
`const [a, b, c] = await Promise.all([...])`, siguiendo el estilo de `listOrders` en el
mismo fichero. NO agrupes queries donde una consume el resultado de otra.

**Verify**: `pnpm lint && pnpm build` exit 0; `pnpm test` verde si existe.

### Step 5: Prueba manual de los syncs (obligatoria)

Con `pnpm dev` y credenciales de dev de Google Sheets:

1. `/gestion/licencias/sincronizar` → vista previa de alumnos y libros → aplicar.
   El resultado (nº upserted/deactivated) debe coincidir con lo que decía la vista previa,
   y el tiempo de aplicación debe bajar de decenas de segundos a pocos segundos.
2. `/gestion/bancolibros` → valorar en bulk una clase de prueba ("todos MB") → los
   registros aparecen; repetir la acción es idempotente.

**Verify**: ambos flujos con el resultado descrito. Si no hay acceso al Sheet en dev, STOP antes de merge (ver STOP conditions).

## Test plan

- Si el plan 004 está hecho: `pnpm test` verde antes y después (los tests puros no tocan esto, sirven de canario de imports).
- La verificación funcional es el Step 5 (los syncs no tienen tests unitarios; su lógica de plan/diff sí quedará cubierta si se ejecutó el 005 para educamos — licencias sync queda como prueba manual documentada).

## Done criteria

- [ ] `grep -c "db.batch" src/lib/licencias-server.ts` → 2
- [ ] Cero `await db.insert` dentro de loops `for` en los dos syncs y en el route de bancolibros
- [ ] `pnpm lint && pnpm build` exit 0 (+ `pnpm test` si existe)
- [ ] Prueba manual del Step 5 pasada y anotada en el commit
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si `db.batch` no existe en el tipo del cliente (driver distinto de neon-http en `src/db/index.ts`) → STOP: el supuesto base es falso.
- Si el batch de 642 statements falla por límite de tamaño de petición → trocea en chunks de ~100 statements por batch y anótalo; si aun así falla, STOP.
- Si no puedes ejecutar la prueba manual del Step 5 (sin credenciales del Sheet) → deja el cambio en branch sin mergear y repórtalo: este cambio NO se despliega sin esa prueba, hay datos reales de campaña.

## Maintenance notes

- La semántica pasa a todo-o-nada: un fallo del batch ya no deja syncs a medias (mejora), pero también significa que un solo dato corrupto bloquea todo el sync — el mensaje de error debe seguir llegando al panel.
- Si algún día el alumnado crece un orden de magnitud, revisar también el índice ausente en `lic_order_items.order_id` (hoy no compensa: tablas pequeñas, decisión registrada en plans/README).
