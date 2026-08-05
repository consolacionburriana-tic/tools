# Plan 003: Parchear dependencias con advisories reales (next, next-auth) y sacar `shadcn` de runtime

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- package.json pnpm-lock.yaml backups/`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW/MED (bump de framework y de auth en beta; smoke test obligatorio)
- **Depends on**: none
- **Category**: security / deps
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

`pnpm audit` (2026-08-05) reporta advisories que SÍ tocan la arquitectura de este repo:

1. **`next` está clavado en `16.2.6` exacto** (`package.json`, sin caret). Hay 9
   advisories con parche en `>=16.2.11`, cuatro high — incluida una **bypass de
   middleware/proxy en App Router con Turbopack**, que es exactamente el patrón de
   `src/proxy.ts` (única puerta de sesión de `/gestion`, `/admin`, `/registro-abc`).
2. **`next-auth` está en `5.0.0-beta.31`**, con 3 critical + 2 high resueltos en
   `5.0.0-beta.32` — incluido GHSA-8fpg-xm3f-6cx3 ("existence-based auth checks can
   fail open"), y `src/proxy.ts` hace justo `if (!req.auth?.user)`.
3. **`shadcn` (el CLI) está en `dependencies`** siendo una herramienta de scaffolding:
   arrastra `@modelcontextprotocol/sdk` → express/hono con 21 advisories (33% del ruido
   total de audit) a cada install y build de producción. Ningún fichero de `src/`
   lo importa (verificado).
4. Higiene menor: `backups/landing-internal.tsx` está trackeado en git (copia muerta de
   la portada, nada la referencia).

## Current state

- `package.json` (extractos, dependencias):

```json
"next": "16.2.6",
"next-auth": "5.0.0-beta.31",
"shadcn": "^4.7.0",
```

  y en devDependencies: `"eslint-config-next": "16.2.6"`.

- `src/proxy.ts` — puerta de auth (líneas 7-18): `export default auth((req) => { … if (!req.auth?.user) { redirect a /gestion/login } … })` con matcher `['/gestion', '/gestion/:path*', '/admin', '/admin/:path*', '/registro-abc', '/registro-abc/:path*']`.
- `backups/landing-internal.tsx` — trackeado (`git ls-files backups` lo lista); sin referencias en `src/`.
- `components.json` en la raíz es lo que lee el CLI de shadcn; no necesita entrada en el manifest.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Audit | `pnpm audit` | sin advisories en rutas `.>next`, `.>next-auth`, `.>shadcn` |
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Dev | `pnpm dev` | server en :3000 |

## Scope

**In scope**: `package.json`, `pnpm-lock.yaml`, borrar `backups/` (y añadir `backups/` a `.gitignore`).

**Out of scope**:
- `xlsx@0.18.5` — sus 2 advisories high NO tienen parche en npm (SheetJS abandonó npm). Decisión registrada: se acepta el riesgo (el parser solo procesa ficheros subidos por admins autenticados). NO intentar migrarlo aquí.
- `googleapis` → `@googleapis/sheets` — mejora válida pero aparte (ver backlog en README de plans). No hacerla en este plan.
- Cualquier cambio de código en `src/` (salvo que el bump lo exija — ver STOP).

## Git workflow

- Branch: `chore/deps-security`; mensaje `chore(deps): next 16.2.x + next-auth beta.32, shadcn a devDeps, borrar backups/`.

## Steps

### Step 1: Bumps en package.json

1. `"next": "16.2.6"` → `"^16.2.11"` (y `eslint-config-next` igual, en devDependencies).
2. `"next-auth": "5.0.0-beta.31"` → `"5.0.0-beta.32"`.
3. Eliminar `"shadcn": "^4.7.0"` de `dependencies` y añadirlo en `devDependencies` como `"shadcn": "^4.7.0"` (o superior).
4. `pnpm install`.

**Verify**: `pnpm install` exit 0; `pnpm audit 2>&1 | grep -c "next-auth"` → 0 advisories de next-auth; las rutas `.>next` y `.>shadcn>` desaparecen del audit (quedarán las de `xlsx` y `googleapis`, aceptadas).

### Step 2: Build y lint

**Verify**: `pnpm lint && pnpm build` → exit 0.

### Step 3: Borrar backups/

```bash
git rm -r backups
echo "backups/" >> .gitignore
```

**Verify**: `git ls-files backups` → vacío.

### Step 4: Smoke test de auth (obligatorio — el bump toca la puerta de sesión)

Con `pnpm dev`:

1. Petición anónima a `http://localhost:3000/gestion` → redirige a `/gestion/login?volver=%2Fgestion` (código 3xx, comprobable con `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/gestion`).
2. Login con Google en el navegador (si hay credenciales de dev) → entra al escritorio; `signOut` funciona.
3. Formularios públicos cargan: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/licencias` → 200; ídem `/salidas`.

**Verify**: los tres puntos como se describen. Si no hay credenciales OAuth de dev disponibles, el punto 1 y 3 bastan, pero anótalo en el commit/reporte.

## Test plan

Sin runner (plan 004). La verificación es audit + build + smoke del Step 4.

## Done criteria

- [ ] `pnpm audit` sin advisories con ruta raíz `next`, `next-auth` o `shadcn`
- [ ] `grep '"shadcn"' package.json` aparece solo bajo devDependencies
- [ ] `git ls-files backups` vacío; `backups/` en `.gitignore`
- [ ] `pnpm lint` y `pnpm build` exit 0; smoke test del Step 4 pasado
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si `next@^16.2.11` introduce errores de build o de tipos que no se arreglan con cambios triviales (renombrar un import) → STOP y reporta el error exacto; no parchees APIs a ciegas (Next 16 tiene docs en `node_modules/next/dist/docs/`).
- Si `next-auth beta.32` cambia la firma de `auth()` usada en `src/auth.ts` / `src/proxy.ts` / `src/lib/auth-guards.ts` → STOP y reporta.
- Si el login de Google deja de funcionar en el smoke test → revertir el bump de next-auth y reportar.

## Maintenance notes

- Dejar `next` con caret para que los patch de seguridad entren solos con el lockfile.
- `xlsx`: decisión de riesgo aceptado documentada aquí; re-evaluar si algún día parsea ficheros de origen no-admin (entonces migrar al build CDN de SheetJS 0.20.x o alternativa mantenida).
- Revisor: el diff de package.json debe ser exactamente 4 líneas de cambio + lockfile + borrado de backups/.
