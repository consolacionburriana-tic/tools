# Implementation Plans

Generados por la skill `/improve` (+ `/improve-ui` + `/improve-animations`) el
2026-08-05 sobre el commit `fd75980`. Auditoría completa (9 categorías) con subagentes
de corrección/seguridad*, rendimiento/dependencias, tests/deuda/DX, dirección/docs, UI
y animaciones; todos los hallazgos convertidos en plan fueron re-verificados a mano
contra el código antes de escribirse.

*La pasada de corrección/seguridad y la de animaciones se completaron en el hilo
principal (los subagentes murieron por límite de cuota); cubrieron guards de auth de
toda la superficie `/api`, revalidación de flujos públicos, tokens, blob y motion. No
se auditó en profundidad: componentes de gestión internos uno a uno (más allá de los
citados) ni el detalle visual de cada panel de `/gestion`.

Ejecutar en el orden de la tabla salvo que las dependencias digan otra cosa. Cada
executor: lee el plan entero antes de empezar, respeta sus STOP conditions y actualiza
su fila al terminar.

## Execution order & status

| Plan | Título | Priority | Effort | Depends on | Status |
|------|--------|----------|--------|------------|--------|
| [001](001-guard-api-reports-id.md) | Guard de auth en `/api/reports/[id]` (hoy público: PII de menores + delete anónimo) | P1 | S | — | DONE |
| [002](002-licencias-orders-revalidation.md) | IDOR en `/api/licencias/orders`: revalidar identificador familiar | P1 | M | — | DONE |
| [003](003-dependency-security-hygiene.md) | Bumps de seguridad (next ≥16.2.11, next-auth beta.32) + shadcn a devDeps + borrar backups/ | P1 | S | — | DONE* |
| [009](009-docs-reconciliation.md) | Docs veraces + retirar credencial en claro de docs/11 + .env.local.example completo | P1 | S | — | DONE |
| [004](004-test-baseline-vitest.md) | Baseline vitest + typecheck + tests de dinero/identificación/catálogo | P1 | M | — | DONE |
| [005](005-educamos-characterization-tests.md) | Caracterización del motor Educamos (parse/match/plan) | P2 | M | 004 | DONE |
| [006](006-neon-batching.md) | db.batch en syncs de licencias, bulk bancolibros, Promise.all en lecturas | P2 | M | 004 (recomendado) | DONE |
| [007](007-frontend-asset-perf.md) | recharts con dynamic import + logo por next/image | P2 | S | — | DONE |
| [008](008-public-ui-motion-consistency.md) | Coherencia UI/motion pública: tipografía, curso dinámico, stepAnim, reduced-motion, haptics | P2 | M | — | DONE |
| [010](010-salidas-magic-link.md) | Estrenar magic link de familias en Salidas (`?t=` + `{enlace}` en recordatorio) | P2 | S | — | DONE* |
| [012](012-pwa-fase-1.md) | PWA Fase 1: manifest de gestión + marca azul (priorizada por David) | P2 | S | — | DONE* |
| [011](011-email-blast-consolidation.md) | Motor único de correo masivo (portar Salidas a sendChunks) | P3 | M | mejor tras 010 | DONE* |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (con motivo) | REJECTED (con motivo)

\* 003: bumps + build + `pnpm audit --prod` + redirect anónimo + generación real de la
URL de OAuth de Google verificados. Falta que David complete UN login real con cuenta
`@consolacionburriana.com` (no hay credenciales de esa cuenta disponibles para probarlo
de forma automática).

\* 010: cadena de generación de enlaces (getFamiliasDeAlumnos -> ensureTokens ->
urlAccesoFamilia) verificada de punta a punta en rama Neon desechable con datos reales
(29/29 pendientes de una salida real resolvieron a un enlace válido); comportamiento de
`?t=` verificado en navegador (token inválido -> banner + fallback correcto, sin token
-> formulario normal). Falta que David envíe UN recordatorio de prueba real desde el
panel a su propio correo para ver el `{enlace}` renderizado en Resend — no hay una
salida con pendientes reales sobre la que probar un envío sin arriesgar mandar correo a
familias reales.

\* 012: `start_url`, `scope` y colores de marca verificados (manifest servido correcto,
redirect a login sin bucle, `theme-color` azul en el DOM). El sub-ítem de iconos
maskable queda `[~]` en `05-pwa.md`: los ficheros actuales son placeholders genéricos
(no el logo del colegio) sin margen de seguridad — hace falta que David aporte un asset
cuadrado del emblema para regenerarlos bien; `public/logobur.png` es un lockup
horizontal, no sirve tal cual.

\* 011: primitivos extraídos a src/lib/correos.ts (licencias-email.ts ahora solo
reexporta, cero duplicados) y sendRecordatorioPago portado a sendChunks — de paso pasa
de un único envío con `to` a todos los tutores (se veían el correo entre ellos) a un
envío por tutor, y el cuerpo ya no necesita `<a href>` manual: wrapHtml() auto-enlaza
`{enlace}` igual que cualquier URL. 10 tests nuevos sobre applyVars/escapar/enlazarUrls/
wrapHtml (83/83 en total). No comprobado: no había ninguna salida real con
recordatorios en vuelo esta semana (solo dos salidas "Pruebecita" de prueba), así que no
se disparó un envío real; falta que David haga un envío de PRUEBA real desde el panel
para ver el resultado en un cliente de correo de verdad.

## Dependency notes

- **005 y cualquier refactor requieren 004** (sin runner no hay red de seguridad; 006 puede ir sin él pero con la prueba manual obligatoria de su Step 5).
- **011 después de 010**: tocan los mismos ficheros de salidas-email; 010 añade `{enlace}` que 011 debe conservar. Y 011 solo entre campañas (correo real).
- 001, 002 y 003 son independientes entre sí; los tres son P1 de seguridad — primero 001 (4 líneas), luego 002, luego 003 (necesita smoke test de login).
- 008 Step 2 (portada server-wrapper) y 007 Step 3 (next/image en portada) tocan `src/app/page.tsx`: ejecutarlos en serie, no en paralelo.

## Findings considered and rejected (para no re-auditar)

- **Índice en `lic_order_items.order_id`**: seq scan sobre miles de filas es más rápido que el índice a esta escala. Reevaluar si la campaña crece 10x.
- **Filtros repetidos en el informe ABC** (~190k comparaciones en useMemo): <1ms; sería un cambio de legibilidad, no de rendimiento.
- **`rows.find()` O(n·m) en el sync de Educamos**: dominado 1000x por las rondas HTTP (plan 006); no compensa por sí solo.
- **`/api/reports?all=true` sin paginar**: ~1500 filas hoy; deliberado para el informe.
- **`xlsx@0.18.5` con 2 advisories sin parche en npm**: riesgo aceptado (solo parsea ficheros subidos por admins autenticados); decisión registrada en el plan 003. Migrar solo si algún día parsea entrada no-admin.
- **`googleapis` → `@googleapis/sheets`**: mejora real de install/cold-start pero un solo fichero la usa y sin tests del sync es más riesgo que valor hoy. Backlog.
- **Duplicación de identificación de familias**: FALSO — Salidas y Licencias comparten `identifyFamily()` correctamente; es el modelo a imitar.
- **`teachers` vs `edu_teachers` (dos catálogos de profesorado)**: real, pero la migración exige decisión de David (schema aditivo, datos históricos del ABC). → Decisión pendiente, no plan.
- **Unificar el patrón preview→apply de los 3-4 syncs**: duplicación cierta, abstracción dudosa; investigar tras 004+005. No plan todavía.
- **Split de `licencias-server.ts` (1103 líneas) y god-components (registros ABC 967, licencias-form 664)**: vale la pena, pero solo con 004 en verde; siguiente ronda.
- **Acento teal del módulo ABC vs azul de marca**: deliberado (identidad por módulo, consistente en todo el ABC). No es hallazgo.
- **Timing de comparación de tokens**: lookup por igualdad en Postgres sobre tokens de ~118 bits; ataque de timing impracticable. No es hallazgo.
- **Entrada manual de justificantes sin identificación**: decisión de producto documentada (commit c13ff49, "entrada manual de respaldo", queda marcada para revisión en el panel).
- **Logging estructurado con requestId (DX-04)** y **ESLint type-aware/prettier (DX-02 parcial)**: valiosos pero por debajo del corte de esta ronda. Backlog.

## ✅ Feedback instantáneo (percepción de lentitud) — resuelto 2026-08-06

David reportaba que al pulsar algo la app tardaba en responder y eso invitaba a
repetir el clic. La auditoría descartó que fuera latencia de servidor (los paneles ya
paralelizan sus queries, y el plan 006 se llevó las rondas HTTP de más): **la causa era
que no había NINGÚN `loading.tsx` en toda la app**. Con todas las páginas de `/gestion`
y las públicas en `force-dynamic`, al pulsar un enlace Next hacía el viaje al servidor y
la pantalla se quedaba congelada en la página anterior, sin una sola señal de vida. En
iPad, además, no hay `:hover`, así que tocar una tarjeta no producía ningún cambio
visual.

Resuelto en tres capas (ver commit "perf(ux): feedback instantáneo…"):
1. **Esqueletos de carga** (`loading.tsx` en las 11 rutas dinámicas + primitivos en
   `src/components/ui/skeleton.tsx`): al pulsar, la pantalla cambia YA.
2. **Respuesta al toque** (`globals.css`): `active:scale(0.97)` sin transición
   (instantáneo, como iOS) + `touch-action: manipulation`, que además quita el retardo
   del doble-toque de Safari. Antes solo había 6 `active:` en todo el repo.
3. **Qué se está cargando**: `useLinkStatus` (`src/components/ui/nav-pending.tsx`) en
   las tarjetas del escritorio, el índice de licencias, el listado de salidas y la nav
   del ABC, para saber *cuál* de los enlaces respondió al toque.

Extra: en los formularios públicos el "Buscando…" no aparecía hasta vencer el debounce
de 350ms; ahora es estado derivado y se enciende en el mismo golpe de tecla.

Queda fuera y sigue pendiente si algún día molesta: no hay barra de progreso global de
navegación (no existe API de eventos de router en App Router; los esqueletos cubren el
caso), ni optimistic UI nuevo en paneles (bancolibros ya lo hacía bien y es el modelo).

## Pendientes de decisión de David (no planificables aún)

- **Portada**: los dos CTAs ("Solicitar licencias" y "¿He hecho mi pedido?") llevan al mismo `/licencias`; un flujo real de consulta de pedido podría apoyarse en la revalidación del plan 002. ¿Se quiere?
- **Rotación**: confirmar que la contraseña retirada de `docs/11` (plan 009) no se reutiliza en otros sistemas del colegio.
- **Plantillas de correo module-agnostic** (hoy `lic_email_templates` es solo de licencias): decidir si Salidas/Evaluaciones las comparten (afecta schema).
- **`teachers` legacy → `edu_teachers`**: forma de la migración (FK nueva + dual-read propuesto en el hallazgo DEBT-05).
- **Evaluaciones (hito 6)**: ¿empezar ya (autocontenida) o después de cosechar 010/011 para construirla sobre los primitivos compartidos?
