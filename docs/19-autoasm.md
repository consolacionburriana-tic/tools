# AUTOASM · Apple School Manager · plan y checklist

Módulo para **generar, revisar y descargar los seis CSV que importa Apple School Manager**
(el "SIS CSV" de Apple), que hasta ahora se montaban a mano en Excel una vez al año y en
cada alta o baja de mitad de curso. Sale de la sesión del 5-sep-2026 con los ficheros
reales del curso en la mano.

Rutas: `/gestion/autoasm` (portada del estudio) y `/gestion/autoasm/<fichero>` (explorador).
Acceso: **TIC, SuperTIC, Dirección y Jefatura** (`autoasm` en `src/lib/permissions.ts`).

---

## Estado: plan funcional ✅ · plan técnico ✅ · implementado ✅ (2026-09-05)

Depende de la BBDD central (`edu_students`, `edu_teachers`) para las personas. No crea
tablas nuevas: el proyecto de trabajo vive en el navegador (ver decisiones).

---

## Los seis ficheros (esto es lo que hay que saber de ASM)

Se enlazan entre sí, y ASM valida el conjunto antes de aplicar nada:

```
locations ──┬─> courses ──> classes ──> rosters
            ├─> staff ────────┘  (instructor_id … instructor_id_12)
            └─> students ─────────────────┘  (student_id)
```

| Fichero | Una fila es… | Campos |
|---|---|---|
| `locations.csv` | El centro. En Consolación, **una sola fila** (`Consolacion_Burriana`) | `location_id`, `location_name` |
| `students.csv` | Un alumno/a; de aquí sale su Managed Apple ID | `person_id`, `person_number`, `first_name`, `middle_name`, `last_name`, `grade_level`, `email_address`, `sis_username`, `password_policy`, `location_id` |
| `staff.csv` | Una persona del claustro | igual que students, **sin** `grade_level` ni `password_policy` |
| `courses.csv` | La "materia contenedora" que agrupa clases | `course_id`, `course_number`, `course_name`, `location_id` |
| `classes.csv` | La clase que sale en Aula/Tareas Escolares, con sus profes | `class_id`, `class_number`, `course_id`, `instructor_id`, `instructor_id_2`…`instructor_id_12`, `location_id` |
| `rosters.csv` | Un alumno en una clase | `roster_id`, `class_id`, `student_id` |

Cómo está montado hoy el centro (leído de los ficheros que pasó David, y recogido en
`src/lib/autoasm-plantilla.ts`):

- **41 cursos**: uno por grupo (`Course-ESO-ESO1A` → "ESO 1A"), unos cuantos de **nivel
  entero** (`Course-ESO-ESO1`, `Course-EP-EP5`), los dos de **PDC** y los de
  **compartidos** (infantil, primaria y el general).
- **190 clases**: en infantil y primaria 1-4, una "Tutoría" por grupo **sin alumnado**
  (solo profes, porque ahí los iPads no son personales); de 5º de primaria en adelante,
  una clase por asignatura con el código abreviado de siempre (`Cls-MatESO1A`,
  `Cls-ValESO4B`), más las de nivel y las de compartidos.
- **`person_id`**: el **NIA** en el alumnado; en el claustro, nombre + primer apellido sin
  espacios ni acentos, pero **conservando la ñ** (`josemiguelbatalla`, `marianuñez`).
- **`grade_level`**: texto libre que ASM usa para agrupar, con la forma que ya está dentro
  (`ESO 1A`, `PRIMARIA 5A`, `ESO 3 PDC`, `Infantil Compartido`). No se toca por gusto:
  cambiarlo mueve de grupo a todo el alumnado en ASM.
- **`password_policy`**: `4` en todo el alumnado (PIN de cuatro dígitos). Valores válidos:
  4, 6 u 8.
- Las clases de asignatura **no siempre llevan un grupo entero y solo uno**. En ASM una
  clase no dice "3º A": dice, alumno a alumno, quién está dentro (eso es `rosters.csv`).
  Y en el centro hay asignaturas que juntan grupos — Música de 3º PDC va con la de 3º A,
  y por eso Religión de 3A tiene 31 matriculados y la tutoría de 3A, 19.

  **La regla de matrícula es el atajo para no tener que decirlo alumno a alumno**: en vez
  de 31 líneas, la clase guarda "aquí entran ESO 3A y ESO 3 PDC", y el módulo escribe las
  31 líneas él solo cada vez que cambia el alumnado. Al subir el `rosters.csv` del curso
  pasado, el módulo mira quién está matriculado en cada clase y **deduce la regla**: si en
  una clase está el grupo entero (o casi), lo apunta como regla; si hay un alumno suelto,
  lo trata como excepción y no lo generaliza. Las reglas se ven y se tocan en la ficha de
  cada clase ("Quién se matricula"), y se aplican con "Rehacer matrículas".

  Esto es un apaño mientras los horarios no estén en Neon: **de dónde tiene que salir de
  verdad es del horario** (una asignatura con dos grupos ES una clase conjunta). Ver
  "Lo que falta" al final.

## Lo que se encontró en el export del curso (5-sep-2026)

La validación del módulo, pasada por los ficheros reales, saca esto — son cosas de los
datos, no del módulo:

- **29 líneas de matrícula duplicadas** (15 pares alumno-clase repetidos): 14 alumnos de
  `Cls-EPComp` aparecen **tres veces** y uno de `Cls-PIARESO3`, dos.
- **`Cls-TValESO1` (Taller Valencià) no tiene `class_number`**, que es obligatorio: en ASM
  esa clase se queda sin nombre.
- **57 correos de alumnado en MAYÚSCULAS** (`MARIAAGUILELLA@…`). ASM los pasa a minúsculas
  al importar, así que no rompe, pero el fichero queda inconsistente.
- 16 profes sin ninguna clase, 14 clases sin alumnado (las tutorías de infantil y primaria
  1-4, que es a propósito) y 2 cursos sin clases (`ESO1C`, `ESO2C`).
- `students.csv` traía una **primera columna vacía sin nombre** (típico de guardar desde
  Excel). El módulo la descarta al leer y avisa.

## Decisiones cerradas

### El alcance del alumnado es una opción, no una constante (2026-09-06)
Los iPads no llegan a todo el centro y el corte se ha movido cada año: **2025-26 de 5º de
primaria para arriba**, **2026-27 de 6º de primaria**, y **a partir de 2027-28 de 1º de ESO
y ya no se mueve más**. Por eso hay un selector "**Alumnado desde**" en el paso 1 (por
defecto 6º EP), que se guarda con el proyecto, y el sync deja fuera al resto diciendo
cuántos y de qué cursos.

Se filtra por el **curso de la BBDD central** (`6PRI`, `1ESO`) y no por el `grade_level`,
que es texto libre; el PDC cuenta por su curso de verdad (`3ºPPDC` → 3º de ESO). El
**profesorado entra siempre entero**: un profe da clase donde le toque, y además el
claustro necesita sus cuentas aunque su grupo no tenga iPads.

### El proyecto vive en el navegador, no en Neon
Lo que se manipula aquí es el alumnado entero del centro en su forma más exportable. Entra
una vez desde `/api/autoasm/admin/centro`, se trabaja, se descarga el ZIP y se olvida:
**ninguna tabla nueva, ningún export guardado en la base de datos**. El borrador (con los
profes ya asignados) se guarda en `localStorage` del dispositivo de quien lo prepara.
El precio, asumido: cambiar de dispositivo obliga a empezar de nuevo — o a subir el ZIP que
uno mismo se descargó, que el módulo sabe leer.

### La estructura académica sí está en el repo, las personas no
`src/lib/autoasm-plantilla.ts` tiene los cursos, las clases y a qué grupos corresponde cada
una. **No hay ni un dato personal ahí**: ni nombres, ni correos, ni NIAs. Las personas
salen siempre de `edu_students` / `edu_teachers` o del ZIP que se suba.

### Los identificadores no se reinventan cada año
ASM actualiza si el id coincide y **crea un registro nuevo si no**. Por eso al traer del
centro se empareja por NIA (alumnado) y por correo (profesorado) y se conserva el
`person_id` que ya tuviera esa persona aunque le cambie el nombre o el apellido.

### Las bajas no se borran solas
Traer del centro nunca quita a nadie salvo que se pida explícitamente ("Quitar a quien ya
no está"). Así las cuentas que no vienen de Educamos (dirección, pruebas, compartidos) no
desaparecen sin querer. Cuando sí se pide, a los profes retirados se les saca además de
las clases donde eran instructores, y se dice a quién.

### Comas por defecto, punto y coma si hay que mirarlo en Excel
Apple pide CSV UTF-8 separado por comas. El selector de la pantalla permite generar con
`;` y con BOM para revisar en Excel en español, con el aviso de para qué es cada cosa.

### Editar, lo justo
Del módulo solo se editan **los profes de cada clase** y **qué grupos se matriculan en
ella**, porque son las dos únicas cosas que no están en ninguna base de datos del colegio.
Todo lo demás se trae o se sube.

## Plan técnico

```
src/lib/autoasm.ts              # especificación de los 6 ficheros, CSV (leer/escribir), validación
src/lib/autoasm-plantilla.ts    # estructura académica del centro (sin personas)
src/lib/autoasm-construir.ts    # BBDD central → filas, sync, matrículas, inferencia de reglas
src/lib/autoasm-server.ts       # única query: alumnado y profesorado activos
src/app/api/autoasm/admin/centro/route.ts   # GET protegido con hasModule('autoasm')
src/app/gestion/autoasm/…       # portada (estudio) y explorador por fichero
src/components/autoasm/…        # estudio, explorador, subida, descargas, store de proyecto
src/lib/__tests__/autoasm.test.ts  # 34 tests con datos inventados
```

- La **validación** (`validarProyecto`) mira lo mismo que ASM: campos obligatorios, claves
  repetidas, `person_id` único entre alumnado y profesorado, correos y usuarios sin
  duplicar, `password_policy` válida, y todas las referencias cruzadas (curso de una clase,
  instructor en staff, clase y alumno de cada matrícula). Cada incidencia lleva un `tipo`
  para poder agrupar 300 filas iguales en una línea.
- El **ZIP** se genera en el navegador con `jszip` (ya era dependencia) e incluye un
  `LEEME.txt` con el recuento, el separador usado y cómo se sube.
- El **explorador** resuelve los identificadores a nombres (`Cls-MatESO1A` → "Matemáticas ·
  ESO 1A"), los hace navegables entre ficheros y esconde las columnas vacías.

## Fases

### Fase 1 · Núcleo y ficheros ✅
- [x] Especificación de los seis ficheros con ayuda campo a campo
- [x] Parser y serializador de CSV (comillas, CRLF, BOM, `,` y `;`)
- [x] Lectura tolerante: columnas de más, de menos y la columna vacía de Excel
- [x] Validación completa con tipos de incidencia y niveles error/aviso
- [x] Tests (34) con datos inventados

### Fase 2 · Orígenes de datos ✅
- [x] Plantilla de la estructura del centro (41 cursos, 190 clases, reglas de grupo)
- [x] Traer alumnado y profesorado de la BBDD central conservando identificadores
- [x] Selector de alcance ("Alumnado desde", por defecto 6º EP), con aviso de cuántos y de
      qué cursos se quedan fuera. El profesorado entra siempre entero
- [x] Subir el ZIP o los CSV del curso pasado (identificación por nombre o por cabeceras)
- [x] Inferir la regla de matrícula de cada clase a partir de sus matrículas reales

### Fase 3 · Pantallas ✅
- [x] Estudio en cuatro pasos: origen → ficheros → revisión → descarga
- [x] Explorador por fichero: búsqueda, filtros, orden, paginación y columnas vacías
- [x] Identificadores navegables y ficha de fila con lo que cuelga de ella
- [x] Editor de profes por clase y de grupos matriculados
- [x] Descarga del ZIP (con LEEME) y de cada CSV suelto
- [x] Revisado en claro y oscuro, y en ancho de iPad

### Fase 4 · Cuando haya horarios (`hor_*`)
- [ ] Generar las clases y sus profes desde las asignaciones docentes (ver "Lo que falta")
- [ ] Emparejar asignación ↔ `class_id` existente para no duplicar clases en ASM
- [ ] Clases de curso entero y profes fijos (TIC/dirección) automáticos, si David lo ve

### Fase 5 · Pendiente de David
- [ ] Subir a ASM un ZIP generado por el módulo y confirmar que lo traga sin quejarse
- [ ] Decidir qué hacer con los 29 duplicados de matrícula y con `Cls-TValESO1`
- [ ] ¿Se normalizan a minúsculas los 57 correos en mayúsculas? (cambiarlo en la BBDD
      central, no aquí)

---

## Lo que falta: que las clases salgan del horario (2026-09-06)

Hoy hay dos cosas que el módulo **no puede sacar de ninguna base de datos**, y por eso se
arrastran del export del curso anterior o se ponen a mano:

1. **Qué profes dan cada clase.**
2. **Qué grupos van juntos en cada asignatura** (Música de 3º PDC con 3º A, Inglés que un
   año es conjunto y al siguiente no).

Las dos están, exactamente, en el horario. Cuando `hor_*` tenga datos
([`07-horarios.md`](./07-horarios.md), Fase 0 hecha, falta el importador), el mapeo es
directo:

| ASM | Horarios |
|---|---|
| Una **clase** (`classes.csv`) | Una **asignación docente** lectiva de tipo clase (`hor_asignaciones`) |
| `class_number` | `hor_materias.nombre` |
| **Instructores** | `hor_asignacion_profes` (hasta 12; el `principal` primero) |
| **Matrículas** (`rosters.csv`) | El alumnado de los grupos de `hor_asignacion_grupos` — que es la "regla de matrícula" de hoy, pero real: si la asignación junta 3ºA y 3º PDC, la clase junta 3ºA y 3º PDC |
| `course_id` | El curso del grupo de la asignación (con varios, el del grupo mayor) |

Lo único delicado es **no duplicar clases en ASM**: si una asignación genera un `class_id`
distinto al que ya existe, ASM crea una clase nueva en vez de actualizar la de siempre. La
solución cuando toque: guardar el `class_id` de ASM en la propia asignación (una columna
`asm_class_id` en `hor_asignaciones`) y emparejar la primera vez por materia + grupo contra
las clases que ya están.

Mientras tanto, **subir el ZIP del curso pasado sigue teniendo sentido** por dos motivos:
es lo que conserva los profes de cada clase hasta que haya horario, y es la forma de
recuperar un proyecto si se cambia de dispositivo (el borrador vive en el navegador).

## Decisión pendiente: las clases de curso entero y los accesos "por si acaso"

En ASM hay hoy tres tipos de clase que no salen de ninguna asignatura y que responden a
una necesidad distinta:

- **De curso entero** (`Cls-ESO1`, `Cls-EP5`…): un sitio donde a un profe le salen TODOS
  los alumnos de 1º de ESO, para actividades conjuntas.
- **Compartidos** (`Cls-Comp`, `Cls-EPComp`, `Cls-EIComp`): las cuentas de los iPads
  compartidos.
- **Accesos "por si acaso"**: TIC está metido en las clases de curso o en todas las
  tutorías para poder entrar cuando hace falta.

Propuesta (a confirmar con David) para que esto también se genere solo:

- Una clase de curso entero **por nivel dentro del alcance**, con todo su alumnado.
- Sus instructores, automáticos: **los tutores de ese nivel** (salen de `edu_tutorias`, que
  ya lleva el módulo de Tutorías) **+ el equipo TIC y dirección/jefatura** (salen de
  `auth_users` por rol).
- Un ajuste de "**profes fijos**": una lista corta de personas que se añaden a todas las
  clases de un tipo (todas las tutorías, o todas las de curso). Ojo al límite: **ASM admite
  12 instructores por clase**, y las tutorías de ESO ya van por 5-6.

Con eso, el mantenimiento anual de los accesos de TIC dejaría de ser "acordarse de
añadirse a mano en 35 tutorías".
