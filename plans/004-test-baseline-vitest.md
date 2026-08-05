# Plan 004: Baseline de verificación — vitest + typecheck + tests de caracterización de dinero, identificación y catálogo

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/lib/familias.ts src/lib/licencias.ts src/lib/licencias-server.ts package.json`
> On a mismatch with the excerpts below, compare carefully; los tests de caracterización
> deben pinnear el comportamiento ACTUAL del código vivo, no el de los extractos.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (aditivo: no cambia código de producción, salvo una extracción opcional descrita en Step 5)
- **Depends on**: none (desbloquea 005, 006 y cualquier refactor futuro)
- **Category**: tests
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

El repo tiene ~20k líneas, cero tests y cero runner: la Definition of Done es
`pnpm lint` + `pnpm build` + prueba manual (`docs/04-convenciones-tecnicas.md`). Build
solo prueba que compila. Las funciones más peligrosas son puras y triviales de testear:

- **Dinero**: el total del pedido se calcula con el mismo `reduce` duplicado en dos
  sitios (`upsertOrder` y `updateOrderItemsAdmin` en `src/lib/licencias-server.ts`) —
  es el único número en el que familia y colegio tienen que coincidir.
- **Identificación/máscara**: `detectarIdentificador`, `normalizarDni`, `maskAlumno`,
  `nuevoTokenFamilia` (`src/lib/familias.ts`) son la frontera de privacidad de todos
  los módulos públicos; un off-by-one en la máscara expone el nombre de un menor.
- **Catálogo**: `resolveBilingual`, `cursoEfectivo`, `baseCod` (`src/lib/licencias.ts`)
  deciden qué libros y precios ve cada familia.

La convención del repo ya separa lógica pura (`src/lib/<mod>.ts`, "helpers puros
(testeables, sin IO)") de queries: los tests entran sin mocks.

## Current state

- `package.json` scripts (sin `test` ni `typecheck`):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  ...
}
```

- `tsconfig.json` — alias `"@/*": ["./src/*"]` (paths); TS estricto.
- Funciones objetivo y firmas (extractos reales en `fd75980`):
  - `src/lib/familias.ts` — `normalizarDni(v)`, `detectarIdentificador(input)` (regex:
    `DOCUMENTO_RE = /^[A-Z0-9]{5,20}$/`, `NIA_RE = /^[0-9]{5,12}$/`; tokens: lowercase,
    prefijo `tok_`), `maskAlumno(nombre, apellido1, apellido2)` → `"Fra. M. Luc."`,
    `nuevoTokenFamilia(largo = 24)` → `tok_` + 24 chars del alfabeto
    `abcdefghjkmnpqrstuvwxyz23456789`.
  - `src/lib/licencias.ts` — `isPdcLetra`, `toPdcCurso` (`3ESO→3PDC`, `4ESO→4PDC`),
    `cursoEfectivo(baseCurso, letra, seleccionado?)`, `normalize(s)`,
    `resolveBilingual(books, lengua)` (colapsa pares `-CAS`/`-VAL`; si solo hay uno del
    par, lo deja; `wantVal = normalize(lengua).startsWith('valen')`), `baseCod(cod)`,
    `euros(n)` (locale es-ES).
  - `src/lib/licencias-server.ts:477` (dentro de `upsertOrder`):

```ts
const valid = cods.filter((c) => byCod.has(c));
const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);
const totalStr = total.toFixed(2);
```

  y el mismo par filter+reduce dentro de `updateOrderItemsAdmin` (~línea 636).

- Regla de datos: fixtures SIEMPRE inventados (`docs/04-convenciones-tecnicas.md`:
  "Fixtures de test: datos inventados que imiten la estructura real. Nunca recortes de
  ficheros reales.").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm add -D vitest vite-tsconfig-paths` | exit 0 |
| Tests | `pnpm test` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |

## Scope

**In scope**:
- `package.json` (scripts + devDeps), `vitest.config.ts` (crear)
- `src/lib/__tests__/familias.test.ts`, `src/lib/__tests__/licencias.test.ts`, `src/lib/__tests__/licencias-total.test.ts` (crear)
- `src/lib/licencias.ts` (SOLO si se hace la extracción del Step 5)
- `src/lib/licencias-server.ts` (SOLO los dos call sites del total, Step 5)
- `docs/04-convenciones-tecnicas.md` (añadir `pnpm test` a scripts y al DoD)

**Out of scope**:
- Cualquier otro fichero de `src/`. Nada de tests de componentes/route handlers en este plan.
- No añadir jsdom, testing-library ni mocks — solo node + funciones puras.

## Git workflow

- Branch: `feat/test-baseline`; mensaje `test: baseline vitest + caracterización de familias, catálogo y total de pedido`.

## Steps

### Step 1: Instalar vitest y scripts

1. `pnpm add -D vitest vite-tsconfig-paths`
2. Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { include: ['src/**/*.test.ts'] },
});
```

3. En `package.json` scripts, añadir: `"test": "vitest run"`, `"test:watch": "vitest"`,
   `"typecheck": "tsc --noEmit"`.

**Verify**: `pnpm test` → "no test files found" NO es error solo si aún no hay tests; continúa. `pnpm typecheck` → exit 0.

### Step 2: `familias.test.ts`

Casos mínimos (datos inventados):

- `normalizarDni`: minúsculas→mayúsculas, quita espacios/guiones/puntos (`" 12.345-678z "` → `"12345678Z"`).
- `detectarIdentificador`: `"tok_abc"` → tipo token en minúsculas (probar `"Tok_ABC"` → valor `"tok_abc"`); `"12345678"` → nia; `"12345678Z"` → dni; `"X1234567L"` (NIE) → dni; `"abc"` (corto) → null; `""` → null; `"1234"` (4 dígitos) → null.
- `maskAlumno`: `("Francisco","Martínez","Lucencio")` → `"Fra. M. Luc."`; sin apellido2 → `"Fra. M."`; nombre de 2 letras (`"Al"`) → `"Al."` como fragmento; todo null → `"(alumno)"`. **Ejecuta primero y pinnea el output real si difiere.**
- `nuevoTokenFamilia`: prefijo `tok_`, longitud total 4+24, solo chars de `abcdefghjkmnpqrstuvwxyz23456789`, dos llamadas ≠.

**Verify**: `pnpm test` → suite pasa.

### Step 3: `licencias.test.ts`

- `cursoEfectivo`: `("3ESO","PDC")` → `"3PDC"`; `("3ESO","A","4ESO")` → `"4ESO"`; `("1PRI",null)` → `"1PRI"`.
- `resolveBilingual` (objetos `{cod}` inventados): par CAS/VAL + lengua `"Valencià"` → gana VAL; lengua `"Castellano"`/null → gana CAS; solo `-CAS` presente → se mantiene; libro sin sufijo intacto.
- `baseCod`: `"MAT3-CAS"` → `"MAT3"`; `"MAT3"` → `"MAT3"`.
- `normalize`: acentos y espacios (`"  Válencia  "` → `"valencia"`).

**Verify**: `pnpm test` → pasa.

### Step 4: `licencias-total.test.ts` (caracteriza el reduce del total)

El cálculo vive inline en `licencias-server.ts` (con IO alrededor). Caracterízalo
replicando la expresión EXACTA sobre un catálogo inventado, dejando comentario de que
pinnea `upsertOrder`/`updateOrderItemsAdmin`:

- cods vacíos → total `"0.00"`.
- cods desconocidos se filtran (no rompen).
- `precio: null` → cuenta 0 (`|| '0'`).
- `["12.50","3.95","0.05"]` → `"16.50"` (suma float + `toFixed(2)`).

**Verify**: `pnpm test` → pasa.

### Step 5 (opcional pero recomendado): extraer `totalPedido` a `src/lib/licencias.ts`

Solo después de que el Step 4 esté en verde: crea en `src/lib/licencias.ts`

```ts
export function totalPedido(cods: string[], byCod: Map<string, { precio: string | null }>) {
  const valid = cods.filter((c) => byCod.has(c));
  const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);
  return { valid, total, totalStr: total.toFixed(2) };
}
```

y sustituye las DOS copias inline en `licencias-server.ts` (en `upsertOrder` y en
`updateOrderItemsAdmin`) por llamadas a `totalPedido`. Apunta el test del Step 4 a la
función real.

**Verify**: `pnpm test && pnpm build` → todo verde; `grep -c "reduce((sum, c)" src/lib/licencias-server.ts` → 0.

### Step 6: Documentar

En `docs/04-convenciones-tecnicas.md`: añade `pnpm test` y `pnpm typecheck` al bloque
de Scripts, y "0. `pnpm test` pasa" al Definition of done.

**Verify**: `git diff docs/04-convenciones-tecnicas.md` muestra solo esas adiciones.

## Test plan

Este plan ES el test plan. Resultado esperado: ≥25 asserts entre las 3 suites, todas pasando.

## Done criteria

- [ ] `pnpm test` exit 0 con 3 ficheros de test y ≥25 casos
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm lint && pnpm build` exit 0
- [ ] Si se hizo Step 5: cero copias del reduce inline en licencias-server.ts
- [ ] DoD actualizado en docs/04; `plans/README.md` actualizado

## STOP conditions

- Si vitest no resuelve el alias `@/*` con `vite-tsconfig-paths` tras un intento razonable → prueba `resolve.alias` manual apuntando `@` a `./src`; si tampoco, STOP y reporta.
- Si algún test de caracterización FALLA contra el comportamiento actual → NO "arregles" el código: ajusta el test para pinnear la realidad y anota la sorpresa en el reporte (p. ej. si `maskAlumno` con nombre corto difiere de lo esperado).
- Si en Step 5 los tipos de `byCod` difieren entre los dos call sites → STOP y reporta en vez de forzar casts.

## Maintenance notes

- A partir de aquí, todo plan de refactor (005, 006, split de licencias-server) exige `pnpm test` verde como gate.
- Los fixtures son inventados SIEMPRE; jamás copiar filas de exports reales (regla de datos personales del repo).
- Revisor: los tests deben leerse como especificación (nombres de caso descriptivos en castellano, como el resto del repo).
