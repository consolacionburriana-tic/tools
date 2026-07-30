# Licencias V2 · plan y checklist

Migración del Google Apps Script de gestión de licencias (repo `licenciasv1`) a un módulo
`licencias` dentro de **conso-tools** (Next 16 · Drizzle/Neon · Resend · PWA).

> **Cómo usar este documento:** cada fase tiene una checklist. Marca `[x]` lo que demos
> por bueno y dime "arranca Fase N" para empezar la siguiente. Las decisiones de arriba
> están cerradas; si alguna cambia, se actualiza aquí.

---

## Estado: funcionalmente completa ✅

Todo lo definido está construido, verificado y desplegado en `main`:

- **Formulario público** (`/licencias`): identificación, catálogo dinámico (BdL/idioma/PDC),
  packs, indicadores, pedido anti-duplicado, animaciones, emails de confirmación.
- **Portada** (`/`): landing con accesos a licencias y administración (sin exponer ABC).
- **Panel** (`/gestion`, login simple): dashboard "quién falta" por curso (PDC separado),
  abrir/cerrar campaña, listado descargable, exportaciones CSV (ENVIAR/GRATIS/pagos/Educamos/
  por libro), gestión económica, editor de packs y envío de correos masivos.
- **Magic links de familias** (Fase 2b): enlaces personales por familia (`/licencias?t=tok_…`)
  y correo masivo por cursos y clases con esos enlaces. Queda generar los de la campaña real
  en Neon (ver "Inputs pendientes de David").

Pendiente **solo por credenciales/accesos externos** (no por código):
- Escritura directa en el Google Sheet → cuenta de servicio ✅ creada (jul 2026); queda
  verificar la escritura de punta a punta y marcar la casilla de Fase 2.
- Sincronización con la **API de Educamos** → necesita acceso (hoy: import desde Excel).
- Gestión de códigos de activación dentro de la app → diferida a propósito (hoy: FormMule sobre
  las plantillas ENVIAR exportadas).

## Decisiones cerradas

- **Neon = fuente de verdad.** El Excel/Google Sheet pasa a ser solo destino de exportación.
- **Catálogo y formulario derivan de `BBDD Libros`** (filtro `banco_libros`). Cambias la BBDD
  y el formulario va solo. Confirmado con los 2 Google Forms reales.
- **Regla Banco de Libros:** alumno BdL paga solo los libros fuera del banco (Inglés, Francés
  optativa, Digitalización 4ESO); no-BdL paga todo. Bilingüe CAS/VAL se resuelve por `Lengua Base`.
- **Identificación de familia (SUSTITUIDA el 2026-07-11 por protección de datos):** ahora la
  familia teclea el **DNI/NIE del tutor** (lista solo sus hijos, enmascarados "Fra. M. Luc.")
  o el **NIA del alumno**; y desde 2026-07-30 también entra por **magic link**
  (`/licencias?t=tok_…`, tabla `fam_access_tokens`) sin teclear nada. La
  identificación vive en la lib común `src/lib/familias{,-server}.ts` y la comparten todos
  los módulos públicos. El sistema anterior era: botones de curso + año de nacimiento + apellidos →
  match contra la BBDD mostrando el nombre enmascarado a 3 letras ("David → Dav.").
  Validado: 95,5 % únicos solo con curso+año+apellidos.
- **Tokens de acceso de familias (magic links, 2026-07-30):**
  - **Un token = un correo de familia + sus hijos.** Se agrupa por **correo de tutor**
    (normalizado a minúsculas), no por tutor: si padre y madre comparten correo es un único
    destinatario y un único enlace. Si el mismo correo aparece como tutor *distinto* en cada
    hijo (pasa en Educamos), se combinan igual → `student_ids` en el token.
  - El token cubre **todos los hijos activos** de esos tutores, aunque el hermano esté en otra
    clase o etapa; cada módulo filtra después lo que puede pedir (Licencias, solo los de la
    campaña). Así un enlace le sirve a la familia para todo.
  - **Multiuso y reutilizable**: se puede entrar varias veces (un hijo, luego otro, luego
    editar). Regenerar es idempotente y **no invalida los enlaces ya enviados**; para
    invalidarlos hay que revocarlos a mano ("Anular todos los enlaces").
  - **Caducidad 120 días** por defecto (cubre apertura en julio → cierre en octubre).
  - El token **no restringe por módulo**: `proposito` dice para qué se generó, pero la familia
    es la misma en Licencias y en Salidas. Reutilizable tal cual para el resto de módulos.
  - Se generan en **tres sitios, el mismo código** (`src/lib/fam-tokens-server.ts`): al enviar
    los correos (automático, lo que falte), desde `/gestion/licencias/accesos` (botón) y por
    terminal (`pnpm tokens:familias`).
- **Correos a familias (2026-07-30):** el envío masivo tiene dos modos — *familias* (al correo
  del tutor de la BBDD central, con su enlace: uno por familia) y el clásico *alumnos* (al
  correo del alumno). En modo familias se filtra por **cursos y clases**, con casilla "solo
  familias con algún hijo sin pedido", y el correo lleva **nombre de pila + curso de los hijos**
  (`{hijos}`): va a la dirección de sus propios tutores, así que ahí no se enmascara — el
  enmascarado ("Fra. M. Luc.") sigue siendo obligatorio en las **pantallas** públicas.
- **Packs/itinerarios:** configurables en el dashboard, solo ayuda visual (modo por pack:
  `todos` · `elige uno` · `elige uno o ninguno` · `libre`). No bloquean.
- **Envío de licencias:** la app **exporta a tu Google Sheet** (hojas `ENVIAR`) y FormMule
  (ya configurado con "Plantilla NEW") manda los correos. Por ahora, nada más.
- **Educamos:** importar la BBDD ahora, dejar capa "proveedor de alumnos" lista para enganchar
  su API después (el `ID Educamos` ya viaja en los datos). XLS Educamos = un fichero por curso,
  col E = `ID Educamos`, col F = importe (coma decimal). Para fase posterior.
- **Login gestores:** simple — `licencias@consolacionburriana.com` / `Licencias2025`.
- **Resend remitente:** `licencias@consolacionburriana.com`.
- **Dónde vive:** repo `tools`. Form público en `app/(public)/licencias`, panel en `app/admin/licencias`.

### Datos reales (campaña 2026/27)
- 534 alumnos (474 BdL / 60 no · 401 Castellano / 133 Valenciano · 3 sin ID Educamos).
- 57 libros (45 BdL / 12 no).
- Tras promocionar +1, ~323 alumnos quedan en rango de formulario (5PRI→4ESO); los 4ESO gradúan.
- Limpieza pendiente: posible duplicado "Alberto Gimeno Ros" ×2 en 3PRI 2017.

---

## Fase 0 · Cimientos

- [x] Esquema `lic_*` en `src/db/schema.ts` (campaigns, students, books, packs, orders, order_items)
- [x] Generar datos de import desde el `.xlsx` (`src/db/data/licencias-2026.json`) con promoción +1
- [x] Script de import `src/db/seed-licencias.ts` + npm script `db:seed:licencias`
- [x] `pnpm db:push` — 6 tablas `lic_*` creadas en Neon (additivo)
- [x] Ejecutar import y verificar: **57 libros (45 BdL) · 323 alumnos (303 BdL)** ✓
- [ ] Login simple para el panel — *se hará al construir el panel (Fase 2); el formulario de Fase 1 es público*

> **Nota de modelado:** los códigos de libro pueden repetirse en cursos distintos
> (`3ESO-FRAN` y `3ESO-REL` están en 3ESO **y** en 3PDC). Por eso la unicidad de
> `lic_books` es `(campaign, curso, cod)`, no `(campaign, cod)`.

## Fase 1 · Formulario inteligente (familias) — ✅ funcional, verificada por API

- [x] Identificación: ~~curso + año + apellidos~~ → **DNI del tutor o NIA** (2026-07-11, privacidad)
- [x] Catálogo dinámico por curso derivado de `lic_books` (filtro banco_libros) — BdL solo no-banco, no-BdL todo
- [x] Resolución idioma CAS/VAL por `lengua_base` (verificado: 1ESO-TECNO-CAS resuelto)
- [ ] Render de packs/itinerarios — *se configurarán en el panel (Fase 2); ahora selección libre*
- [x] Precio total en vivo + resumen
- [x] Crear pedido con constraint `unique(campaña, alumno)` (anti-duplicado)
- [x] Reabrir/editar pedido (re-identificando al alumno; precarga cods + email)
- [x] "Añadir otro hijo/a" (mismo correo, varios alumnos)
- [x] Email de confirmación a la familia (Resend) — envío activo
- [x] Aviso a la lista de gestores (`licencias@consolacionburriana.com`)

Rutas: `app/(public)/licencias` (form) · `app/api/licencias/{identify,catalog,orders}`.
Lógica: `src/lib/licencias.ts` (helpers) · `src/lib/licencias-server.ts` (queries) · `src/lib/licencias-email.ts`.

Retoques (feedback David): búsqueda en vivo con apellidos enmascarados (`Domingo O.`) y matching
exigente (≥3 letras, prefijo → fallback amplio) · arreglado el foco del input (componentes
hoisted) · `5º EP` fuera este curso · logo `logobur.jpg` mobile-first · acento azul de marca.
Verificado visualmente en claro y oscuro.

### Retoques 2 (feedback David, commit cc51042)

- [x] Logo PNG transparente (con `<img>` plano, robusto) en portada y formulario
- [x] Animaciones al confirmar (transiciones) + check "latente" en la pantalla final
- [x] Resumen del pedido tipo recibo, más bonito
- [x] Q&A en la confirmación según fecha (antes/después del 7 sep) + "¿algo más?"
- [x] Textos del formulario original (no obligatorias, contacto tic@…)
- [x] Optativas visualmente distintas (ámbar + badge) con aviso de tutorías/primera opción
- [x] **Nueva portada pública** (sin exponer ABC): botones a licencias + admin; landing
      interno guardado en `backups/landing-internal.tsx`
- [x] Commit + push a `main` (deploy a tools.consolacionburriana.com)

## Fase 2 · Panel de gestión + export a Google Sheets

- [x] Login simple (`licencias@consolacionburriana.com` / `Licencias2025`) — cookie + middleware
- [x] Panel en `/gestion` (fuera del layout de `/admin` para no exponer las rutas del ABC)
- [x] Dashboard: KPIs (alumnos, con pedido, % , faltan, ingresos, licencias) + desglose por curso
- [x] Indicadores en el formulario: banco de libros destacado, idioma de clase (Cast/Val) y badge "Valencià" en libros
- [x] Desglose por curso con PDC separados (por curso efectivo del pedido)
- [x] Subpanel de gestión económica (`/gestion/economia`) con los ingresos (fuera del dashboard)
- [x] Login rediseñado con logo
- [x] Listado de "quién falta" (alumnos sin pedido) — `/gestion/faltan`, filtro por curso + CSV
- [x] Editor de packs/itinerarios por curso — `/gestion/packs`: crea packs (nombre, modo
      `todos`/`elige uno`/`elige uno o ninguno`/`libre`, libros). El formulario agrupa el
      catálogo por pack con su pista (display, no bloqueante). Casado por código base (CAS/VAL).
- [x] Exportaciones CSV — `/gestion/exportar`: ENVIAR SI/NO (FormMule) + GRATIS BdL,
      pagos consolidado, Educamos (ID+importe), pagos por libro. Descargas protegidas por cookie.
  - [ ] Escritura directa en el Google Sheet (pendiente: cuenta de servicio de Google)
- [x] **Envío de correos desde el panel** — `/gestion/correos`: destinatarios "quienes faltan"
      o "quienes ya tienen", asunto + mensaje con variables `{nombre}/{apellidos}/{curso}`,
      vista previa, envío de prueba y envío masivo con confirmación (Resend batch de 100).

> Auth: credenciales **fijas en código** en `src/lib/licencias-auth.ts` (el override por env
> `LICENCIAS_ADMIN_*` se retiró a propósito: fallaba en Vercel y era indepurable a distancia).
> Se sustituye entero por el login central en el hito 3 (`01-auth-roles.md`).

## Fase 2b · Magic links de familias + correo masivo por cursos y clases

Objetivo: que la familia **no tenga que teclear nada**. Se le manda un correo ("se abre el
plazo, tenéis hasta el X") con un enlace propio que la identifica y le lista a todos sus hijos.

- [x] Esquema: `fam_access_tokens` ampliada (`student_ids`, `email`, `use_count`, `last_used_at`,
      `sent_at`, `revoked_at` + índice por `proposito,email`) — cambios aditivos
- [x] Generación de tokens en `src/lib/fam-tokens-server.ts`: agrupación por correo de tutor,
      unión de hermanos, reutilización idempotente, revocación y resumen de cobertura
- [x] Canje del token en `familias-server.ts`: resuelve `student_ids`/`guardian_id`/`student_id`,
      respeta caducidad y revocación, y cuenta los usos
- [x] Formulario público con `?t=tok_…`: entra sin DNI, salta directo si hay un solo hijo, lista
      a los hermanos si hay varios, y si el enlace ya no vale cae al DNI/NIA con aviso
- [x] Panel `/gestion/licencias/accesos`: cobertura (familias con correo / con enlace / usados),
      botón "generar los que falten", CSV de enlaces y "anular todos"
- [x] Correos masivos en modo **familias**: filtro por cursos y clases, "solo quienes faltan",
      variables `{tutor}/{hijos}/{hijo}/{cursos}/{fecha_limite}/{curso_escolar}/{enlace}`,
      botón de acceso en el HTML, vista previa, envío de prueba a mí y **envío real a una sola
      familia** antes del masivo
- [x] Aviso en el panel de los **alumnos sin correo de tutor** (esos no reciben enlace)
- [x] Script de terminal `pnpm tokens:familias` (`--listar`, `--dias N`) para generarlos en masa
- [ ] **Generar los tokens de la campaña 2026/27 contra Neon** — pendiente de David: no se pudo
      hacer desde la sesión de desarrollo (sin `DATABASE_URL`). Es `pnpm db:push` (columnas
      nuevas) y luego el botón "Generar los enlaces que falten" o `pnpm tokens:familias`
- [ ] Envío real de estreno (probar con una familia y luego el masivo por cursos)

> Ojo: los enlaces son **credenciales**. El CSV de `/gestion/licencias/accesos` da acceso a los
> pedidos de cada familia: se usa y se borra, no se sube a Drive ni se comparte.

## Fase 3 · Códigos de activación + seguimiento

- [ ] Pegar/subir códigos de activación y casarlos con las líneas de pedido
- [ ] Estado por línea (pendiente / enviado / error)

## Fase 4 · Enganche a la BBDD central Educamos (= hito 3 del roadmap)

- [ ] Poblar `lic_students` de cada campaña desde `edu_students` (ver
      `docs/02-integracion-educamos.md`; el import Excel queda como fallback documentado)
- [ ] Login del panel con el auth central, retirar `licencias-auth.ts` (ver `docs/01-auth-roles.md`)
- [ ] (Futuro) cobro/envío nativo desde la plataforma

---

### Retoques 4 (PDC por letra + 5PRI)

- [x] **PDC desde `letra='PDC'`**: helper `cursoEfectivo(base, letra, seleccionado)` en `licencias.ts`.
      Catálogo y pedido fuerzan el curso PDC si el alumno es PDC (aunque pulse otro botón);
      el dashboard agrupa a los PDC por su letra. Verificado: 4ESO 49 + 4PDC 12.
      Indicador "Programa PDC" en el formulario. (3PDC=0: los futuros 3PDC aún no están marcados.)
- [x] **5PRI desactivado** (5º EP no entra este curso): `active=false` para los 50 alumnos de 5PRI.
      Total alumnos: 323 → **273**.

## Inputs pendientes de David

- **Aplicar el schema y generar los enlaces** de la campaña en vigor: `pnpm db:push` +
  `pnpm tokens:familias` (o el botón de `/gestion/licencias/accesos`). Ver Fase 2b.
- Reglas de packs/itinerarios por curso (cuáles y en qué modo) — configurable también en el panel.
- ~~Credenciales de cuenta de servicio de Google~~ ✅ hecha (jul 2026).
- Confirmar dominio/remitente verificado en Resend para `licencias@consolacionburriana.com` —
  pendiente, faltan cosas del dominio.
