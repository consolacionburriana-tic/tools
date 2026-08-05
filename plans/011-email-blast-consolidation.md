# Plan 011: Un solo motor de correo masivo — portar el recordatorio de Salidas a los primitivos de Licencias

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/lib/licencias-email.ts src/lib/salidas-email.ts src/app/api/reports/route.ts`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P3 — **ejecutar SOLO entre campañas/salidas activas** (toca correo real a familias)
- **Effort**: M
- **Risk**: MED (correo enviado no se puede revertir; obligatorio envío de prueba)
- **Depends on**: plans/010-salidas-magic-link.md si está en curso (mismos ficheros; coordinar orden — mejor 010 primero)
- **Category**: tech-debt
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

La convención del repo es una (`docs/04-convenciones-tecnicas.md`: "Envíos masivos:
batch de 100 (patrón de /gestion/correos), con variables …, vista previa y envío de
prueba"). Hoy hay tres implementaciones divergentes:

1. `src/lib/licencias-email.ts` — la canónica: `sendChunks` con `resend.batch.send` en
   lotes de 100, `applyVars` (`{clave}` insensible a mayúsculas, deja `{typo}` visible),
   cuerpo **escapado** (`escapar`) + URLs enlazadas (`enlazarUrls`) + botón CTA.
2. `src/lib/salidas-email.ts` — `sendRecordatorioPago`: bucle de UN
   `resend.emails.send` POR FAMILIA (un envío a todo un colegio = cientos de rondas),
   sustituidor propio `rellenar` (regex por variable), y el cuerpo del operador entra
   **sin escapar** en el HTML.
3. `src/app/api/reports/route.ts:161` — un `resend.emails.send` suelto dentro del route
   (aviso de nuevo registro ABC), fuera del patrón `src/lib/<mod>-email.ts`.

Divergen en throughput, seguridad (escapado) y semántica de variables; cada mejora hay
que hacerla tres veces. La mitad barata y de alto valor es: extraer los primitivos de
licencias a un módulo compartido y portar Salidas. (La tabla de plantillas compartida y
un panel común quedan explícitamente FUERA — ver Out of scope.)

## Current state

- `src/lib/licencias-email.ts:81-143` — `applyVars`, `escapar`, `enlazarUrls`,
  `boton`, `wrapHtml`, y:

```ts
async function sendChunks(items: BlastItem[], subject: string, body: string):
  Promise<{ sent: number; errors: number; skipped: boolean }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, errors: 0, skipped: true };
  const resend = getResend();
  ...
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const payload = chunk.map((r) => ({ from: FROM, to: r.email,
      subject: applyVars(subject, r.vars), html: wrapHtml(applyVars(body, r.vars), r.cta) }));
    try { await resend.batch.send(payload); sent += chunk.length; }
    catch (e) { console.error('sendBlast chunk error:', e); errors += chunk.length; }
  }
  ...
}
```

  `BlastItem = { email: string; vars: Record<string,string>; cta?: { url, label } }`.

- `src/lib/salidas-email.ts:122-155` — `sendRecordatorioPago({ trip, subject, body, familias })`
  con `rellenar` propio para `{alumno} {salida} {fecha} {importe}` y bucle 1-a-1. Cada
  familia es `{ nombre: string; emails: string[] }` (OJO: **varios emails por familia**,
  el batch item de licencias es un solo `to` — ver Step 2).
- Cliente Resend único: `src/lib/email.ts` (`getResend`, `FROM`) — regla del repo: no
  instanciar Resend fuera.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `pnpm test` | pasa (si existe el runner) |
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |

## Scope

**In scope**:
- `src/lib/correos.ts` (crear — primitivos compartidos)
- `src/lib/licencias-email.ts` (re-exportar/importar desde correos.ts, sin cambio de comportamiento)
- `src/lib/salidas-email.ts` (portar `sendRecordatorioPago` a los primitivos)

**Out of scope** (deliberado, aunque parezca relacionado):
- Tabla de plantillas compartida (`lic_email_templates` → genérica): exige decisión de David y migración de schema (regla aditiva). Apuntado en plans/README como pendiente de decisión.
- Un componente compartido `<CorreoMasivo>` para los paneles.
- `src/app/api/reports/route.ts:161` — el aviso ABC es un correo transaccional 1-a-N pequeño, no un blast; se deja, solo se anota.
- Cambiar textos o plantillas existentes de ningún correo.

## Git workflow

- Branch: `refactor/correos-compartidos`; mensaje `refactor(correos): primitivos de envío masivo compartidos; salidas usa batch y escapado`.

## Steps

### Step 1: Extraer primitivos a `src/lib/correos.ts`

Mueve desde `licencias-email.ts` a `src/lib/correos.ts`: `applyVars`, `escapar`,
`enlazarUrls`, `boton`, `wrapHtml`, `sendChunks` y el tipo `BlastItem`, exportándolos.
En `licencias-email.ts`, importa esos símbolos de `@/lib/correos` (borra las copias
locales). CERO cambios de lógica.

**Verify**: `pnpm build` exit 0; `pnpm test` verde si existe; `git diff src/lib/licencias-email.ts` solo muestra imports/borrados, ninguna línea de lógica nueva.

### Step 2: Portar `sendRecordatorioPago`

Reescríbela sobre los primitivos manteniendo su firma y contrato exactos
(`{ enviados, errores }`):

1. Cada familia se convierte en `BlastItem`s: **un item por email** de
   `f.emails` (el `to` de batch de licencias es individual; mantener el
   comportamiento de "todos los tutores reciben el correo").
2. `vars` = `{ alumno: f.nombre, salida: trip.nombre, fecha: fechaBonita(trip.fecha), importe: trip.importe ? `${trip.importe} €` : '' }`
   (+ `enlace` si el plan 010 ya lo añadió — consérvalo).
3. Usa `sendChunks(items, subject, body)`. El cuerpo pasa a estar escapado y con URLs
   clicables — mejora deliberada. Mapea el retorno `{ sent, errors }` a
   `{ enviados, errores }`.
4. Nota de compatibilidad: `applyVars` sustituye `{clave}` con `\w+` insensible a
   mayúsculas — cubre `{alumno}`, `{ALUMNO}`, etc., igual que el `rellenar` viejo (que
   era `gi`). Verifica que ninguna plantilla usada dependía de espacios tipo `{ alumno }`
   (el viejo tampoco los soportaba).

**Verify**: `pnpm build` exit 0; `grep -n "resend.emails.send" src/lib/salidas-email.ts` → el recordatorio ya no lo usa (otros correos del fichero — confirmación, aviso a responsables — pueden seguir; son transaccionales).

### Step 3: Envío de prueba real (obligatorio)

Con dev: desde `/gestion/salidas/<salida de prueba>` → panel de recordatorio → envío de
PRUEBA a tu correo. Comprueba: variables sustituidas, estética similar a la anterior
(el wrapper cambia al de licencias — aceptado), sin HTML roto, y que un cuerpo con
`<b>hola</b>` llega como texto visible escapado (no como negrita).

**Verify**: correo recibido con las 4 comprobaciones.

## Test plan

Si el runner del plan 004 existe: tests puros en `src/lib/__tests__/correos.test.ts`
para `applyVars` (sustitución, insensibilidad, `{typo}` intacto), `escapar` y
`enlazarUrls` (URL → `<a>`), ~8 casos. Si no existe runner, la verificación es Step 3.

## Done criteria

- [ ] `src/lib/correos.ts` existe; licencias-email importa de él; cero duplicados (`grep -rn "function applyVars" src/lib` → 1 hit)
- [ ] `sendRecordatorioPago` usa `sendChunks` (batch de 100) y cuerpo escapado
- [ ] Envío de prueba verificado (Step 3)
- [ ] `pnpm lint && pnpm build` exit 0 (+ tests si aplica)
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si hay una salida REAL con recordatorios pendientes de enviar esta semana → STOP: este plan espera a que no haya envíos en vuelo.
- Si `sendRecordatorioPago` tiene más callers que el route del recordatorio (`grep -rn "sendRecordatorioPago" src/`) con contratos distintos → STOP y reporta.
- Si el envío de prueba llega visualmente roto → revertir el port (dejar Step 1 mergeable solo).

## Maintenance notes

- Evaluaciones (hito 6) y los "correos masivos a pendientes" que pida cualquier módulo deben nacer sobre `src/lib/correos.ts`.
- Pendiente de decisión de David (en plans/README): tabla de plantillas module-agnostic y panel compartido.
- Revisor: el diff de licencias-email debe ser pura re-exportación; el de salidas-email, una función reescrita con el mismo contrato.
