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
- **Ciclo completo de la campaña** (Fase 3): informe a editoriales de las licencias de pago
  **y** de las gratis del banco de libros, seguimiento 🧾/📤/💰 por pedido, cobro con el CSV de
  Educamos, y un **esquema del proceso** en `/gestion/licencias/proceso` para el equipo.
- **Magic links de familias** (Fase 2b): enlaces personales por familia (`/licencias?t=tok_…`)
  y correo masivo por cursos y clases con esos enlaces. Queda generar los de la campaña real
  en Neon (ver "Inputs pendientes de David").
- **Envío de las licencias** (Fase 5, sep-2026): los códigos que manda la editorial se pegan en
  `/gestion/licencias/envios`, se reparten en orden entre los alumnos, lo que sobra queda en el
  almacén y sale un correo por licencia, marcada una a una. Sustituye al FormMule.

Pendiente **solo por credenciales/accesos externos** (no por código):
- Escritura directa en el Google Sheet → cuenta de servicio ✅ creada (jul 2026); queda
  verificar la escritura de punta a punta y marcar la casilla de Fase 2.
- Sincronización con la **API de Educamos** → necesita acceso (hoy: import desde Excel).
- `licencias-envios.sql` **sin aplicar en Neon**: la Fase 5 no funciona hasta que se aplique
  (`pnpm db:sql --pendientes`).

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
- **Correo pre-rellenado en el formulario público (2026-09-02):** la familia ya no teclea su
  correo. Al identificarse le sale el que tenemos, **enmascarado** (`da•••@gmail.com`), con un
  "Usar otro correo" si quiere cambiarlo. De dónde sale, por orden: el del **pedido anterior**
  si ya hizo uno · el del **token** (magic link), que es la dirección a la que se envió ese
  enlace · el del **tutor cuyo documento se ha tecleado** (`email`, con `email_google` de
  respaldo) · si no, el del **tutor 1** de sus hijos.
  - **La dirección completa NUNCA viaja al navegador** en el flujo público: la respuesta de
    `/api/licencias/identify` y del GET de `orders` solo lleva la máscara (`maskEmail`), y al
    guardar el pedido el cliente manda `mantenerCorreo: true` para que **el servidor** resuelva
    el valor real. Motivo: quien teclea un DNI no ha probado ser de esa familia, así que la
    pantalla no puede servir de oráculo para sacar correos ajenos. Esto además cierra una fuga
    que ya existía: el GET de `orders` devolvía en claro el correo del pedido anterior.
  - En el panel de gestión (detrás del login) los correos se siguen viendo completos, que es
    para lo que está.
  - Pendiente de valorar si conviene filtrar por `edu_student_guardians.recibe_informacion` /
    `guarda_custodia` al elegir el correo del tutor 1; hoy no se filtra porque la calidad de
    esos dos campos en el export de Educamos está sin comprobar.
- **Correos a familias (2026-07-30):** el envío masivo tiene dos modos — *familias* (al correo
  del tutor de la BBDD central, con su enlace: uno por familia) y el clásico *alumnos* (al
  correo del alumno). En modo familias se filtra por **cursos y clases**, con casilla "solo
  familias con algún hijo sin pedido", y el correo lleva **nombre de pila + curso de los hijos**
  (`{hijos}`): va a la dirección de sus propios tutores, así que ahí no se enmascara — el
  enmascarado ("Fra. M. Luc.") sigue siendo obligatorio en las **pantallas** públicas.
- **Packs/itinerarios:** configurables en el dashboard, solo ayuda visual (modo por pack:
  `todos` · `elige uno` · `elige uno o ninguno` · `libre`). No bloquean.
- **Envío de licencias (REEMPLAZADO en la Fase 5, sep-2026):** lo hace la app en
  `/gestion/licencias/envios` — se pegan los códigos, se reparten en orden y sale un correo por
  licencia. Antes: la app exportaba a las hojas `ENVIAR` del Google Sheet y FormMule ("Plantilla
  NEW") mandaba los correos. Los CSV de `/exportar` **siguen estando** como salvavidas.
- **Educamos:** importar la BBDD ahora, dejar capa "proveedor de alumnos" lista para enganchar
  su API después (el `ID Educamos` ya viaja en los datos). XLS Educamos = un fichero por curso,
  col E = `ID Educamos`, col F = importe (coma decimal). Para fase posterior.
- **Login gestores (histórico):** login propio por cookie, retirado en el hito 2 — ver
  `01-auth-roles.md`. La credencial que figuraba aquí se considera quemada (queda en el
  historial de git): no reutilizarla en ningún sistema.
- **Resend remitente:** `licencias@consolacionburriana.com`.
- **Dónde vive:** repo `tools`. Form público en `app/(public)/licencias`, panel en `src/app/gestion/licencias/`.

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

- [x] Login simple por cookie (retirado en el hito 2 — ver `01-auth-roles.md`)
- [x] Panel en `/gestion` (fuera del layout de `/admin` para no exponer las rutas del ABC)
- [x] Dashboard: KPIs (alumnos, con pedido, % , faltan, ingresos, licencias) + desglose por curso
- [x] Indicadores en el formulario: banco de libros destacado, idioma de clase (Cast/Val) y badge "Valencià" en libros
- [x] Desglose por curso con PDC separados (por curso efectivo del pedido)
- [x] Subpanel de gestión económica (`/gestion/economia`) con los ingresos (fuera del dashboard)
- [x] Login rediseñado con logo
- [x] Listado de "quién falta" (alumnos sin pedido) — `/gestion/faltan`, filtro por curso + CSV
- [x] **Un solo criterio de "falta"**: los correos masivos (modo alumnos "quienes faltan" y modo
      familias "solo con algún hijo pendiente") excluyen a los marcados a mano como que no harán
      pedido, igual que la pantalla de Quién falta. Antes salían 60 destinatarios donde la
      pantalla mostraba 16. El botón "Todas" de cursos y clases ahora marca de verdad las clases
      (y "Quitar selección" las desmarca) en vez de solo limpiar la selección.
- [x] El KPI **"Faltan"** del panel (y la columna por curso) cuenta también pendientes de verdad,
      con "No pedirán" aparte, así que panel, Quién falta y correos dicen el mismo número
- [x] "Quién falta": orden natural (etapa → curso → letra A/B) y **todas las cabeceras ordenables**
      (curso, clase, apellidos, nombre, NIA, correo, estado), filtro por clase además de por curso,
      y **selección por casillas** (individual o todos los visibles) para marcar en bloque a quienes
      **NO van a hacer el pedido** — endpoint `POST /api/licencias/admin/students/complete` (una
      sola consulta para todos los ids)
- [x] Editor de packs/itinerarios por curso — `/gestion/packs`: crea packs (nombre, modo
      `todos`/`elige uno`/`elige uno o ninguno`/`libre`, libros). El formulario agrupa el
      catálogo por pack con su pista (display, no bloqueante). Casado por código base (CAS/VAL).
- [x] Exportaciones CSV — `/gestion/exportar`: ENVIAR SI/NO (FormMule) + GRATIS BdL,
      pagos consolidado, Educamos (ID+importe), pagos por libro. Descargas protegidas por cookie.
  - [~] Escritura directa en el Google Sheet — código listo (`src/lib/google-sheets.ts`,
        `syncOrdersToSheet`); pendiente de verificar la escritura de punta a punta con la
        cuenta de servicio real
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
- [~] **Generar los tokens de la campaña 2026/27 contra Neon** — código listo
      (`pnpm tokens:familias` / botón "Generar los enlaces que falten"); es una escritura real
      sobre la campaña activa, pendiente de que David dé el visto bueno para ejecutarla
- [ ] Envío real de estreno (probar con una familia y luego el masivo por cursos)

> Ojo: los enlaces son **credenciales**. El CSV de `/gestion/licencias/accesos` da acceso a los
> pedidos de cada familia: se usa y se borra, no se sube a Drive ni se comparte.

## Fase 3 · Pedido a editoriales, seguimiento y códigos de activación

El ciclo de vida de un pedido vive en tres sellos de `lic_orders`, que son las columnas
Q🧾/R📤/S💰 del Google Sheet histórico traídas a la app:

| Sello | Columna | Qué significa | Quién lo pone |
|---|---|---|---|
| 🧾 | `editorial_processed_at` | pedido a la editorial | «Descargar informe y marcar» de `/gestion/licencias/editoriales` |
| 📤 | `sent_to_template_at` | pasado a plantillas de envío (la familia ya tiene su código) | «Marcar pasados a plantillas» |
| 💰 | `paid_at` | pagado | a mano, pedido a pedido, en `/gestion/licencias/pedidos` |

- [x] Informe de editoriales de las licencias **de pago**, agrupado por editorial/libro, que
      marca 🧾 al descargarlo. **Incremental**: solo salen los pedidos aún sin pedir.
- [x] Informe de editoriales de las licencias **gratis del banco de libros** (2026-09-16)
- [x] Seguimiento por pedido (🧾/📤/💰) visible en la lista y en la ficha de cada pedido
- [x] Pegar/subir códigos de activación y casarlos con las líneas de pedido → **Fase 5**
- [x] Estado por línea (pendiente / enviado / error) → **Fase 5** (`lic_licencias`)

### Las gratis del banco de libros no estaban en el informe (2026-09-16)

**El fallo:** `getEditorialReport()` cuenta `lic_order_items`, o sea **solo lo que la familia
pide y paga**. Las licencias del banco de libros no nacen de un pedido — un alumno del banco
las tiene aunque no entre nunca en el formulario — así que **no salían en el informe y no se
le pedían a la editorial**. El CSV «ENVIAR · GRATIS» de `/exportar` sí las listaba, pero ese
fichero es para *mandárselas a las familias*, no para *pedírselas a la editorial*: quien
mirara solo la pantalla de Editoriales pedía de menos.

**Son dos pedidos independientes** (David, 2026-09-16): las de pago y las del banco se piden
por vías distintas —dos informes, dos envíos, dos facturas— y **no se suman nunca**. Un primer
intento puso encima una tabla de "total por editorial" que las sumaba; se quitó, porque ese
número no se le manda a nadie.

**Cómo queda**, con los dos informes separados a propósito porque funcionan distinto:

- **De pago** → incremental. Al descargarlo marca 🧾 y esos pedidos ya no vuelven a salir; si
  luego llegan pedidos nuevos, el siguiente informe trae solo esos.
- **Del banco** → **censo completo**, siempre entero: es `alumnos BdL × libros del banco de su
  curso` (resuelto por idioma), no hay "pendiente" que descontar. Por eso no marca nada en los
  pedidos; solo guarda en la campaña **cuándo se descargó** (`lic_campaigns.banco_report_at`) y
  la pantalla avisa al repetirlo, que es lo que evita pedir dos veces lo mismo. Si entra
  alumnado nuevo del banco a mitad de curso, se pide a la editorial solo la diferencia.
**Fuente única del banco** (`getBancoLibrosCenso()` en `licencias-exports.ts`): la comparten el
CSV «ENVIAR · GRATIS» y este informe. Si se calcularan por separado, los dos números acabarían
divergiendo y nadie se enteraría hasta que la editorial mandara de menos. Comprobado contra
producción el 16-sep-2026: los dos dan **1.603**.

### Tres fallos que encontró la comprobación contra Neon (2026-09-16)

Los tres inflaban o desviaban el pedido a la editorial. Los dos primeros venían de antes.

1. **Un código de libro no identifica un libro.** La unicidad de `lic_books` es `(curso, cod)`
   —está escrito en la nota de modelado de la Fase 0— pero los informes agrupaban por `cod`
   suelto. `3ESO-REL` existe en 3ESO y en 3PDC: salía **una** fila de 57 licencias, etiquetada
   con el curso del último que entrara en el mapa (3PDC), en vez de 46 de 3ESO y 11 de 3PDC.
   Arreglado con `indexarLibros()`/`claveLibro()` (`licencias-exports.ts`, con tests) en el
   informe de editoriales, el del banco, `getPagosPorLibro` y `getEnviarRows`.
2. **El censo contaba libros desactivados.** `getBancoLibrosCenso` filtraba por `banco_libros`
   pero no por `active`. Se colaban 5 libros retirados del Excel (Mates A/B y Valores de 4ESO,
   Tecnología de 3ESO en sus dos idiomas): **135 licencias de más**, 1.738 en vez de 1.603.
   Un libro se desactiva en vez de borrarse para no romper los pedidos que lo referencian, pero
   pedirlo a la editorial es tirar el dinero.
3. **Todo se pedía en castellano.** Ver el apartado siguiente: eran dos fallos encadenados.

### Los pedidos, en Google Sheets por editorial (2026-09-16)

David: «los gratuitos por un lado y los de pago por otro, de manera que por editorial haya dos
Google Sheets». Tres botones en `/gestion/licencias/editoriales`, que se dan por separado a
propósito — se puede generar, ir a Drive a mirar cómo ha quedado, y solo entonces confirmar:

1. **Generar los pedidos** → un Sheet por editorial y tipo en la carpeta «# Licencias 2026 -
   SALIDA», con las columnas de la plantilla del colegio (`COD · Editorial · ISBN · UDs · Curso ·
   Asignatura · Proyecto - Nombre Libro · Banco Libros · Precio · Fecha informe editorial`) y
   una fila de totales. Solo se genera el fichero que tenga datos: Cambridge no tiene banco y
   Bromera casi no tiene pago.
2. **Pasar a PDF** → el PDF se deja al lado de su Sheet, en la misma carpeta.
3. **Marcar como pedidos** → pone el 🧾 a los pedidos que entraron en esos ficheros.

**Por qué una tabla (`lic_pedidos_editorial`) y no marcar directamente:** entre generar y
confirmar puede entrar un pedido nuevo, y ese no iba en el Sheet que se mandó a la editorial.
`tirada_id` agrupa los ficheros de una pulsación y guarda sus `order_ids`, así que el paso 3
marca **lo que se generó**, no lo que hubiera pendiente en ese momento. El pedido que llegue
entre medias sale en la tirada siguiente, que es lo correcto.

Detalles que costaron ratos y conviene no volver a pensar:

- **Se parte de la plantilla del colegio** («# Plantilla Pedido Licencias»): se copia el Google
  Sheet con `files.copy` y se escriben los datos dentro con la API de Sheets. El primer intento
  generaba el fichero desde cero con `xlsx-escribir.ts` y **estuvo mal**: perdía el formato real
  (PT Sans 11, la cabecera con fondo, los anchos por columna, el congelado, el autofiltro, el
  amarillo de la columna A y los formatos de número) y encima añadía un total de importe que la
  plantilla no lleva. Copiando, el pedido sale con el formato de siempre y, si algún día se
  retoca la plantilla, los pedidos salen retocados sin tocar código.
- **El formato de las filas se arrastra desde la fila 2** de la plantilla con un copiar/pegar de
  solo formato, en vez de darlo celda a celda: manda la plantilla. Antes hay que ampliar la
  cuadrícula (la plantilla trae 15 filas y el pedido del banco de Anaya tiene 27 libros) y
  **vaciar lo que haya bajo la cabecera**, porque la plantilla arrastra restos de ejemplo (un
  `FALSE` suelto en la última fila) que si no se quedan colgando al final del pedido.
- **El total es solo de unidades** (`=SUM(D2:Dn)`), como la plantilla del colegio. No lleva
  total de importe.
- **Reintentos también en las llamadas de Sheets**: generando ocho pedidos seguidos, Sheets
  contesta **403 «User rate limit exceeded»** —no 429— y el último de la tanda se quedaba sin
  generar (le pasó a SM). El `conReintentos` de Drive no cubría estas llamadas.
- La columna «Fecha informe editorial» lleva el sello con la pinta del script viejo del Excel
  (`✅ 26-09-16 13:16`), como texto: escrito como fecha, Sheets lo convertía y se veía
  `2026-09-16 00:00:00`.
- **El ISBN va como texto**: en número, Sheets redondea los 13 dígitos a notación científica y
  se pierde el último. En el pedido de agosto de 2025 se ve el estropicio.
- **Reutiliza el motor de Drive del cuaderno** (`src/lib/cuaderno/drive.ts`): subida con
  conversión, exportación a PDF, reintentos con espera y la comprobación de que la carpeta está
  en una unidad compartida y se puede escribir. Ahí está también el aprendizaje de por qué no
  vale «Mi unidad» (la cuenta de servicio no tiene cuota propia).
- **Los CSV siguen estando**, en un `<details>` de «Otras opciones» al final de la pantalla, por
  decisión expresa de David: si algún día Drive falla, el fichero suelto sigue saliendo.

Probado de punta a punta contra la carpeta real el 16-sep-2026: 8 Sheets y 8 PDF (5 de pago,
3 del banco), con los ISBN enteros y los totales cuadrando.

### Idioma por clase (2026-09-16)

La línea lingüística **es de la clase, no del alumno**, y cambia cada curso: este año 1º y 2º de
ESO tienen la A en castellano y la B en valencià, y 3º y 4º las dos en castellano (David). Se
pone en **`/gestion/licencias/lenguas`**, clase a clase, y se guarda en
`lic_students.lengua_base`, que es lo que ya leían el catálogo del formulario y los informes.

Se llegó aquí porque **toda la campaña se estaba pidiendo en castellano**, por dos fallos
encadenados que se tapaban el uno al otro:

- **El dato no estaba.** `lengua_base` salía del Sheet mientras el alumnado se importaba de ahí;
  al pasar la fuente a `edu_students` quedó colgando de `modelo_linguistico`, que está **NULL en
  los 643 alumnos activos** de la central. Y cada sync volvía a escribir ese NULL encima, así
  que ponerlo a mano tampoco habría durado: ahora el upsert **no toca `lengua_base` si la central
  no trae dato**, igual que ya se hacía con `educamos_id`.
- **Y aunque hubiera estado, no se habría usado.** `resolveBilingual` decidía con
  `startsWith('valen')`, pero lo que se guarda es el código **`VAL`** (lo que produce
  `MODELO_TO_LENGUA`, y ahora también esta pantalla). `'val'` no empieza por `'valen'`, así que
  daba castellano siempre. Los tests no lo pillaron porque solo probaban con la palabra escrita
  entera (`'Valencià'`), que sí colaba. Hoy la comparación es `startsWith('val')` —vía
  `esValenciano()`, con tests de las dos formas— y ninguna variante de castellano empieza así.

Comprobado en producción: 1ºESO pasó de **48 castellano / 0 valencià** a **24 y 24**.

La pantalla de Editoriales avisa si quedan clases sin idioma (`alumnosSinLengua`/`hayBilingues`),
porque sin poner equivale a castellano y eso no se distingue a simple vista de una decisión.

### Códigos repetidos en el Excel: el libro que desaparecía (2026-09-16)

David añadió al Excel el «Ámbito Lingüístico y Social II» de 4ºPDC, sincronizó, el panel dijo
que se había actualizado… y el libro **seguía sin salirle a su alumnado en el formulario**.

La causa: en `BBDD Libros` había **dos filas con el mismo curso y el mismo código**
(`4PDC` · `4ESO-PDC-LING`) — el Ámbito nuevo y la Religión de antes. Como la identidad de un
libro es `(curso, cod)`, el upsert procesa las dos y **la última gana**: quedaba la Religión y
el Ámbito no llegaba nunca a existir. El sync no mentía (sí había un cambio que aplicar), pero
tampoco contaba lo importante.

- **En el Excel**, la Religión de 4ºPDC necesita su propio código. Lo natural es `4ESO-REL`,
  que es justo lo que hace 3ºPDC: `3ESO-PDC-CIEN` + `3ESO-PDC-LING` + `3ESO-REL`.
- **En la app**, `getBooksSyncPlan` detecta ahora los códigos repetidos y la vista previa los
  enseña en rojo antes de aplicar («solo se guardará el último de cada uno»). Un dato que se
  pierde en silencio es peor que un error.

> Ojo con quién ve el libro: al alumnado **del banco** no se le ofrecen los libros del banco
> (los recibe gratis), así que este solo lo verían como marcable los de 4ºPDC que **no** están
> en el banco — que es el caso de Álex Peris.

### Retocar las unidades a mano (2026-09-16)

Las optativas fueron el motivo: el censo da a cada alumno del banco **todos** los libros del
banco de su curso, y en 4ºESO eso es pedir 45 de Latín *y* 45 de Economía *y* 45 de Biología *y*
45 de Física y Química, cuando cada alumno cursa solo algunas. La matrícula por materia no está
en `lic_students` ni en `edu_students`, así que no hay de dónde sacarla.

En vez de un apaño solo para las optativas, **las unidades se escriben a mano en las dos
tablas** (`lic_ajustes_pedido`): es «lo calculado dice X, pero pide Y», y vale para cualquier
fila. El número retocado se queda en ámbar con el calculado al lado, que es además el botón para
deshacer; borrar el retoque devuelve el cálculo. Los Google Sheets y los CSV salen con lo
retocado.

Se guarda por `(campaña, tipo, curso, cod)`, con `nota` y quién lo tocó, para que el año que
viene se entienda de dónde salía el número.

### Repaso del catálogo contra producción (2026-09-16)

Precios, ISBN y editoriales están completos y en rango en los 57 libros activos. Lo que sí
apareció, para mirarlo en el Excel `BBDD Libros`:

- **4ºPDC tiene dos libros del banco y 3ºPDC tres** → causa encontrada el 16-sep-2026, ver
  «Códigos repetidos» abajo.
- **13 pedidos confirmados sin ninguna licencia** (total 0 €), sobre todo de PDC y 6ºEP. Cuentan
  como «ya han pedido» en el panel y en Quién falta, así que nadie les reclama, pero no van a
  recibir nada. Puede ser correcto («no quiero licencias») o que la familia se atascara en el
  formulario; conviene mirarlo antes de dar la campaña por cerrada.
- El otro ISBN repetido (978-84-683-5778-2 en `3ESO-REL` de 3ºESO y de 3ºPDC) **es correcto**:
  es el mismo libro, porque en religión los de PDC se juntan con 3ºESO A.

> **CSV como salvavidas, a propósito** (David, 2026-09-16): todo lo que hace la app se puede
> seguir haciendo a mano en el Excel de siempre. Los CSV **no se retiran** aunque la escritura
> directa en el Sheet acabe verificada: son el mismo formato de las hojas del Sheet, así que
> siempre se puede pegar a mano si algo falla.

## Esquema del proceso (para el equipo)

`/gestion/licencias/proceso` — las **cinco fases** de una campaña (preparar · recoger · pedir a
editoriales · enviar · cobrar) con sus 19 pasos, cada uno diciendo en qué pantalla está, qué
botón se pulsa y con qué hay que tener ojo. Enlazado desde arriba del panel.

Nace de que el módulo tiene ya bastantes pantallas como para que quien no lo montó se pierda, y
de dos confusiones concretas y caras: creer que el informe de editoriales lo pide todo (ver
arriba), y no saber que «Exportar» y «Editoriales» sirven para cosas distintas. Cuando cambie un
flujo, se actualiza ahí: `src/components/licencias/proceso-esquema.tsx`, un array de fases.

## Fase 5 · Envío de las licencias a los alumnos (sep-2026)

La última pieza del ciclo: llegan los códigos de la editorial y hay que hacérselos llegar a cada
alumno. Sustituye al FormMule sobre las hojas `ENVIAR` del Google Sheet.

**Pantalla:** `/gestion/licencias/envios`.

### Decisiones cerradas

- **De pago y banco de libros, separados de arriba abajo** (dos pestañas, dos recuentos, dos
  plantillas de correo). Llegan en Excel distintos, de editoriales distintas, y no se suman
  nunca — el mismo principio que ya rige los pedidos de la Fase 3.
- **Una tabla nueva, `lic_licencias`, con una fila por licencia a entregar.** Es lo que obliga
  la realidad de los datos: las de pago son `lic_order_items`, pero **las del banco no existen
  en ninguna tabla** — son un censo (`alumno BdL × libros del banco de su curso`, resuelto por
  idioma) que se recalcula a demanda. Para poder pegarle un código a una licencia y marcarla
  enviada hace falta una fila en los dos casos, así que `sincronizarLicencias()` materializa el
  censo. Es idempotente y **nunca borra una fila con código o ya enviada**: si un alumno se va,
  su licencia se marca descartada.
- **Una fila sin alumno es un SOBRANTE.** «A veces nos pueden sobrar 10 licencias porque se
  equivocan los comerciales y yo las guardo porque a lo mejor las puedo asignar a alguien en
  otro momento» (David). Se guardan con su libro y su curso y se colocan después en cualquier
  alumno pendiente de ese mismo libro. Postgres no choca varios NULL en un índice único, así
  que conviven sin necesidad de otra tabla (mismo truco que `bl_libros_curso`).
- **Los sobrantes SÍ cruzan de pago a banco y al revés** (David, sep-2026): «sobre todo nos
  pasa que nos sobran gratuitas y se las asignamos a los de pago». Y es correcto: un libro del
  banco es gratis para el alumnado BdL y de pago para el que no lo es, pero **el código es el
  mismo producto** — lo que cambia es quién lo paga, que es cosa del pedido, no de la licencia.
  Por eso su pestaña es la única que ignora el filtro de pago/banco. Lo que no se cruza nunca es
  el **libro**: `puedeColocarse()` exige el mismo `(curso, cod)`, en la pantalla y en el
  servidor, porque un código de Religión en un hueco de Inglés no chirría hasta que el alumno
  intenta abrir el libro.
- **El emparejado es EN ORDEN, y el orden lo manda la pantalla.** El cliente envía las parejas
  ya hechas; el servidor no reordena. Si reordenara por su cuenta, lo que David aprueba en la
  vista previa y lo que se guarda podrían no ser lo mismo, y eso es mandarle a un alumno el
  código de otro.
- **Un correo por licencia por defecto**, con opción de fusionar en uno por alumno. Uno por
  licencia se busca mucho mejor después en el buzón; fusionar existe porque un alumno con 10
  licencias no necesita 10 correos (y porque baja mucho el consumo de cuota de Gmail).
- **El destinatario es el correo del alumno** (`edu_students.email_google`, su cuenta del
  colegio, la del iPad), que es a donde iban los envíos de siempre. Se puede cambiar a «correo
  de la familia» en la barra de la pantalla; la columna «Destino» enseña siempre la dirección
  exacta antes de mandar nada.
- **Las plantillas son las de siempre.** El texto del FormMule, con sus `<b>` tal cual: el
  cuerpo admite `<b>/<i>/<u>/<br>` y `**negrita**`, y escapa todo lo demás. Dos de fábrica
  (`Licencia Digital Adquirida` y `Licencia Gratuita Banco de Libros`) y las que se guarden en
  `lic_email_templates` con `contexto='licencias'`.
- **`{codigo}` no es texto, es una caja.** Donde se escriba sale el código en grande y
  monoespaciado; si la plantilla se queda sin él, se añade igual al final. Es el único dato que
  el alumno tiene que copiar a mano y en medio de un párrafo se pierde.
- **El sello 📤 lo pone el envío**, cuando todas las licencias de pago de un pedido están
  enviadas. Antes lo ponía a mano el botón «Marcar pasados a plantillas» de Editoriales.

### Las optativas, otra vez

El censo del banco le da a cada alumno **todos** los libros del banco de su curso, y en 4ºESO
eso no es verdad (Latín, Economía, Biología, Física y Química son de itinerario). Ya pasó con
las unidades del pedido y se resolvió con `lic_ajustes_pedido`; aquí reaparece como huecos de
alumnos que no cursan esa asignatura.

La matrícula por materia sigue sin estar en ninguna tabla, así que **lo decide quien pega**: en
el diálogo de pegado cada alumno tiene su casilla y se desmarca a quien no le toque, o se marca
el resto como **«no le toca»** (`descartado_at`) en la misma acción. Descartar no borra nada, se
deshace, y deja de contar como que falta — que es lo que hace que «faltan 25» signifique algo.

### El aviso que evita el error caro

Pegar una columna de códigos contra un filtro que mezcla **dos libros** reparte los códigos de
Inglés entre Inglés y Religión sin que nada chirríe: los dos son códigos válidos y los dos
alumnos existen. La pantalla lo detecta (`librosDistintos`) y pide una confirmación explícita.

Otras tres redes, por orden de cuándo saltan:

1. **Duplicados en el propio pegado** — casi siempre una selección de más en Excel; se avisa
   antes de guardar y no deja continuar.
2. **Código ya usado en la campaña** — se consulta antes de escribir y se dice a qué alumno le
   tocó, sin pisar nada.
3. **Índice único `(campaign_id, codigo)`** — el último cortafuegos, en la base de datos.

Y al escribir, cada hueco se rellena con `WHERE codigo IS NULL`: si entre la vista previa y el
guardado alguien asignó ese mismo hueco, se rechaza y se dice cuál, en vez de pisarlo.

### Los Excel de las editoriales: se leen solos

«Cada excel es de su padre y de su madre, no hay manera» — es verdad, pero los tres reales se
parecen en lo único que importa: hay **una** columna de códigos y el resto es relleno. Así que
no se reconoce a la editorial, se busca la columna (`elegirColumna`): gana la que más valores
con pinta de código tenga, descartando ISBN, y desempata la unicidad.

Probado contra los tres ficheros reales de 2026:

| Editorial | Forma del fichero | Resultado |
|---|---|---|
| SM | Cabecera en la fila 0, código en la col. B, ISBN en la E | 2 códigos ✓ |
| Cambridge | 11 filas de preámbulo, cabecera `ISBN \| Book \| Code`, ~790 filas vacías al final | 202 códigos ✓ (coincide con su propia cabecera «Number of licences: 202») |
| Anaya/Edebé (.xls) | Columna A vacía, cabecera en la fila 1, `Título \| Licencia \| ISBN` | 46 códigos ✓ |

El camino principal sigue siendo **copiar y pegar** (es más rápido y David ve lo que copia); lo
del fichero es un atajo con la misma vista previa, y se puede cambiar la columna a mano si
alguna editorial estrena formato.

### Límites de envío (Gmail vs Resend)

Va por **Gmail** (`EMAIL_TRANSPORTE` por defecto cuando hay cuenta de servicio), que es lo que
David prefiere porque los correos quedan en «Enviados» de `licencias@`. Sus topes, de Workspace
y por buzón suplantado:

- **~2.000 mensajes/día.** Con ~1.600 licencias del banco, mandarlas todas de una en un día se
  come la cuota y el resto del día no sale nada más de ese buzón. Fusionando por alumno bajan a
  ~300. La pantalla avisa al pasar de 1.200 correos en una tacada.
- **~250 unidades de cuota/segundo**, y `messages.send` cuesta 100 → ~2,5 correos/segundo.

De ahí que el envío vaya **en tandas de 80 desde el navegador** con barra de progreso, y no en
una sola llamada: 80 correos son ~32 s, dentro del `maxDuration` de 60 de la función. Las tandas
son cosa del límite por segundo, no un tope de cuántas se pueden mandar; para eso está el
**tope** del panel de confirmación, que corta la tacada donde se le diga (y fusionando corta por
alumno, para no partir a nadie en dos correos). Resend mandaría 100 por llamada (mucho más
rápido para el masivo del banco), pero no deja rastro en el buzón: si algún día el masivo se
hace insufrible, se cambia con `EMAIL_TRANSPORTE_LICENCIAS=resend` sin tocar código.

### Cerrar la pestaña a media tanda no rompe nada

La invariante que lo sostiene está en un orden de tres líneas de `enviar/route.ts`: se manda el
correo, **se espera a que Gmail lo acepte, y solo entonces** se marca la licencia. Así es
imposible que algo quede marcado como enviado sin haber salido, se corte por donde se corte. El
único riesgo es el contrario —correo entregado que no llega a marcarse, y se reenvía al
repetir—, que es el lado bueno por el que fallar. Mientras hay un envío en marcha el navegador
pregunta antes de cerrar.

Lo que sí se quedaba a medias era el **sello 📤 del pedido**, que se calculaba con la lista de
alumnos de aquella petición: si esta no terminaba, el sello no se ponía nunca. Ahora
`sellarPedidosCompletos()` lo recalcula **desde el estado** y lo repasa entero en cada
sincronización, así que se arregla solo al volver a entrar a la pantalla.

### El aviso antes de mandar

No es un `confirm()` del navegador, es un panel dentro del diálogo, porque lo que hay que leer
son cuatro números y un `alert` no los enseña bien. Dice, siempre dentro de la pestaña en la que
se está: cuántas licencias hay **a la vista** con el filtro de ahora, cuántas de ellas están
**listas**, cuántas se han elegido —avisando cuando no se ha marcado ninguna fila y por tanto
van todas las listas de la vista— y cuántos **correos** van a salir de verdad. Debajo, el tope.

### Checklist

- [x] Esquema `lic_licencias` + `lic_envios` + `contexto`/`clave` en `lic_email_templates`
      (`src/db/sql/licencias-envios.sql`, aditivo e idempotente)
- [x] Materializar: `sincronizarLicencias()` (líneas de pedido + censo del banco), idempotente,
      con descarte automático de lo que se cae del censo y recuperación si vuelve
- [x] Pantalla «tipo Excel» con filtros (curso, clase, libro, editorial, estado, búsqueda),
      todas las cabeceras ordenables y recuentos útiles (faltan / listas / enviadas / %)
- [x] Pegar códigos: análisis del pegado, selector de columna, vista previa alumno ← código,
      aviso de mezcla de libros, duplicados y códigos ya usados
- [x] Lectura del Excel de la editorial con detección automática de la columna (verificada
      contra los ficheros reales de SM, Cambridge y Anaya)
- [x] Sobrantes: almacén por libro, colocar en un alumno pendiente (atómico, en `db.batch`) y
      borrar; se cruzan de pago a banco y al revés, pero nunca de libro (`puedeColocarse`)
- [x] Aviso de confirmación con los números del filtro y tope ajustable de la tacada
- [x] Cerrar la pestaña no marca como enviado nada que no haya salido; el sello 📤 se repasa
      solo en cada sincronización
- [x] Descartar / deshacer («no le toca»), y quitar un código mal pegado
- [x] Correo de entrega: dos plantillas de fábrica, variables, `{codigo}` en caja, vista previa,
      envío de prueba y guardado de plantillas propias
- [x] Envío por tandas con progreso, marcado **individual** por licencia y registro de envíos
- [x] El sello 📤 de los pedidos de pago lo pone el envío
- [x] Enlaces desde el panel, Editoriales, Exportar y el esquema del proceso
- [x] Tests de los helpers puros (pegado, emparejado, filtros, correo, colocación de sobrantes): 62 casos nuevos
- [ ] **Aplicar `licencias-envios.sql` en Neon** (`pnpm db:sql --pendientes`) — no se ha podido
      hacer en la sesión de desarrollo por no tener `DATABASE_URL`
- [ ] Estreno: sincronizar, pegar una tanda real pequeña, prueba a `david@` y envío de verdad

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


## Identidad del alumnado: `edu_student_id`, no `student_code` (2026-09-03)

**Decisión cerrada (David):** "hay que olvidarse de esos códigos, ahora la clave tiene que ser
el NIA. Simplificación." Implementado con la clave más fuerte que ya existía: **`edu_student_id`**,
la FK a `edu_students` — cuya clave humana ES el NIA, pero que a diferencia del NIA es un uuid
que no se teclea, no se importa y no puede venir mal de un Excel.

### Por qué se rompió

`student_code` (`11SOLJOA`) venía del Excel que David importó a mano y **se genera a partir del
nombre**: 2 dígitos + 3 letras del apellido + 3 del nombre. Dos problemas de fondo:

1. **Cambia solo.** Al empezar a quitar acentos en el generador, 22 alumnos pasaron de
   `13COMVÍC` a `13COMVIC`; "DE LA TORRE" pasó de `13DE MAR` a `13DELMAR`. Como el sync
   emparejaba por código, veía a esos 22 como **baja + alta de personas distintas**: desactivaba
   la fila vieja — la que referencia `lic_orders.student_id` — y creaba otra. 13 de esos 22
   tenían pedido confirmado. Ya había pasado una vez en julio (6 pares duplicados en Neon,
   creados el 1-jul con la fila del 25-jun desactivada al lado).
2. **Colisiona.** Dos personas distintas pueden generar el mismo código. Pasó de verdad:
   la fila de Licencias de **Marina Santos Miró** (`11SANMAR`) quedó enlazada al alumno
   **Marta Sánchez Clofent** de la central, porque el código generado de una casaba con el de
   la otra. Marta tiene pedido confirmado.

### Qué cambia

- `lic_students`: la única pasa a ser **`(campaign_id, edu_student_id)`**
  (`lic_students_campaign_edu_uq`). `student_code` se queda como **etiqueta** (índice normal, no
  único) porque sale en exportaciones y en el Excel del colegio, pero ya no identifica a nadie.
- `getStudentsSyncPlan()` y `syncStudentsFromSheet()` emparejan con `emparejador()`: por
  `edu_student_id`, y por código **solo** para adoptar filas heredadas que aún no tienen enlace
  (a esas se les rellena el `edu_student_id` antes de los upserts, en el mismo batch, para no
  duplicarlas).
- `onConflictDoUpdate` apunta a la identidad: un alumno cuyo código cambie **actualiza** su fila
  (y su código) en vez de entrar como alta nueva.
- La vista previa enseña "Código" como un cambio más, para que se vea de dónde venía el lío.

### PDC: estaban fuera del alcance sin querer

Educamos llama al PDC por su programa (`3ºPPDC`, `4ºPPDC`), pero `IN_SCOPE_CURSOS` son los
`base` de `CURSOS_FORM` (`6PRI`, `1ESO`…`4ESO`). Resultado: los PDC se caían del sync, se
**desactivaban en bloque y no se volvían a dar de alta** (23 alumnos, 2 con pedido confirmado).
`getStudentsFromCentral()` traduce ahora con `cursoBaseEso()` (`src/lib/cursos.ts`, con tests):
`3ºPPDC` → `3ESO` con letra `PDC`, que es como lo tiene Licencias.

### Un tercer filtro silencioso: alumnos sin `codigo`

`getStudentsFromCentral()` exigía `r.codigo && r.curso`. Tenía sentido cuando el código era la
clave; con la identidad en `edu_student_id` solo servía para dejar fuera —sin avisar— a quien lo
tuviera a NULL, y además desactivarlo en la campaña. Le pasaba a **Aitana Pastor** (4º PDC) y
**Víctor Samuel Rodríguez** (3º PDC), ambos activos y sin código. Ahora solo se exige `curso`, y
si no hay código se usa el **NIA** como etiqueta (`studentCode: r.codigo ?? r.nia ?? r.id`).

### Aplicado en Neon (2026-09-03)

Migración y limpieza hechas ya contra la BBDD (con el visto bueno de David), así que **no hace
falta `pnpm db:push` para esto**:

- `lic_students_campaign_edu_uq` (única, `campaign_id + edu_student_id`) creada.
- `lic_students_campaign_code_uq` sustituida por `lic_students_campaign_code_idx` (índice normal).
- 6 filas duplicadas obsoletas de julio (inactivas, **0 pedidos**) con `edu_student_id = NULL`:
  `11BERSHE`, `15FELYAI`, `05MASJOR`, `11PASAIT`, `11RODVÍC`, `13RUICLA`.
- **Marina Santos Miró** reapuntada a su `edu_student_id` real (NIA 11263664). Marta Sánchez
  Clofent y su pedido, intactos.

Vista previa del sync **antes** del arreglo: 50 bajas (13 con pedido) + 32 altas.
**Después**: 10 altas reales y 4 bajas reales (2 filas heredadas basura sin enlace y 2 alumnos
que ya no están activos en la central), **0 bajas con pedido**.
