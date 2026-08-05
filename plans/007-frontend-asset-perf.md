# Plan 007: Peso de cliente — recharts fuera del bundle del listado ABC y logo por `next/image`

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/app/gestion/abc/registros/page.tsx src/app/page.tsx "src/app/(public)"`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

1. `src/app/gestion/abc/registros/page.tsx` es `'use client'` (967 líneas) e importa
   estáticamente 12 símbolos de **recharts** (líneas 7-10) — el chunk de cliente más
   grande de la app — pero los gráficos solo se renderizan en `mode === 'informe'`;
   el modo por defecto (listado paginado) no pinta ningún gráfico. Todo profesor que
   abre el listado en iPad descarga y parsea recharts para nada. Es el único consumidor
   de recharts del repo.
2. `public/logobur.png` es un PNG de 600×300 y ~68 KB servido con `<img>` crudo en 7
   sitios (portada, licencias, salidas, escritorio de gestión a 36px, login, ficha de
   bancolibros). `next/image` no se usa en NINGÚN sitio del repo y `next.config.ts`
   está vacío (el optimizador está disponible). En las páginas públicas (las de más
   tráfico y más móvil) el logo es el mayor asset estático; optimizado serían ~2-5 KB.

## Current state

- `src/app/gestion/abc/registros/page.tsx:1-10`:

```ts
'use client';
...
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
```

  La página tiene dos modos (estado `mode`, valores lista/informe); los charts viven en
  el bloque del informe (busca `mode === 'informe'` y los componentes `InformeView` /
  `Heatmap` dentro del mismo fichero).

- Call sites del logo (todos `<img src="/logobur.png"`, con eslint-disable de
  `@next/next/no-img-element` encima en varios):
  - `src/app/page.tsx:33` (220-260px de ancho render)
  - `src/app/(public)/licencias/page.tsx:32` (210-250px)
  - `src/app/(public)/salidas/page.tsx:17` (210-250px)
  - `src/app/gestion/page.tsx:117` (`className="h-9 w-auto"` ≈ 36px de alto)
  - `src/app/gestion/login/page.tsx:24` (~170px)
  - `src/app/gestion/bancolibros/ficha/page.tsx:73` y `:130` — **vista de imprimir; NO tocar** (ver Scope)

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |
| Dev | `pnpm dev` | server en :3000 |

## Scope

**In scope**:
- `src/app/gestion/abc/registros/page.tsx` (solo mover imports/bloque de charts)
- `src/components/registro-abc/registros-charts.tsx` (crear — o el nombre que encaje con los ficheros ya existentes de `src/components/registro-abc/`)
- Los 5 call sites del logo listados (portada, licencias, salidas, gestion, login)

**Out of scope**:
- `src/app/gestion/bancolibros/ficha/page.tsx` — es la ficha imprimible (print-to-PDF); un `next/image` puede romper la impresión. Se queda con `<img>`.
- Cualquier cambio visual: mismos tamaños renderizados, mismas clases.
- `next.config.ts` — no hace falta tocarlo.

## Git workflow

- Branch: `perf/client-assets`; mensaje `perf: recharts con dynamic import en informe ABC y logo con next/image`.

## Steps

### Step 1: Extraer los charts del informe ABC

1. Crea `src/components/registro-abc/registros-charts.tsx` (client component) y mueve
   allí el JSX + helpers que usan recharts (el bloque del informe: gráficos de área,
   barras, tarta y heatmap — los componentes internos tipo `InformeView`/`Heatmap`
   que ya están delimitados con `function` dentro de la página). Mueve TAMBIÉN el
   import de recharts; la página no debe importar recharts.
2. En la página, cárgalo con:

```ts
import dynamic from 'next/dynamic';
const RegistrosCharts = dynamic(() => import('@/components/registro-abc/registros-charts'), { ssr: false });
```

   y renderízalo donde estaba el bloque, pasándole por props los datos que ya calculaba
   la página (no muevas la lógica de filtrado, solo la de pintado; si un `useMemo` solo
   sirve a los charts, muévelo con ellos).

**Verify**: `pnpm build` exit 0 y `grep -n "recharts" src/app/gestion/abc/registros/page.tsx` → 0 hits.

### Step 2: Comprobar el split en el build

**Verify**: en la salida de `pnpm build`, la ruta `/gestion/abc/registros` reduce su
First Load JS respecto al build previo (haz `pnpm build` antes del Step 1 y guarda la
cifra). El informe sigue funcionando en dev: cambiar a modo informe muestra un estado
de carga breve y luego los gráficos idénticos.

### Step 3: Logo con `next/image` en 5 sitios

En cada call site (excepto la ficha imprimible): sustituye `<img …>` por
`<Image src="/logobur.png" alt="Colegio Consolación · Burriana" width={W} height={H} … />`
con `import Image from 'next/image'`, conservando el `width`/`height` HTML actual del
sitio (p. ej. 250×125 en licencias/salidas, 260×130 en portada) y el `className`
existente. Borra los `eslint-disable @next/next/no-img-element` que queden huérfanos.

**Verify**: `pnpm lint && pnpm build` exit 0; en dev, las 5 páginas muestran el logo con
el mismo tamaño (comprobar portada y /licencias en claro y oscuro), y la pestaña
Network sirve `/_next/image?...` en lugar del PNG crudo.

## Test plan

Sin tests unitarios (es UI/bundle). Las verificaciones son las cifras del build y la
comprobación visual del Step 3.

## Done criteria

- [ ] `grep -rn "from 'recharts'" src/app` → 0 (solo el nuevo componente en src/components lo importa)
- [ ] First Load JS de `/gestion/abc/registros` menor que en `fd75980`
- [ ] 5 call sites con `next/image`; la ficha de bancolibros intacta
- [ ] `pnpm lint && pnpm build` exit 0
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si al extraer los charts hay estado compartido no trivial entre listado e informe que obligue a levantar más de ~3 props → STOP y reporta (puede requerir el refactor mayor de DEBT-04, fuera de alcance).
- Si `next/image` renderiza el logo borroso o con layout shift visible en la portada → revisa width/height; si persiste, deja ese call site con `<img>` y anótalo.

## Maintenance notes

- Si algún otro panel quiere gráficos, importa recharts SOLO vía componentes dynamic como este.
- Revisor: el diff de la página ABC debe ser movimiento de código, no reescritura; comparar los charts renderizados antes/después con los mismos filtros.
