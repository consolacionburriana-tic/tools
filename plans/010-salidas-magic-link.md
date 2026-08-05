# Plan 010: Estrenar el magic link de familias en Salidas (leer `?t=` y enviarlo en el recordatorio de pago)

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- "src/app/(public)/salidas" src/components/salidas/ src/app/api/salidas/ src/lib/fam-tokens-server.ts src/lib/familias.ts`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (los tokens son credenciales; ver reglas)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

Los magic links de familias existen y funcionan en Licencias (`/licencias?t=tok_…`), y
la infraestructura es transversal a propósito: `PROPOSITOS = { licencias: '/licencias',
salidas: '/salidas' }` en `src/lib/familias.ts:33`, y el identify de Salidas ya acepta
tokens (delega en `identifyFamily`, que resuelve `tipo: 'token'`). Pero la página
pública de Salidas **no lee `?t=`**: una familia que reciba el enlace aterriza en el
formulario de DNI vacío. `docs/00-desarrollos-futuros.md` deja esto apuntado
explícitamente como el siguiente paso ("estrenarlo en Salidas … el formulario de
Salidas todavía no lee el `?t=`"). Cerrar el hueco convierte el recordatorio de pago en
un enlace de un toque — el módulo donde la tasa de respuesta ahorra tiempo real de
persecución de pendientes.

## Current state

- `src/app/(public)/salidas/page.tsx` — server component SIN `searchParams`:

```tsx
export default function SalidasPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="anim-stagger mx-auto w-full max-w-xl px-4 py-8">
        ...
        <SalidasFamilia />
```

- El patrón a imitar — `src/app/(public)/licencias/page.tsx:13-19`:

```tsx
export default async function LicenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tok?: string }>;
}) {
  const { t, tok } = await searchParams;
  const tokenAcceso = (t ?? tok ?? '').trim() || null;
```

  y `LicenciasForm` recibe `tokenAcceso` como prop.

- `src/components/salidas/salidas-familia.tsx` — client component; paso `id` con input
  de identificador que se envía a `/api/salidas/identify` (`{ identificador }`); el
  resto del flujo revalida con `verifyFamilyStudent(identificador, eduStudentId)` en
  cada endpoint (estado, justificante).
- Recordatorio de pago: `src/app/api/salidas/admin/recordatorio/route.ts` +
  `sendRecordatorioPago` (`src/lib/salidas-email.ts:122`) — hoy envía cuerpo con
  variables `{alumno} {salida} {fecha} {importe}`, SIN enlace personal.
- Generación de tokens: `src/lib/fam-tokens-server.ts` — `getFamiliasDeAlumnos(ids)`,
  `ensureTokens({ familias, proposito })` (reutiliza el vigente o crea), y
  `urlAccesoFamilia(appBaseUrl(), 'salidas', token)` (`src/lib/familias.ts:39`;
  `appBaseUrl` en `src/lib/constants.ts`). Uso de referencia:
  `src/app/api/licencias/admin/correos/route.ts:83`.
- **Reglas de tokens** (docs/04): son credenciales — nunca en logs, nunca listados en
  pantalla, nunca en CSV commiteado. En correos a familias sí pueden ir.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |
| Dev | `pnpm dev` | :3000 |

## Scope

**In scope**:
- `src/app/(public)/salidas/page.tsx` (leer `?t=`/`?tok=`)
- `src/components/salidas/salidas-familia.tsx` (prop `tokenAcceso`, auto-identificación)
- `src/app/api/salidas/admin/recordatorio/route.ts` y `src/lib/salidas-email.ts` (variable `{enlace}`)
- `src/components/salidas/recordatorio-panel.tsx` (mencionar la variable disponible en la UI de ayuda, si el panel lista las variables)

**Out of scope**:
- `src/lib/fam-tokens-server.ts`, `src/lib/familias.ts`, `src/lib/familias-server.ts` — la infraestructura NO se toca, solo se consume.
- El flujo de Licencias.

## Git workflow

- Branch: `feat/salidas-magic-link`; mensaje `feat(salidas): magic link de familias en el formulario público y en el recordatorio de pago`.

## Steps

### Step 1: La página lee el token

Replica en `src/app/(public)/salidas/page.tsx` el patrón exacto de licencias
(searchParams `{ t, tok }` → `tokenAcceso: string | null`) y pásalo:
`<SalidasFamilia tokenAcceso={tokenAcceso} />`.

**Verify**: `pnpm build` exit 0.

### Step 2: El componente se auto-identifica con el token

En `salidas-familia.tsx`, añade la prop `tokenAcceso?: string | null`. Mira cómo lo
hace `licencias-form.tsx` con su prop homónima (busca `tokenAcceso` en ese fichero y
copia el enfoque): al montar con token presente, lanza la misma identificación que el
submit manual usando el token como `identificador` (y conserva ese valor en el estado
para las llamadas posteriores a `/api/salidas/estado` y `/api/salidas/justificante`,
que ya reciben `identificador`). Si el token no valida (revocado/caducado), cae al
formulario manual con el error genérico existente.

**Verify**: `pnpm build` exit 0. En dev: `http://localhost:3000/salidas?t=<token-de-dev>`
salta directo a la lista de hijos/salidas sin teclear DNI; con `?t=tok_invalido`,
muestra el formulario manual con error genérico.

### Step 3: `{enlace}` en el recordatorio de pago

En el route handler del recordatorio (`src/app/api/salidas/admin/recordatorio/route.ts`):

1. Tras resolver las familias pendientes (ya agrupadas por email/tutor), obtén sus
   tokens: `getFamiliasDeAlumnos(<ids de alumnos pendientes>)` →
   `ensureTokens({ familias, proposito: 'salidas' })` (mira la llamada de referencia en
   `src/app/api/licencias/admin/correos/route.ts:83` y ajusta a las estructuras reales
   de este route).
2. Construye `enlace = urlAccesoFamilia(appBaseUrl(), 'salidas', token)` por familia y
   pásalo a `sendRecordatorioPago`.
3. En `sendRecordatorioPago` (`src/lib/salidas-email.ts`), añade `{enlace}` al
   sustituidor `rellenar` (mismo estilo que `{alumno}`/`{salida}`) y — dado que el
   HTML de ese correo no enlaza URLs — envuélvelo como `<a href>` o añade un botón como
   el `boton()` de `licencias-email.ts`.
4. `marcarTokensEnviados(tokens)` tras el envío (ver `fam-tokens-server.ts:247`).

**Verify**: `pnpm build` exit 0; envío de PRUEBA desde el panel de recordatorio a tu
propio correo de dev → llega con enlace clicable `https://…/salidas?t=tok_…` que abre
el flujo auto-identificado.

### Step 4: Repaso de fugas de token

**Verify**: `grep -rn "console" src/app/api/salidas/admin/recordatorio/route.ts src/lib/salidas-email.ts` — ningún log imprime tokens ni URLs con `?t=`; la respuesta JSON del route al panel no incluye los tokens (solo contadores).

## Test plan

Sin runner obligatorio. Si el plan 004 está hecho, no hay funciones puras nuevas que
testear aquí (la construcción de URL ya está cubierta por ser trivial); la verificación
es el flujo manual de Steps 2-3.

## Done criteria

- [ ] `/salidas?t=<token válido>` auto-identifica; token inválido cae a formulario manual
- [ ] Recordatorio de prueba llega con `{enlace}` personal clicable
- [ ] Ningún token en logs ni en respuestas del panel (Step 4)
- [ ] `pnpm lint && pnpm build` exit 0
- [ ] `docs/00-desarrollos-futuros.md`: marcar la idea de "estrenarlo en Salidas" como hecha (mismo commit), y `plans/README.md` actualizado

## STOP conditions

- Si `licencias-form.tsx` NO tiene un patrón de auto-identificación por `tokenAcceso` reutilizable (p. ej. está entrelazado con estado propio de licencias) → implementa la auto-identificación mínima descrita (efecto al montar) sin copiar código enredado; si tampoco es viable sin reestructurar el wizard, STOP y reporta.
- Si el route del recordatorio no tiene acceso a los ids de alumnos (solo emails) → STOP y reporta la estructura real encontrada en vez de improvisar joins nuevos.
- Si no existen tokens de dev para probar → genera uno con `pnpm tokens:familias` contra la BBDD de dev SOLO si esa BBDD es de desarrollo; si solo hay producción, STOP.

## Maintenance notes

- El mismo patrón (leer `?t=`, revalidar por token en cada petición) es el que debe estrenar cualquier módulo público futuro (Evaluaciones).
- Revisor: vigilar que el token nunca aparezca en pantalla (ni en el estado de error), solo en la URL entrante y las peticiones.
