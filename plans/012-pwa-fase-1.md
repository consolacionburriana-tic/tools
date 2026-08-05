# Plan 012: PWA Fase 1 — manifest con `start_url` de gestión, colores de marca y icono apple-touch correcto

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- public/manifest.json src/app/layout.tsx docs/05-pwa.md`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2 (única pieza transversal marcada "priorizada" por David en la tabla maestra)
- **Effort**: S
- **Risk**: LOW (solo manifest/metadata; el SW de Fase 2 queda explícitamente fuera)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

Los usuarios reales son profesorado con iPad; `docs/plataforma.md` marca la PWA como
"transversal, priorizada" y `docs/05-pwa.md` describe los defectos exactos que este
plan corrige: quien instala la app aterriza en `start_url: "/"` — la portada PÚBLICA de
licencias para familias, no la gestión — y el `theme_color` es teal `#0d9488` cuando la
marca es el acento azul (referencia: portada y formulario de Licencias, azul
`#2563eb` = blue-600 de Tailwind, el mismo que usan los CTAs y los botones de correo).
Fase 1 de la ficha: 3 casillas, ~30 minutos, papercut diario de todo el claustro.

## Current state

- `public/manifest.json`:

```json
{
  "name": "Tools Consolación",
  "short_name": "Tools",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0d9488",
  "background_color": "#ffffff",
  "lang": "es",
  "icons": [ { "src": "/icons/icon-192.png", "sizes": "192x192", "purpose": "any maskable" },
             { "src": "/icons/icon-512.png", "sizes": "512x512", "purpose": "any maskable" } ]
}
```

  (sin `scope`; iconos con `purpose: "any maskable"` combinado).

- `src/app/layout.tsx` — `viewport.themeColor: '#0d9488'` (mismo teal) y en `<head>`:
  `<link rel="apple-touch-icon" href="/icons/icon-192.png" />`.
- `docs/05-pwa.md` Fase 1:

```
- [ ] `start_url: '/gestion'` + revisar `scope`
- [ ] Colores de marca en manifest y `apple-touch-icon`
- [ ] Iconos revisados (que el maskable no recorte el logo)
```

- Regla del repo: la casilla se marca `[x]` en el MISMO commit que el código, y si
  cambia el estado del módulo, se actualiza la tabla maestra de `docs/plataforma.md`
  (fila "PWA en iPad").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint/Build | `pnpm lint && pnpm build` | exit 0 |
| Dev | `pnpm dev` | :3000 |

## Scope

**In scope**: `public/manifest.json`, `src/app/layout.tsx` (solo `themeColor`), `public/icons/*` (solo si el maskable recorta — ver Step 3), `docs/05-pwa.md` y `docs/plataforma.md` (casillas/tabla).

**Out of scope**:
- Service worker, página `/offline`, caching — es la Fase 2 con su propio riesgo ("que un deploy no deje la app zombie"); NO empezarla aquí.
- Cambios de UI o de rutas.

## Git workflow

- Branch: `feat/pwa-fase-1`; mensaje `feat(pwa): manifest de gestión con marca azul (Fase 1)`.

## Steps

### Step 1: Manifest

En `public/manifest.json`:

1. `"start_url": "/gestion"` (el proxy redirige a login si no hay sesión — comportamiento deseado).
2. Añade `"scope": "/"` (la app instalada debe poder navegar también a formularios públicos sin salir del standalone).
3. `"theme_color": "#2563eb"` (blue-600, el acento de marca).
4. `"background_color"`: déjalo `#ffffff` (coincide con el fondo claro).

**Verify**: `cat public/manifest.json | python3 -m json.tool` → JSON válido con los 3 cambios.

### Step 2: themeColor del layout

En `src/app/layout.tsx`, `viewport.themeColor: '#0d9488'` → `'#2563eb'`.

**Verify**: `grep -n "0d9488" src/app/layout.tsx public/manifest.json` → 0 hits.

### Step 3: Revisar los iconos maskable

Abre `public/icons/icon-512.png` y comprueba si el logo llega a los bordes (un icono
`maskable` se recorta en círculo/squircle: necesita ~20% de margen de seguridad). Si el
logo se recortaría: separa los propósitos en el manifest — duplica cada entrada de
icono, una con `"purpose": "any"` y otra con `"purpose": "maskable"` apuntando a un
`icon-512-maskable.png` nuevo generado añadiendo margen blanco alrededor del actual
(puedes generarlo con `sips` en macOS: redimensionar el logo al 80% sobre lienzo 512).
Si ya tiene margen suficiente, deja los iconos como están y anótalo.

**Verify**: manifest válido; iconos existentes referenciados existen en `public/icons/`.

### Step 4: Probar y marcar casillas

1. `pnpm build && pnpm dev`; en el navegador, DevTools → Application → Manifest: sin
   warnings, start_url `/gestion`, theme `#2563eb`.
2. Marca `[x]` las 3 casillas de Fase 1 en `docs/05-pwa.md` **solo las que quedaron
   verificadas** (si los iconos no se regeneraron por no hacer falta, la tercera casilla
   se marca con nota "margen ya suficiente").
3. Actualiza la fila PWA de la tabla maestra de `docs/plataforma.md`: sigue 🟡 (falta
   Fase 2 SW), pero el paréntesis pasa a "(Fase 1 hecha; falta SW/offline)".

**Verify**: `git diff docs/` muestra exactamente esos cambios de casillas/tabla.

## Test plan

No aplica runner. La verificación es el panel Manifest de DevTools + (si es posible)
instalación real en un iPad — eso es la Fase 3 de la ficha (QA de campo de David); anota
en el commit que la prueba en iPad real queda pendiente de David.

## Done criteria

- [ ] Manifest: start_url `/gestion`, scope `/`, theme_color `#2563eb`, JSON válido
- [ ] layout.tsx sin `#0d9488`
- [ ] DevTools Manifest sin warnings
- [ ] Casillas de Fase 1 en docs/05 y tabla maestra actualizadas en el mismo commit
- [ ] `pnpm lint && pnpm build` exit 0; `plans/README.md` actualizado

## STOP conditions

- Si `docs/05-pwa.md` tiene decisiones cerradas que contradicen estos valores (p. ej. otro start_url decidido) → gana la ficha; ajusta y reporta.
- Si los iconos fuente no están en el repo y hay que regenerarlos desde `logobur.png` con pérdida visible de calidad → STOP y pide a David el asset original.

## Maintenance notes

- Fase 2 (service worker) es su propio plan futuro: precache shell + `/offline` SOLO, con historia de update (skipWaiting versionado) — la ficha ya nombra el riesgo de app zombie.
- Revisor: comprobar que `start_url: '/gestion'` + proxy no crea bucle de redirect en la app instalada sin sesión (login es `/gestion/login`, excluido del guard en `src/proxy.ts`).
