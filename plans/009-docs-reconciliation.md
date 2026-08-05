# Plan 009: Reconciliar la documentación con la realidad (README, .env.local.example, tabla maestra, contradicciones y credencial en docs/11)

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- README.md docs/ .env.local.example .gitignore`
> On a mismatch, re-verifica cada afirmación contra el código antes de editar.

## Status

- **Priority**: P1 (por la credencial en docs/11; el resto es P2)
- **Effort**: S
- **Risk**: LOW (solo docs y un fichero example)
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

Este repo se opera por su documentación: el protocolo "sigue haciendo" de
`docs/plataforma.md` manda a cualquier agente a la primera casilla `[ ]` del hito
activo. Cuando la doc miente, el protocolo despacha trabajo ya hecho o bloquea trabajo
libre. Hallazgos verificados contra el código:

1. **`docs/11-licencias-v2.md` contiene una contraseña compartida en texto plano** (la
   del login de gestores retirado en el hito 2) en la sección "Decisiones cerradas" y
   repetida en la checklist de Fase 2. El sistema murió, pero la cadena queda quemada
   en git para siempre y las contraseñas de personal se reutilizan.
2. **README.md activamente falso**: promete "Autenticación con Clerk" (la decisión
   cerrada fue Auth.js v5 con Google, `docs/01-auth-roles.md`), documenta `/admin` como
   panel (es un redirect de 5 líneas a `/gestion/abc`), lista un solo módulo cuando hay
   seis, y el paso de Vercel dice añadir SOLO `DATABASE_URL` (un deploy así pierde
   email, Sheets, magic links y Blob en silencio).
3. **`.env.local.example` no está trackeado** (`.gitignore` lo tapa con `.env*`) y solo
   tiene 4 de las ~10 variables en uso — en un clon limpio, `cp .env.local.example
   .env.local` del README falla directamente.
4. **Tabla maestra y futuros desactualizados**: la fila de Salidas dice "falta solo
   correos masivos a pendientes" pero esa casilla está `[x]` y el código existe
   (`recordatorio-panel.tsx`); lo que falta es el export CSV. `00-desarrollos-futuros.md`
   aún lista como pendientes el store de Blob (creado y verificado) y la decisión del
   `academic_year` (decidida e implementada en `src/lib/constants.ts`).
5. **`docs/04` se contradice** sobre Blob en el mismo fichero (línea 46 "pendiente de
   crear el store" vs 117 "ya existe; lo estrenó Salidas") y documenta una API de
   haptics que no existe (`haptic.confirm()`/`haptic.error()`; la real es
   `haptic.success()`/`haptic.warning()`, ver `src/lib/haptics.ts`).
6. **Tres casillas parecen "no hecho" pero solo esperan credenciales de David**
   (escritura en el Sheet, generar tokens 2026/27 contra Neon, prueba OAuth real):
   la regla "no hay tercer estado" no da forma de decirlo.

## Current state

- Credencial: `docs/11-licencias-v2.md` — bullet "**Login gestores:** simple — `<email>` / `<contraseña en claro>`" (≈ línea 78) y la repetición en la checklist de Fase 2 (≈ línea 138). NO copies estos valores a ningún sitio.
- `README.md`: línea 47 `cp .env.local.example .env.local`; línea 104 `### Admin (/admin)`; línea 154 "Fase 2: Autenticación con Clerk".
- `.env.local.example` (6 líneas, solo DATABASE_URL + AUTH_*). Variables reales en uso — tabla en `docs/04-convenciones-tecnicas.md:36-46`: `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `LICENCIAS_GESTORES`, `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `APP_BASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `BLOB_READ_WRITE_TOKEN`.
- `docs/plataforma.md:69` — fila Salidas: `✅ (Blob activo; falta solo correos masivos a pendientes)`.
- `docs/15-salidasypagos.md:136` — `[x] Correos de recordatorio de pago…`; su ficha/00-futuros dicen que lo pendiente es el CSV.
- `docs/04-convenciones-tecnicas.md:46` — fila Blob con "pendiente de crear el store"; `src/lib/blob.ts` existe y Salidas lo usa.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Grep credencial | `grep -rn "Licencias2025" docs/` | 0 hits al terminar (usa el valor real leído del fichero, no este placeholder, si difiere) |
| Lint/Build | `pnpm lint && pnpm build` | exit 0 (no debería verse afectado) |

## Scope

**In scope**: `README.md`, `.env.local.example`, `.gitignore` (una línea de negación), `docs/plataforma.md`, `docs/00-desarrollos-futuros.md`, `docs/04-convenciones-tecnicas.md`, `docs/11-licencias-v2.md`.

**Out of scope**: cualquier fichero de `src/`. Cualquier decisión de producto nueva (solo se reconcilia lo ya decidido y verificado).

## Git workflow

- Branch: `docs/reconciliacion`; mensaje `docs: reconciliar README/env/tabla maestra con la realidad y retirar credencial legada`.

## Steps

### Step 1: Retirar la credencial de docs/11

En `docs/11-licencias-v2.md`, sustituye el bullet de "Login gestores" por:
`- **Login gestores (histórico):** login propio por cookie, retirado en el hito 2 — ver 01-auth-roles.md. La credencial que figuraba aquí se considera quemada (queda en el historial de git): no reutilizarla en ningún sistema.`
y elimina la repetición de la contraseña en la checklist de Fase 2 (deja la casilla con
texto sin credencial). Corrige también el path "panel en `app/admin/licencias`" →
"panel en `src/app/gestion/licencias/`".

**Verify**: grep de la contraseña (el valor exacto que leíste) sobre `docs/` → 0 hits.

### Step 2: `.env.local.example` completo y trackeado

1. Añade a `.gitignore`, justo después de la línea `.env*`: `!.env.local.example`.
2. Reescribe `.env.local.example` con las 12 variables de la tabla de docs/04, cada una
   con placeholder vacío o de formato (`RESEND_API_KEY=re_...`) y un comentario de una
   línea. **PROHIBIDO copiar ningún valor de `.env.local`** (no lo abras).

**Verify**: `git check-ignore .env.local.example` → exit 1 (ya no ignorado); `git add .env.local.example && git status` lo muestra como nuevo; `grep -c "=" .env.local.example` ≥ 12.

### Step 3: README verídico

- Sección de herramientas: los seis módulos con una línea cada uno y paneles bajo `/gestion/**` (con `/admin` descrito como redirect heredado).
- Setup: mismo flujo pero apuntando a la tabla de env de `docs/04-convenciones-tecnicas.md` (y ahora el `cp` funciona).
- Vercel: "configura las variables de la tabla de docs/04" en lugar de solo DATABASE_URL.
- Borra "Próximas fases" (Clerk incluido) y apunta al roadmap real: `docs/plataforma.md`.
- Sincroniza la tabla de scripts con `package.json` (incluye `lint`, `db:seed:licencias`, `tokens:familias`).

**Verify**: `grep -in "clerk" README.md` → 0.

### Step 4: Tabla maestra y futuros

- `docs/plataforma.md:69`: fila Salidas → `✅ (Blob activo; falta export CSV)`.
- `docs/00-desarrollos-futuros.md`: elimina (o marca resueltos, según el estilo del doc) el ítem del store de Blob y la pregunta del `academic_year`; si el doc tiene sección de decididas, muévelas ahí con su fecha.

**Verify**: lectura cruzada — la tabla maestra ya no contradice `docs/15-salidasypagos.md`.

### Step 5: docs/04 coherente

- Línea 46: quitar "— **pendiente de crear el store**" (dejar solo qué es la var).
- Sección UI: corregir `haptic.confirm()` → `haptic.success()` y `haptic.error()` → `haptic.warning()`.

**Verify**: `grep -n "pendiente de crear el store" docs/` → 0; `grep -n "haptic.confirm" docs/` → 0.

### Step 6: El estado "código listo, falta David"

En `docs/plataforma.md`, dentro del protocolo "sigue haciendo", añade tras el punto 4:
`Excepción: una casilla puede marcarse [~] = "código terminado, pendiente solo de verificación o credenciales de David"; cuenta como bloqueada, no como pendiente de implementar.`
Y aplica `[~]` a: escritura en el Sheet (`docs/11:151`), generar tokens 2026/27
(`docs/11:181`) — verifica los números de línea con grep antes de editar.

**Verify**: `grep -n "\[~\]" docs/plataforma.md docs/11-licencias-v2.md` → ≥3 hits.

## Test plan

No aplica (docs). La verificación son los greps por paso.

## Done criteria

- [ ] Credencial ausente de `docs/` (grep 0)
- [ ] `.env.local.example` trackeado con ≥12 vars placeholder
- [ ] README sin Clerk, sin `/admin` como panel, scripts sincronizados
- [ ] Tabla maestra/futuros/docs04 sin las 4 contradicciones listadas
- [ ] `pnpm build` exit 0 (sanity)
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si al abrir docs/11 la credencial ya no está → alguien lo arregló; salta el Step 1 y sigue.
- Si `00-desarrollos-futuros.md` contiene discusión adicional sobre el ítem de Blob o academic_year que no encaja con "resuelto" → no borres esa discusión; marca solo lo verificado y reporta.
- NUNCA abras ni copies `.env.local`. Si el Step 2 parece requerirlo, es que lo estás haciendo mal: los placeholders salen de la tabla de docs/04.

## Maintenance notes

- **Acción para David (no automatizable)**: confirmar que la contraseña retirada de docs/11 no se reutiliza en ningún otro sistema del colegio; si se reutiliza, rotarla allí. El valor sigue en el historial de git.
- El estado `[~]` da visibilidad a los "Inputs pendientes de David": revisarlos al inicio de cada sesión.
- Revisor: diff de docs sin pérdida de información histórica (reformular, no amputar).
