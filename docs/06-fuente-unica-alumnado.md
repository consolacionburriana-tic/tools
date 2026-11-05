# Una sola fuente de verdad del alumnado · plan

> 🔴 **PRIORIDAD MÁXIMA a partir del 1 de noviembre de 2026.** Decisión de David (2026-09-03).
> Es lo PRIMERO que hay que hacer en cuanto se retome el desarrollo, antes que cualquier otra
> casilla de cualquier otro hito.
>
> **Estado (5-nov-2026): fases 1 y 3 hechas y desplegadas; fase 2 escrita y probada, falta aplicar su
> SQL a la vez que se fusiona la rama.** Mira «Fase 2» abajo: es lo único que queda, con el orden exacto.

Deuda técnica transversal: el mismo dato de un alumno vive en dos tablas, y las dos se leen como
si fueran la verdad. Este documento deja el plan cerrado para poder ejecutarlo del tirón.

---

## El problema, en una frase

`edu_students` (BBDD central) y `lic_students` (snapshot de campaña de Licencias) guardan **los
mismos campos** (`curso`, `letra`, `banco_libros`, `email`), y el único puente entre ellos es un
**sync manual** que hay que acordarse de ejecutar.

### Cómo explotó (2026-09-02 / 09-03)

Todo esto es real y está verificado contra Neon, no es hipotético:

1. **El banco de libros no llegaba a Licencias.** David marcó a Isabel Porcar como del banco y a
   Elena Porcar como no. Se guardó bien en `edu_students`, pero el formulario público de
   Licencias lee `lic_students.banco_libros`, que seguía justo al revés. 6 alumnos descuadrados.
   *Parcheado* en `setBanco()` (`bancolibros-server.ts`), que ahora propaga a la campaña — pero
   eso es un parche sobre el síntoma, no la cura.
2. **Alumnos importados que "no existían".** 13 alumnos activos de cursos con Licencias no tenían
   fila en `lic_students`, así que su familia tecleaba el NIA en el formulario y le salía "no
   encontrado". Entre ellos el NIA 13620087, que fue el que hizo saltar todo esto.
3. **Bajas y altas fantasma de la misma persona.** El sync emparejaba por `student_code`, que se
   genera del nombre. Al cambiar la regla de acentos, 22 alumnos "cambiaron de identidad" y el
   sync iba a desactivar su fila —la que referencian sus pedidos— y crear otra. 13 tenían pedido
   confirmado. *Arreglado* (la identidad es `edu_student_id`), pero es otro síntoma de lo mismo.
4. **Enlace cruzado entre dos personas.** La fila de Licencias de Marina Santos Miró apuntaba al
   alumno Marta Sánchez Clofent, porque sus códigos generados colisionaban. *Arreglado a mano.*

### Y volvió a pasar (2026-09-17)

5. **El pedido a la editorial pedía de menos.** **Mateo Terradez** (1ºESO A) figuraba en el banco
   de libros en la central y **no** en la campaña de Licencias, así que el pedido de 1ºESO pedía
   48 licencias de cada libro en vez de 49 (y 24 de Tecnología en castellano en vez de 25). El
   parche del punto 1 no lo cubría: `setBanco()` propaga solo si el alumno **ya existe** en la
   campaña, y a quien se marca antes de entrar en ella no le llega nunca. Nadie se entera hasta
   que alguien compara a mano dos pantallas.

   *Parcheado otra vez* (2026-09-17, a petición de David: «no me gusta que haya una cosa en
   Licencias y otra al otro lado, haz que todo se sincronice solo»): Licencias **lee
   `banco_libros` de `edu_students` en vivo**, con un join, en `getStudentById()` y en el
   `loadBase()` de los informes. La copia de `lic_students` se sigue escribiendo pero ya no
   manda, así que da igual quién la toque ni cuándo.

   **Esto es la Fase 1 de este plan, aplicada solo a un campo.** Cuando se ejecute el plan
   entero, esos dos joins se quedan como están o se los come la vista/consulta definitiva; lo
   que NO hay que hacer es volver a leer el flag del snapshot.

Cinco incidentes distintos, una sola causa: **duplicar datos mutables**.

## La decisión (David, 2026-09-03)

> "No acabo de entender qué tiene de bueno tener una campaña para licencias distinta de la base
> de datos central de alumnos, porque acaban siendo dos fuentes de verdad y una obligación de
> sincronizar."

**Una sola verdad: `edu_students`.** `lic_students` se queda, pero **adelgaza**: pasa de ser una
copia del alumno a ser solo la **lista de quién participa en esta campaña**.

### Qué se queda en cada sitio

| Dato | Dónde vive | Por qué |
|---|---|---|
| Nombre, apellidos, curso, letra, email, NIA, DNI, banco de libros | **`edu_students`** | Es la BBDD central. Un solo sitio donde se escribe. |
| Quién participa en la campaña N | **`lic_students`** (fino) | Real: no todo el colegio pide licencias. |
| Curso y banco **en el momento del pedido** | **`lic_orders`** *(ya está)* | La foto histórica. Ver abajo. |

### La duda de junio, resuelta

David planteó el único argumento serio a favor del snapshot: *"si lanzo el pedido de licencias en
junio, cuando aún no se ha aplicado la migración de cursos, los de 2º de la ESO en realidad van a
ser de 3º"*. Es una duda buena, pero **el snapshot no la resuelve**:

- `lic_students.curso` guarda el curso **actual** del alumno y la app **nunca lo avanza sola**
  (está escrito en el propio schema). O sea, tiene el mismo problema que la central.
- **`lic_orders` ya guarda su propio `curso` y su propio `banco_libros`** en el momento del
  pedido (`lic_orders.curso` = "curso de catálogo seleccionado"). La foto congelada de "esta
  familia pidió esto, para este curso, siendo del banco" **ya existe y está en el pedido**.

Conclusión: la foto histórica es del **pedido**, no del listado. El listado solo dice quién juega.
Y el salto de curso de junio es una decisión del formulario (qué catálogo se le ofrece), no algo
que se arregle duplicando la tabla de alumnos.

---

## Plan técnico

Está muy contenido: **casi todas las lecturas viven en `src/lib/licencias-server.ts`**, más una en
`licencias-exports.ts`. Son ~8 sitios de query, no cientos.

### Fase 1 · Leer en vivo (sin tocar el schema todavía) — ✅ hecha (5-nov-2026)

Todos los sitios que leían los campos duplicados de `lic_students` hacen ahora `innerJoin(eduStudents)`
y leen de ahí, a través de **un solo módulo**: `src/lib/licencias-alumno-server.ts` (`alumnoVivo`,
`alumnoCols`, `ON_EDU`, `CURSO_LIC_SQL`, tipo `LicAlumno`). Los nombres de los campos son los de
siempre, así que quien los consume no cambió. Los campos duplicados siguen en la tabla pero
**nadie los lee** (salvo el propio sync, que es quien los escribe hasta la fase 2).

- [x] `identifyStudentsByFamily()` — `curso` desde `edu_students`.
- [x] `getStudentById()` — el alumno con sus datos vivos (`LicAlumno`); `getCatalog()` lee de ahí el
      **banco de libros** (el que causó el bug de las Porcar). `conBancoDeLaCentral()` desaparece.
- [x] Los listados y exportaciones de `licencias-server.ts` (dashboard, quién falta, destinatarios,
      clases, familias, pedidos, idioma por clase), `licencias-exports.ts` (`loadBase`),
      `licencias-envios-server.ts` (sincronizar, contexto, envíos, descartes) y
      `licencias-profes-server.ts` (dónde está un código).
- [x] `cursoBaseEso()` en el join: los PDC (`3ºPPDC`) se traducen a `3ESO` en SQL (`CURSO_LIC_SQL`).
- [x] Guardas de que no se vuelve a leer la copia (`licencias-alumno.test.ts`): el SQL generado cuelga
      de `edu_students` y ningún fichero de lectura de Licencias lee `licStudents.<columna duplicada>`.
- [x] **Verificado contra Neon (5-nov-2026):** 24 pantallas y exportaciones comparadas, código viejo
      contra código nuevo, sobre la campaña real. Idénticos: dashboard, clases, idioma por clase,
      informe a editoriales, informe del banco, ID Educamos, envíos, detalle de pedidos. Las únicas
      diferencias son **la copia vieja delatándose**: unos apellidos corregidos en la central
      (Restrepo/Gallego), dos correos que la copia tenía vacío o antiguo (Samuel Arboleda, Johan
      Gómez: salían sin correo en la exportación del banco) y filas inactivas con el curso de
      junio sin mover. Es justo el problema que este plan resuelve.

> **El idioma de la clase (`lengua_base`) NO es un duplicado**, y el plan original lo borraba por
> error (se escribió el 3-sep, antes de la pantalla «Idioma por clase» del 16-sep). La central
> lo tiene a NULL en todo el alumnado (`modelo_linguistico`) y es una decisión de la clase **de
> cada campaña**, que cambia cada curso. Se queda en `lic_students`, igual que `manual_completed_*`.

### Fase 2 · Adelgazar la tabla — 🟡 código escrito y probado; falta aplicar el SQL

**Estado (5-nov-2026):** la campaña 2026/27 está **cerrada**, la fase 1 está fusionada en `main`
y el código de la fase 2 está escrito en la rama `claude/fuente-unica-fase2`. **Falta una cosa, y
con orden:** aplicar `src/db/sql/fuente-unica-fase2.sql` (borra columnas) y fusionar esa rama **en
el mismo momento**. Si el SQL se aplica con el código viejo en producción, Licencias se rompe; si
se fusiona el código sin el SQL, el alta de alumnos falla (las columnas viejas son `NOT NULL`).
Antes de nada, comprobar en Vercel que el despliegue de la fase 1 está *Ready*.

Cosas que se descubrieron al prepararla y que **cambian el plan original**:

- **`lengua_base` NO se borra.** Ver el aviso de la fase 1: no es un duplicado, es del curso.
- **15 filas heredadas sin enlace** (inactivas, sin pedidos ni licencias ni envíos) impedían poner
  `edu_student_id NOT NULL`. El SQL las borra —solo si no tienen NADA colgando— y, si quedara alguna
  más, el `SET NOT NULL` falla a propósito antes de tocar ninguna columna.
- **`seed-licencias.ts` se ha borrado** (y su script `db:seed:licencias`): insertaba alumnos con
  nombre y curso, y el alumnado entra ya desde la central. El JSON `src/db/data/licencias-2026.json`
  se queda de momento (trae datos personales del curso pasado: mejor sacarlo del repo aparte).
- **El sync de alumnos se queda en «¿quién entra y quién sale?»**: sin `toUpdate` ni `diffStudent`,
  un solo `INSERT … ON CONFLICT` y una sola baja en un `db.batch`.
- **Una campaña abierta antes de pasar el curso** (junio/julio) necesita leer a cada alumno un
  curso por delante. Con el snapshot eso salía solo (el seed ya traía el +1); leyendo en vivo hay
  que decirlo: `lic_campaigns.promociona` (SQL aditivo `licencias-campana-promociona.sql`, **ya
  aplicado**) y `cursoParaCampania()` / `CURSO_LIC_SQL` (con tests que cruzan JS y SQL).

- [x] Cerrar la campaña 2026/27.
- [x] Desplegar la fase 1 (PR #127 fusionada) — *pendiente de confirmar «Ready» en Vercel*.
- [x] Las 15 filas sin enlace: se borran en el SQL (con la guarda de «sin nada colgando»).
- [x] SQL escrito y probado en seco: `fuente-unica-fase2.sql` (13 sentencias).
- [x] Código: columnas fuera de `schema.ts`; altas y sync solo con `campaign_id` + `edu_student_id` +
      `student_code` + `lengua_base`; `seed-licencias.ts` borrado.
- [x] Quitado el parche `propagarBancoACampania()` de `bancolibros-server.ts`.
- [x] `getAlumnosFueraDeCampania()` **se queda** (y mira el curso como lo ve la campaña): la fase 3
      solo da de alta a los alumnos nuevos de cada import, no repesca a quien ya estaba fuera.
- [x] Verificado contra Neon: con la rama, 25 pantallas y exportaciones dan **idéntico** resultado
      que `main` (con `promociona = false`); la promoción +1 comprobada sobre el alumnado real
      (1ESO→2ESO, 6PRI→1ESO, 4ESO→fuera, PDC incluido).
- [ ] **Aplicar `fuente-unica-fase2.sql` y fusionar la rama a la vez** (ver arriba).

### Fase 3 · Que no haya que acordarse de sincronizar

El sync deja de mover datos y pasa a responder solo una pregunta: *¿quién entra en la campaña?*
Eso ya se puede automatizar sin miedo, porque no pisa nada.

- [x] Tras aplicar un import de Educamos (`aplicarSync`), dar de alta en la campaña vigente a los
      alumnos nuevos que estén en cursos con Licencias (`darDeAltaEnCampania()` en
      `licencias-server.ts`). **Altas sí, bajas no** automáticas: una baja debe seguir siendo una
      decisión con vista previa. Solo inserta (`ON CONFLICT DO NOTHING`) y con la campaña
      cerrada no entra nadie. Probado contra Neon: con alumnos que ya están, 0 altas.
- [x] Enseñar en el resultado del import cuántos entraron en la campaña (`sync-wizard.tsx`).
- [x] La pantalla de sincronizar se queda para el repaso manual y las bajas.

### Fase 4 · Rematar

- [x] `docs/11-licencias-v2.md`: el modelo de datos dice ya que se lee en vivo (falta quitar las
      columnas, fase 2).
- [x] `docs/12-bancolibros.md`: la "Fase 5" pasa a ser histórico; el parche ya no existe.
- [x] `docs/pequeños-arreglos.md`: no había nada de esto apuntado.

## Riesgos y cómo cubrirlos

- **Pedidos.** `lic_orders.student_id` → `lic_students.id`. Ese id **no se toca en ninguna fase**.
  Es la regla que no se salta: borrar columnas sí, cambiar ids jamás.
- **Exportaciones a editoriales.** Salen con `student_code`. Por eso la etiqueta se queda.
- **Orden de trabajo.** Fase 1 completa y verificada en producción antes de tocar el schema. Si
  algo se tuerce en fase 1, se revierte con un deploy, sin migración de por medio.
- **Campaña abierta.** No hacer la fase 2 con una campaña recibiendo pedidos.

## Lo que ya está hecho (2026-09-03) y no hay que repetir

- La identidad de `lic_students` es `edu_student_id` (única `lic_students_campaign_edu_uq`
  creada en Neon). `student_code` es solo una etiqueta.
- Los PDC (`3ºPPDC`/`4ºPPDC`) entran en el alcance de Licencias vía `cursoBaseEso()`.
- El sync ya no exige `codigo` para entrar en la campaña.
- Datos limpios: 6 duplicados de julio neutralizados y Marina Santos reapuntada.
- Parche de propagación del banco (`setBanco`) — **temporal, lo elimina la fase 2**.
