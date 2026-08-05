# Plan 008: Coherencia de UI y motion en la superficie pública (tipografía, curso hardcodeado, stepAnim compartido, reduced-motion, haptics)

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/app/page.tsx "src/app/(public)" src/components/licencias/licencias-form.tsx src/components/salidas/salidas-familia.tsx src/app/layout.tsx`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: M (varios cambios S independientes; ejecutar en orden, commit por paso si se quiere)
- **Risk**: LOW-MED (superficie pública de familias; solo presentación)
- **Depends on**: none
- **Category**: ui / motion
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

La superficie pública (portada + `/licencias` + `/salidas`) es la cara del colegio ante
las familias y la referencia de diseño declarada del repo
(`docs/04-convenciones-tecnicas.md`: "Marca: … acento azul (referencia: portada y
formulario de Licencias)"; "Animaciones con motion/react … Haptics con ios-haptics").
Auditadas las tres páginas contra sí mismas, hay 5 derivas verificadas:

1. **Tipografía**: el h1 de `/licencias` no lleva `tracking-tight`; los h1 idénticos de
   la portada y `/salidas` sí.
2. **Copy con fecha congelada**: la portada dice "Curso 2026/2027" **hardcodeado**
   mientras `/licencias` lo saca de la campaña activa. Al abrir la campaña 2027/28 la
   portada mentirá. La metadata de `/licencias` también lo hardcodea.
3. **Animación de entrada asimétrica**: `/salidas` tiene `anim-stagger` en el `<main>`;
   `/licencias` (misma estructura de cabecera) no tiene ninguna animación de entrada.
4. **Dos físicas de wizard**: `licencias-form.tsx` y `salidas-familia.tsx` definen cada
   uno su `stepAnim` con valores distintos (y ±10 / 0.22s easeOut vs x ±24 / 0.2s ease
   por defecto). Mismo patrón, identidad de movimiento distinta.
5. **Reduced motion y haptics**: las animaciones CSS (`globals.css`) respetan
   `prefers-reduced-motion`, pero las de `motion/react` no — incluidos los blobs en
   bucle infinito de la portada y el pulso infinito del check de éxito de licencias.
   Y el formulario de licencias (el módulo de referencia) no usa NINGÚN haptic,
   mientras salidas y registro-abc sí (`haptic.tap/success/warning`).

## Current state

- `src/app/(public)/licencias/page.tsx:40` — `<h1 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">` (sin tracking-tight). `/salidas` línea 25 y portada línea 41 sí lo llevan.
- `src/app/page.tsx` — `'use client'`; línea 44: `<p className="mt-1 text-sm text-zinc-500">Curso 2026/2027 · Colegio Consolación Burriana</p>`. También líneas 11-22: dos `motion.div` con `animate` en bucle `repeat: Infinity` (blobs de fondo).
- `src/app/(public)/licencias/page.tsx:6-9` — `export const metadata = { … description: 'Solicitud de licencias digitales · curso 2026/2027' }`; el mismo fichero ya carga `getCurrentCampaign()` y muestra `campaign.academicYear` en pantalla (línea 43).
- `src/app/(public)/salidas/page.tsx:13` — `<main className="anim-stagger mx-auto …">`; licencias (línea 28) no tiene clase de animación.
- `src/components/licencias/licencias-form.tsx:110-115`:

```ts
const stepAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};
```

- `src/components/salidas/salidas-familia.tsx:41-46`:

```ts
const stepAnim = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.2 },
};
```

- Haptics: `src/lib/haptics.ts` expone `haptic.tap/success/warning/...`;
  `salidas-familia.tsx` los usa en líneas 131, 181, 207, 210; `registro-form.tsx` en
  126, 147, 156, 164; `licencias-form.tsx` → cero usos (`grep -c haptic` = 0).
- `src/app/layout.tsx` — server component; envuelve children en `<ThemeProvider>`
  (next-themes). Ahí se insertará `MotionConfig`.
- Sistema CSS: `src/app/globals.css:131-155` — `.anim-up`/`.anim-stagger`
  (0.45s `cubic-bezier(0.22, 1, 0.36, 1)`), con bloque `prefers-reduced-motion` que las anula.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |
| Dev | `pnpm dev` | :3000 |

## Scope

**In scope**:
- `src/app/page.tsx`, `src/app/(public)/licencias/page.tsx`, `src/app/(public)/salidas/page.tsx`
- `src/components/licencias/licencias-form.tsx`, `src/components/salidas/salidas-familia.tsx`
- `src/lib/motion.ts` (crear), `src/app/layout.tsx` (solo envolver con MotionConfig)

**Out de scope**:
- `src/components/registro-abc/**` — el ABC usa acento teal deliberadamente distinto; no unificar colores ni tocar su motion aquí.
- `globals.css` — el sistema `.anim-*` está bien; no añadir tokens nuevos.
- Cualquier cambio funcional de los formularios (pasos, validación, fetches).

## Git workflow

- Branch: `fix/public-ui-motion`; mensajes por paso tipo `fix(ui): …` / `feat(motion): …`.

## Steps

### Step 1: tracking-tight en el h1 de licencias

En `src/app/(public)/licencias/page.tsx:40` añade `tracking-tight` a la className del
h1 (idéntico al de salidas).

**Verify**: `grep -n "tracking-tight" "src/app/(public)/licencias/page.tsx"` → 1 hit.

### Step 2: Curso dinámico en portada y metadata

1. `src/app/page.tsx` es `'use client'` y no puede leer BBDD. Conviértelo en un
   patrón server-wrapper: crea `src/components/home/home-landing.tsx` con TODO el JSX
   actual como client component que recibe `cursoLabel: string | null` por props, y
   deja `src/app/page.tsx` como server component `force-dynamic` que hace
   `const campaign = await getCurrentCampaign()` (import de `@/lib/licencias-server`)
   y renderiza `<HomeLanding cursoLabel={campaign ? \`Curso ${campaign.academicYear}\` : null} />`.
   La línea del párrafo pasa a `{cursoLabel ? `${cursoLabel} · ` : ''}Colegio Consolación Burriana`.
2. En `src/app/(public)/licencias/page.tsx`, cambia la `description` de la metadata a
   texto sin año: `'Solicitud de licencias digitales · Colegio Consolación Burriana'`
   (la alternativa generateMetadata con query a BBDD no compensa para una description).

**Verify**: `pnpm build` exit 0; con dev, la portada muestra el curso de la campaña
activa de dev y, sin campaña abierta, solo "Colegio Consolación Burriana";
`grep -rn "2026/2027" src/app/page.tsx "src/app/(public)/licencias/page.tsx"` → 0.

### Step 3: Entrada animada también en /licencias

En `src/app/(public)/licencias/page.tsx:28` añade `anim-stagger` a la className del
`<main>` (igual que salidas línea 13).

**Verify**: visual en dev — la cabecera y la card de licencias entran con el mismo
stagger que /salidas; con "reducir movimiento" activado en el SO, sin animación.

### Step 4: `stepAnim` compartido

1. Crea `src/lib/motion.ts`:

```ts
// Transición estándar de pasos de asistente (formularios públicos). Una sola física
// para toda la plataforma: deslizamiento vertical corto con easeOut.
export const stepAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
} as const;
```

   (Se adopta la variante de licencias: es la referencia declarada del repo.)
2. En `licencias-form.tsx` y `salidas-familia.tsx`: borra el `const stepAnim` local e
   importa `{ stepAnim }` de `@/lib/motion`.

**Verify**: `grep -rn "const stepAnim" src/components` → 0 hits; `pnpm build` exit 0;
en dev, los pasos de /salidas ahora deslizan en vertical igual que licencias.

### Step 5: MotionConfig reducedMotion="user"

En `src/app/layout.tsx`, envuelve `{children}` (dentro de ThemeProvider) con
`<MotionConfig reducedMotion="user">` (`import { MotionConfig } from 'motion/react'`).
MotionConfig es client component; usarlo dentro del layout server es válido en Next.

**Verify**: `pnpm build` exit 0. En dev con "reducir movimiento" del SO activado: los
blobs de la portada y el pulso del check de éxito quedan estáticos (las animaciones de
transform se desactivan; las de opacity pueden mantenerse — comportamiento estándar de
MotionConfig).

### Step 6: Haptics en el formulario de licencias

En `licencias-form.tsx` (`import { haptic } from '@/lib/haptics';`), siguiendo el
patrón exacto de `salidas-familia.tsx`:

- `haptic.tap()` al identificar con éxito (donde se pasa del paso identify al siguiente) y al avanzar de paso.
- `haptic.success()` al llegar al paso `done` (pedido registrado).
- `haptic.warning()` en el camino de error del identify y del submit (donde se setea `setError`).

**Verify**: `grep -c "haptic" src/components/licencias/licencias-form.tsx` → ≥4;
`pnpm lint && pnpm build` exit 0; prueba en dev (en desktop no vibra — basta con que no rompa).

## Test plan

Sin tests unitarios (presentación). Verificación: los checks visuales por paso + un
repaso final en claro/oscuro de portada, /licencias y /salidas (la convención del repo
exige revisar dark mode en todo cambio de UI).

## Done criteria

- [ ] Steps 1-6 verificados como se describe
- [ ] `grep -rn "2026/2027" src/app src/components` → 0 hits en código (docs pueden mantenerlo)
- [ ] `grep -rn "const stepAnim" src/components` → 0
- [ ] `pnpm lint && pnpm build` exit 0
- [ ] Revisado en claro y oscuro; `plans/README.md` actualizado

## STOP conditions

- Si el wrapper de la portada (Step 2) rompe las animaciones de entrada existentes o el fondo (los `motion.div` deben seguir igual) → revisa que TODO el JSX se movió intacto; si hay conflicto de 'use client', STOP y reporta.
- Si `MotionConfig` provoca hydration errors en consola → STOP y reporta (no lo dejes a medias).
- Si hay una campaña real abierta y el cambio de portada no se puede probar contra dev → prueba con la campaña de dev y anótalo.

## Maintenance notes

- `src/lib/motion.ts` es ahora el sitio de las constantes de motion compartidas; el próximo asistente (Evaluaciones) debe importar `stepAnim` de ahí.
- Docs: la convención escribe `haptic.confirm()`/`haptic.error()` pero la API real es `haptic.success()`/`haptic.warning()` — el plan 009 corrige la doc.
- Revisor: cero cambios de lógica en los formularios; solo clases, imports y llamadas a haptic.
