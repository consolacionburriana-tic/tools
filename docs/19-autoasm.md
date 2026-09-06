# AUTOASM · Apple School Manager · plan y checklist

Módulo para **generar, revisar y descargar los seis CSV que importa Apple School Manager**
(el "SIS CSV" de Apple), que hasta ahora se montaban a mano en Excel una vez al año y en
cada alta o baja de mitad de curso. Sale de la sesión del 5-sep-2026 con los ficheros
reales del curso en la mano.

Rutas: `/gestion/autoasm` (portada del estudio) y `/gestion/autoasm/<fichero>` (explorador).
Acceso: **TIC, SuperTIC, Dirección y Jefatura** (`autoasm` en `src/lib/permissions.ts`).

---

## Estado: plan funcional ✅ · plan técnico ✅ · implementado ✅ (2026-09-05 · ampliado 2026-09-06)

Depende de la BBDD central (`edu_students`, `edu_teachers`) para las personas, de
`edu_tutorias` y `auth_users` para saber quién entra solo en cada clase, y de `hor_*` para
las clases y sus profes. No crea tablas nuevas: el proyecto de trabajo vive en el
navegador (ver decisiones).

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

La validación del módulo, pasada por los ficheros reales, sacó esto. David decidió
(6-sep) **no arreglar el fichero viejo**: el de este curso se genera de cero y sale limpio
por construcción (duplicados fuera, correos en minúsculas, `Cls-TValESO1` con su nombre).
Queda aquí como registro de qué había:

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

### Las clases salen del horario (2026-09-06)
Cada **asignación docente** de `hor_*` es una clase de ASM: la materia da el nombre,
`hor_asignacion_profes` los instructores y `hor_asignacion_grupos` quién se matricula. Así
la asignatura conjunta (Música de 3º PDC con 3º A) sale sola, y el año que Inglés deje de
serlo, se parte sola. Con dos cautelas que hacen que sea una **propuesta revisable** y no
una aplicación a ciegas:

1. **De una clase que ya existe no se toca ni el `class_id` ni el `course_id`**: si
   cambian, ASM no renombra, crea otra clase. Solo se actualizan profes y matrículas.
2. **Un hueco en el horario no vacía una clase**: si una asignación no trae profesorado, la
   clase se queda con el que tenía y se avisa.

El emparejamiento asignación ↔ clase se recuerda en el proyecto (`ProyectoAsm.horario`)
para que el año siguiente no haya que adivinarlo. Los **desdobles** (subgrupo) no generan
matrícula automática: media clase no se puede deducir, y se dice.

### Nadie se borra: se archiva (2026-09-06)
Cuando alguien deja el centro, quitarlo del fichero hace que ASM **se lleve por delante su
cuenta y su iCloud**. Así que el sync no borra a nadie: lo **archiva**. La persona sigue en
`students.csv`/`staff.csv` (la cuenta vive), sale de todas sus clases y matrículas, y
desaparece de las pantallas salvo que se pida verla. Dar de baja de verdad existe, es lo
único destructivo del módulo, y pregunta dos veces.

### Los iPads compartidos son una lista propia (2026-09-06)
Las cuentas de iPad compartido (`aluprimaria7`, "Alu Primaria 7"…) no vienen de Educamos.
Se reconocen solas al importar el CSV anterior (por su `grade_level` de compartidos o por
su identificador), quedan marcadas en el proyecto y **el sync no las toca ni las archiva
nunca**. La lista se edita a mano desde la ficha de cada cuenta.

### Quién entra solo en cada clase (2026-09-06)
- En **todas las tutorías**, el equipo **TIC**.
- En las clases de **curso entero**, los **tutores de ese nivel** (de `edu_tutorias`) + TIC
  + **dirección y jefatura** (de `auth_users`, por rol: no hay una segunda lista que
  mantener).
- ASM admite **12 instructores por clase**. Si no caben, se cae **primero dirección y
  jefatura; TIC nunca**, y se dice en qué clases ha pasado.

### Los ficheros salen limpios, siempre (2026-09-06)
Después de cada acción —no solo al descargar— se normaliza la salida: **correos en
minúsculas**, **sin matrículas repetidas**, sin espacios sobrantes y con los `roster_id`
correlativos. Lo que se ve en el explorador es exactamente lo que se va a subir.

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
src/lib/autoasm-construir.ts    # BBDD central → filas: sync, archivado, matrículas, profes automáticos
src/lib/autoasm-horario.ts      # asignaciones docentes → clases de ASM (propuesta y aplicación)
src/lib/autoasm-server.ts       # las tres lecturas: personas, equipos (tutorías + roles) y horario
src/app/api/autoasm/admin/centro/route.ts    # GET protegido con hasModule('autoasm')
src/app/api/autoasm/admin/horario/route.ts   # ídem, las asignaciones del periodo en vigor
src/app/gestion/autoasm/…       # portada (estudio) y explorador por fichero
src/components/autoasm/…        # estudio, explorador, subida, descargas, store de proyecto
src/lib/__tests__/autoasm.test.ts + autoasm-horario.test.ts   # 58 tests con datos inventados
```

- La **validación** (`validarProyecto`) mira lo mismo que ASM: campos obligatorios, claves
  repetidas, `person_id` único entre alumnado y profesorado, correos y usuarios sin
  duplicar, `password_policy` válida, y todas las referencias cruzadas (curso de una clase,
  instructor en staff, clase y alumno de cada matrícula). Cada incidencia lleva un `tipo`
  para poder agrupar 300 filas iguales en una línea.
- El **ZIP** se genera en el navegador con `jszip` (ya era dependencia) e incluye un
  `LEEME.txt` con el recuento, el separador usado y cómo se sube.
- El **explorador** resuelve los identificadores a nombres (`Cls-MatESO1A` → "Matemáticas ·
  ESO 1A"), los hace navegables entre ficheros, esconde las columnas vacías y las cuentas
  archivadas, y deja archivar, marcar como iPad compartido o dar de baja desde la ficha.
- La **limpieza de salida** (`limpiarArchivos`) se aplica tras cada acción, no solo al
  descargar.

## Cómo se traduce el horario a clases de ASM

| ASM | Horarios (`hor_*`) |
|---|---|
| Una **clase** (`classes.csv`) | Una **asignación docente** lectiva de tipo `clase` |
| `class_number` | `hor_materias.nombre` |
| **Instructores** | `hor_asignacion_profes`, el `principal` primero (máx. 12) |
| **Matrículas** (`rosters.csv`) | El alumnado de los grupos de `hor_asignacion_grupos` |
| `course_id` (solo en clases nuevas) | El curso del grupo; si son varios grupos del mismo nivel, el curso de nivel entero (`ESO1`) |

Lo que el módulo **no** deduce y deja como aviso: los **desdobles** (un subgrupo es media
clase: quién entra hay que decirlo a mano), el profesorado que no tenga cuenta en
`staff.csv`, y las clases de ASM que el horario no menciona (compartidos, clases de curso
entero…), que se quedan como están.

Estado del origen: `hor_*` tiene **infantil y primaria** importados; **falta secundaria**
(ver [`07-horarios.md`](./07-horarios.md)). O sea que hoy el horario ya alimenta 5º y 6º de
primaria —que es lo que entra en ASM de primaria— y ESO entrará en cuanto se importe.

## Las clases que no salen de ninguna asignatura

Tres tipos de clase existen por otros motivos, y por eso se mantienen a mano o por regla:

- **De curso entero** (`Cls-ESO1`, `Cls-EP5`…): un sitio donde a un profe le salen TODOS
  los alumnos de 1º de ESO, para actividades conjuntas. Sus profes se ponen solos (ver
  "Quién entra solo en cada clase").
- **Compartidos** (`Cls-Comp`, `Cls-EPComp`, `Cls-EIComp`): los iPads compartidos con sus
  cuentas propias.
- **Tutorías de infantil y primaria 1-4**: siguen existiendo aunque su alumnado no entre en
  ASM (decisión de David, 6-sep): son la clase que sus profes ven en el iPad.

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

### Fase 4 · Desde el horario y cuentas con historia ✅ (2026-09-06)
- [x] Clases, profes y matrículas propuestos desde las asignaciones docentes de `hor_*`
- [x] Emparejamiento asignación ↔ clase recordado en el proyecto (no duplica clases en ASM)
- [x] Panel de propuesta: qué se crea, qué cambia y qué avisos hay, antes de tocar nada
- [x] Profes automáticos: TIC en las tutorías; tutores + TIC + dirección en las de curso,
      con el tope de 12 de ASM (se cae dirección antes que TIC)
- [x] Archivar en vez de borrar, con baja definitiva a dos confirmaciones
- [x] Cuentas de iPad compartido reconocidas y protegidas del sync
- [x] Salida siempre limpia: minúsculas, sin matrículas repetidas, `roster_id` correlativos

### Fase 5 · Pendiente de David
- [ ] Subir a ASM un ZIP generado por el módulo y confirmar que lo traga sin quejarse
- [ ] Importar el horario de **secundaria** en `hor_*`: hasta entonces, las clases de ESO
      siguen viniendo del ZIP del curso pasado o a mano
- [ ] Revisar los desdobles (Religión/Valores) a mano tras aplicar el horario

---
