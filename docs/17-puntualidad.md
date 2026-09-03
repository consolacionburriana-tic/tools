# Puntualidad · plan y checklist

Módulo para registrar, en segundos, al alumnado de secundaria que llega tarde a las 8:00 y
se encuentra las puertas cerradas. Cada 3 retrasos sin justificar se avisa al tutor/a y el
alumno se queda sin patio.

> **La regla de oro de este módulo es la velocidad.** Si registrar un retraso cuesta más que
> apuntarlo en un papel, el profesorado no lo usará. Cualquier cambio futuro se mide con esa
> vara: ¿sigue siendo un buscador, tres toques y guardar?

---

## Estado: Fases 0-3 implementadas y en Neon ✅

- **Formulario** (`/puntualidad`, detrás del login del claustro): buscador con foco al abrir,
  historial en vivo del alumno, asignatura en un toque, fecha/hora precargadas y retraso
  calculado. Permite encadenar varios alumnos en el mismo envío y personalizar los datos de
  cada uno.
- **Panel** (`/gestion/puntualidad`): dashboard con rangos (7/30/90 días y todo el curso),
  listado de retrasos con justificación a posteriori, consecuencias, ficha por alumno y
  catálogo de asignaturas. Export CSV.
- **Correos**: aviso del tercer retraso al tutor/a (con enlace de un clic para poner el día
  sin patio) y resumen semanal a tutores los viernes (solo si su clase tiene retrasos).
- **Base de datos aplicada** (2026-09-03): las 6 tablas `pun_*` / `con_*` están en Neon con
  sus 7 claves ajenas y sus índices, más las semillas (tipo `sin_patio` y las 13 asignaturas
  de ejemplo). Se aplicó el SQL de `src/db/sql/puntualidad.sql` y se verificó con una prueba
  de humo (insertar un retraso de un alumno real de 2ESO, comprobar los joins del módulo y la
  consecuencia vinculada, y borrarlo todo dentro de la misma transacción: la base quedó a 0).
- **Dependencia de arranque de curso:** las tutorías de `edu_tutorias` son todas del curso
  **2025-26** y hoy el curso en vigor es **2026-27**, así que hasta que David asigne las
  tutorías del curso nuevo en `/gestion/profes` (hay botón de promoción +1): el aviso del
  tercer retraso creará la consecuencia pero **sin correo a nadie**, el resumen semanal no
  saldrá, y un tutor verá su panel vacío. No es del módulo: afecta igual a los destinatarios
  sugeridos del ABC.

## Decisiones cerradas (2026-09-02, con David)

- **Nombre y rutas:** "Puntualidad". Formulario en `src/app/(public)/puntualidad`
  (detrás del login, como el ABC), panel en `src/app/gestion/puntualidad`, módulo de
  permisos `puntualidad`.
- **Prefijos de tabla:** `pun_*` para lo del módulo (`pun_subjects`, `pun_records`,
  `pun_digest_runs`) y **`con_*` para las consecuencias** (`con_consequences`,
  `con_consequence_types`, `con_consequence_records`). El prefijo separado es una decisión
  explícita: una consecuencia no siempre nace de un retraso (mañana puede venir de
  convivencia o crearse a mano, y ya se puede hoy), así que el día que las consecuencias
  sean su propio módulo se mudan esas tres tablas sin renombrar nada.
- **Alcance: solo secundaria** (ESO y PDC). El buscador filtra por curso contra
  `edu_students`; infantil y primaria no entran.
- **Hora límite 08:05**, constante `HORA_LIMITE` en `src/lib/puntualidad.ts`. El retraso en
  minutos **y el límite vigente** se guardan en cada fila: cambiar la constante mañana no
  reescribe el histórico.
- **Nombres completos en pantalla** en todo el módulo (a diferencia del ABC, que va por
  siglas). Es un panel interno del claustro y aquí el nombre ES la información útil: hay que
  distinguir a los dos Robertos de dos clases distintas y saber a quién avisar. La clase se
  pinta siempre al lado, como chip.
- **La regla del tercero:** cuentan los retrasos **no justificados** del **curso académico**.
  Al tercero se crea la consecuencia y se avisa; esos tres quedan vinculados a ella
  (`con_consequence_records`) y **dejan de contar**, así que el siguiente aviso llega a los
  tres siguientes. No hay columnas de contador: el "ciclo" se deduce de qué retrasos están
  ya vinculados, que es imposible de descuadrar.
- **Los justificados no cuentan** para el ciclo, pero **sí se ven** en el total del alumno
  (que el tutor sepa que hubo cinco retrasos aunque tres trajeran justificante).
- **Consecuencia = "se queda sin patio"**, con catálogo abierto (`con_consequence_types`) por
  si mañana hay otras (aula de convivencia, tarde…). Lleva fecha (la pone el tutor), notas y
  dos toggles de seguimiento: **cumplida** y **avisada en Educamos**.
- **Enlace del correo al tutor: token sin login** (`con_consequences.token`, caduca a los 60
  días, abre solo esa consecuencia) **y la misma pantalla accesible desde dentro del panel**.
  El tutor abre el correo en el móvil, ve los tres retrasos con su día, hora, asignatura y
  quién los registró, y pone la fecha en dos toques.
- **Quién registra:** cualquier persona del claustro con sesión (`requireSession()`), igual
  que el formulario del ABC.
- **Quién ve los datos:** dirección, jefatura, orientación y TIC ven todo el centro
  (`vePuntualidadCompleta()` en `src/lib/permissions.ts`); un **tutor** tiene el módulo pero
  el panel le filtra a las clases que tutoriza (`edu_tutorias` del curso en vigor). El
  catálogo de asignaturas solo lo toca quien ve todo.
- **Avisos:** (1) el del tercer retraso al tutor/es de la clase, con **copia opcional a
  jefatura/dirección** (`PUNTUALIDAD_AVISOS_COPIA`); (2) **resumen semanal** a cada tutor los
  viernes, **solo si su clase tiene retrasos esa semana** — si no hay nada que contar, no se
  manda correo. Nada de avisos a familias por ahora.
- **Aviso al profe de la asignatura: escrito pero apagado.** La plantilla existe
  (`htmlAvisoProfeAsignatura`) y `pun_records.aviso_profe_enviado_at` está en el schema, pero
  no se llama desde ningún sitio: mientras los horarios del claustro no estén en la app, la
  asignatura se elige a mano y no se puede saber con certeza de quién es esa clase. Nada de
  correos a ciegas.
- **Registro múltiple:** se puede añadir a varios alumnos de golpe. Con uno la asignatura es
  opcional (a veces no se sabe y lo urgente es apuntarlo); **con varios es obligatoria**, o
  esos retrasos quedarían todos sin contexto de una vez.
- **"Sube a clase" por defecto NO** (es lo que pasa siempre). Si se marca el retraso como
  justificado, se marca solo — es el único caso en que sí sube. Justificación y "sube a
  clase" viven escondidos detrás de "Más datos", igual que las observaciones.

## Plan técnico

### Datos (`src/db/schema.ts`)

| Tabla | Para qué |
|---|---|
| `pun_subjects` | Catálogo de asignaturas (nombre, abreviatura, `edu_teacher_id` para el futuro aviso, orden, activa). Sembrado con las de secundaria como ejemplo. |
| `pun_records` | El retraso: alumno (`edu_student_id`), clase congelada (`curso`/`letra`), fecha, hora, `hora_limite`, `minutos_retraso`, asignatura, justificación, `sube_a_clase`, observaciones, quién lo registró y curso académico. |
| `con_consequence_types` | Catálogo abierto de tipos ('sin_patio' sembrado). |
| `con_consequences` | La consecuencia: alumno, tipo, `origen` ('puntualidad' \| 'manual'), fecha, motivo, notas, `cumplida`, `avisada_educamos`, `token` + caducidad, aviso enviado y a quién. |
| `con_consequence_records` | Puente consecuencia ↔ retrasos que la motivaron. Es lo que "reinicia el contador". |
| `pun_digest_runs` | Bitácora del resumen semanal (una fila por semana ISO) para no mandarlo dos veces. |

### Código

```
src/lib/puntualidad.ts            # helpers puros: minutos de retraso, resumen de historial,
                                  #   frase del historial, semana ISO, schema Zod compartido
src/lib/puntualidad-server.ts     # queries: búsqueda, historial, alta con ciclo de tres,
                                  #   dashboard, consecuencias, alcance por tutoría
src/lib/puntualidad-email.ts      # aviso del 3º + resumen semanal (+ aviso al profe, apagado)
src/lib/puntualidad-exports.ts    # CSV
src/components/puntualidad/*      # ui.tsx (vocabulario naranja), formulario, paneles
src/app/(public)/puntualidad/     # formulario + pantalla del token de consecuencia
src/app/gestion/puntualidad/      # dashboard, retrasos, consecuencias, asignaturas, ficha
src/app/api/puntualidad/          # endpoints (alumnos, historial, registros, admin/*, cron)
```

Rutas de API: `GET /api/puntualidad/alumnos?q=` · `GET /api/puntualidad/historial/[id]` ·
`POST /api/puntualidad/registros` · `PATCH|DELETE /api/puntualidad/admin/registros/[id]` ·
`GET|POST|PATCH /api/puntualidad/admin/asignaturas` ·
`GET|POST /api/puntualidad/admin/consecuencias` y `PATCH|DELETE .../[id]` ·
`POST /api/puntualidad/consecuencia/[token]` (público, token) ·
`GET /api/puntualidad/admin/export` · `GET|POST /api/puntualidad/cron/resumen-semanal`.

El cron del resumen semanal está declarado en `vercel.json` (viernes 15:00 UTC = 17:00 hora
local) y se autentica con `CRON_SECRET`; también se puede lanzar a mano con sesión del módulo.

`src/proxy.ts` protege `/puntualidad` pero **no** `/puntualidad/consecuencia/<token>`, que es
público a propósito.

## Fase 0 · Cimientos — ✅
- [x] Tablas `pun_*` y `con_*` en `src/db/schema.ts` (aditivas)
- [x] Módulo `puntualidad` en la matriz de permisos + `vePuntualidadCompleta()` con tests
- [x] Helpers puros con tests (`pnpm test`: retraso, resumen de historial, ciclo, semana ISO)
- [x] Tablas aplicadas en Neon (2026-09-03, vía el conector de Neon). El SQL equivalente
      queda en `src/db/sql/puntualidad.sql`: idempotente y con los mismos nombres de
      constraint e índice que genera Drizzle, para que un `pnpm db:push` posterior no vea
      diferencias. Verificado: 6 tablas, 7 claves ajenas, 16 índices, 1 tipo de consecuencia
      y 13 asignaturas de ejemplo
- [ ] Asignar las tutorías del curso 2026-27 en `/gestion/profes` (**David**) — sin eso no
      hay a quién avisar del tercer retraso (ver "Dependencia de arranque de curso")

## Fase 1 · Formulario de registro — ✅
- [x] Buscador de alumnado de secundaria por nombre/apellido (nombre completo + clase)
- [x] Historial en vivo al elegir alumno ("4º del curso · 2 este mes" / "el último fue el…")
- [x] Asignatura en chips, fecha y hora precargadas, retraso en minutos calculado
- [x] Varios alumnos en un envío, con personalización individual
- [x] Justificado (con motivos rápidos), sube a clase y observaciones, escondidos
- [x] Guardar sin salir de la pantalla + toast por alumno; aviso de duplicado del mismo día

## Fase 2 · Consecuencias — ✅
- [x] Ciclo de tres no justificados → consecuencia + vínculo con los retrasos
- [x] Correo al tutor/a con el detalle de los tres y copia a jefatura (`PUNTUALIDAD_AVISOS_COPIA`)
- [x] Pantalla de un clic con token (sin login) para poner el día sin patio
- [x] Toggles de cumplida y avisada en Educamos
- [x] Consecuencia a mano (origen `manual`), lista para vivir sin puntualidad detrás

## Fase 3 · Panel y datos — ✅
- [x] Dashboard con rangos, tendencia, día de la semana, hora, asignatura, clase, profe
- [x] Reincidentes y ficha por alumno (asignaturas, días, quién registra, historial completo)
- [x] Listado con justificación a posteriori, edición y borrado
- [x] Catálogo de asignaturas editable
- [x] Export CSV y resumen semanal a tutores (solo si hay retrasos)
- [x] Alcance por tutoría para los tutores

## Fase 3b · Pasada de UI/UX — ✅ (2026-09-02)

Repaso de detalle sobre lo ya construido, con la vara de medir del módulo (que a las 8:05,
de pie y con prisa, no haya que pensar):

- [x] **Buscador con teclado**: ↑ ↓ mueven el resaltado y Enter añade (antes Enter cogía
      siempre el primero). Con roles `combobox`/`listbox`/`option` para lectores de pantalla.
- [x] **Aviso de duplicado ANTES de guardar**: al elegir a alguien que ya tiene un retraso
      ese mismo día, la tarjeta lo dice con la hora del que ya hay. Antes solo se avisaba
      después de guardar, cuando ya no servía de nada.
- [x] **La tarjeta entera avisa del tercero**: borde rosa cuando ese registro va a cerrar el
      ciclo de tres, que es la información que cambia la conversación con el alumno.
- [x] **Hora a toques**: botones −5 / +5 minutos junto a la hora, porque el selector nativo
      de iPad para poner "08:17" es un suplicio.
- [x] **Lo guardado se queda a la vista**: los toast se van; ahora, al terminar, queda una
      lista verde con quién se ha registrado, cuántos lleva y si le toca sin patio.
- [x] Pasos numerados (1 quién · 2 asignatura · 3 cuándo), esqueleto de carga en vez de
      "Cargando historial…" y `aria-live` en el resumen del alumno.
- [x] **Panel**: listado agrupado por día con su cabecera y su cuenta ("martes 3 · 4
      retrasos · 3 sin justificar") en vez de una lista plana; estado vacío de verdad en el
      dashboard (con enlace a registrar) en vez de seis paneles diciendo "sin datos"; y
      tooltips de los gráficos con el tema de la app (el de recharts es blanco fijo y en
      modo oscuro deslumbra).

## Fase 4 · Cuando estén los horarios — ⬜

Los horarios son una **pieza transversal** con ficha propia: [`07-horarios.md`](./07-horarios.md)
(modelo de datos diseñado, sin implementar). Estas tres casillas son su Fase 4.

- [ ] Deducir asignatura (y profe) del día + hora contra el horario de la clase
- [ ] Encender el aviso al profe de la asignatura (`htmlAvisoProfeAsignatura` ya está escrito)
- [ ] Revisar si con horarios conviene distinguir franjas además de la entrada de las 8:00
