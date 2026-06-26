# Licencias V2 · plan y checklist

Migración del Google Apps Script de gestión de licencias (repo `licenciasv1`) a un módulo
`licencias` dentro de **conso-tools** (Next 16 · Drizzle/Neon · Resend · PWA).

> **Cómo usar este documento:** cada fase tiene una checklist. Marca `[x]` lo que demos
> por bueno y dime "arranca Fase N" para empezar la siguiente. Las decisiones de arriba
> están cerradas; si alguna cambia, se actualiza aquí.

---

## Decisiones cerradas

- **Neon = fuente de verdad.** El Excel/Google Sheet pasa a ser solo destino de exportación.
- **Catálogo y formulario derivan de `BBDD Libros`** (filtro `banco_libros`). Cambias la BBDD
  y el formulario va solo. Confirmado con los 2 Google Forms reales.
- **Regla Banco de Libros:** alumno BdL paga solo los libros fuera del banco (Inglés, Francés
  optativa, Digitalización 4ESO); no-BdL paga todo. Bilingüe CAS/VAL se resuelve por `Lengua Base`.
- **Identificación de familia:** botones de curso + año de nacimiento + teclear apellidos →
  match contra la BBDD mostrando el nombre enmascarado a 3 letras ("David → Dav.").
  Validado: 95,5 % únicos solo con curso+año+apellidos.
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

- [x] Identificación: curso (botones) + año + apellidos → match con nombre enmascarado
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

## Fase 2 · Panel de gestión + export a Google Sheets

- [ ] Login y layout del panel
- [ ] Dashboard: % enviados, quién falta, totales por curso/editorial, ingresos
- [ ] Editor de packs/itinerarios por curso
- [ ] Export a Google Sheet → hojas `ENVIAR` (SI/NO BdL + GRATIS) en formato FormMule
  - [ ] Credenciales: cuenta de servicio de Google con acceso a la hoja
- [ ] (Después) XLS Educamos por curso · informe pagos consolidado · pagos por libro

## Fase 3 · Códigos de activación + seguimiento

- [ ] Pegar/subir códigos de activación y casarlos con las líneas de pedido
- [ ] Estado por línea (pendiente / enviado / error)

## Fase 4 · Educamos API

- [ ] Sustituir el proveedor de alumnos (import BBDD → sync Educamos)
- [ ] (Futuro) cobro/envío nativo desde la plataforma

---

## Inputs pendientes de David

- Reglas de packs/itinerarios por curso (cuáles y en qué modo) — configurable también en el panel.
- Credenciales de cuenta de servicio de Google para escribir en la hoja (Fase 2).
- Confirmar dominio/remitente verificado en Resend para `licencias@consolacionburriana.com`.
