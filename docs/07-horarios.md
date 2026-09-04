# Horarios · pieza transversal · plan y modelo de datos

Los horarios del centro como **recurso compartido**, no como módulo de nadie. Nacen para
Puntualidad (deducir asignatura y profe del día + hora), pero el motivo de ponerlos en `0x-`
y no en `1x-` es que ya se sabe quién más los va a pedir: **sustituciones** (si un profe
falta, quién tiene guardia a esa hora), **documentación por clase**, y cualquier pantalla
futura que necesite saber qué pasa en un aula un martes a las 10:15.

> **La regla de oro de esta pieza es la separación en tres capas.** El error clásico al
> modelar horarios es meter profe + asignatura + hora en la misma fila (una "celda de Excel"
> por fila). Funciona para pintar el horario y se rompe con todo lo demás: en cuanto entran
> dos profes en un aula, un desdoble, una hora de guardia o una sustitución, hay que
> duplicar filas y ya no se sabe cuál es la buena. Aquí van separadas **la rejilla** (cuándo
> hay sesiones), **la asignación docente** (qué se imparte, quién y a quién) y **la
> colocación** (en qué hueco de la rejilla cae). Cualquier propuesta de cambio se mide con
> esa vara.

---

## Estado: 🟡 Fase 0 hecha (schema + permisos + helpers), sin pantallas

- **Modelo de datos diseñado y razonado** (este documento) y **13 tablas `hor_*` en
  `src/db/schema.ts`**, aditivas. SQL idempotente equivalente en `src/db/sql/horarios.sql`,
  con la semilla del catálogo de actividades (12 tipos de hora).
- **Permisos**: dos módulos, `horarios` y `horarios-profes` (ver decisión 5), más
  `puedeEditarHorarios()`. Con tests.
- **Helpers puros** en `src/lib/horarios.ts` con 264 tests en verde (`pnpm test`): periodo
  vigente por fecha y prioridad, rejilla por ámbito con precedencia, tramo que contiene una
  hora, tramo siguiente, lectiva con override, detección de conflictos y generador de
  rejillas regulares. `pnpm lint` y `pnpm build` pasan.
- **Base de datos aplicada** (2026-09-03): las 13 tablas `hor_*` están en Neon con sus 17
  claves ajenas, 33 índices y la semilla de 12 actividades. Verificado con una prueba de
  humo: periodo + rejilla de ESO + tramos del lunes + una asignación de Matemáticas de
  2ESO B con dos profes reales (titular y PT) colocada en la 3ª; se preguntó lo que
  preguntará Puntualidad —"un alumno llega el lunes 05-10-2026 a las 10:15, ¿a qué llega
  tarde?"— y devolvió la 3ª (09:50-10:45), Matemáticas, aula 14, lectiva, con los dos
  profes y su rol. También se comprobó que junio pisa al ordinario en sus fechas y que
  fuera de curso no hay periodo. Todo borrado después: la base quedó a 0 filas salvo la
  semilla.
- **Falta**: las pantallas (Fases 1-2), el importador (Fase 3, necesita un fichero real) y
  la demolición de `pun_subjects` (ver decisión 1).

## El vocabulario (importa, porque todo el modelo cuelga de aquí)

| Término | Qué es | Ejemplo real del centro |
|---|---|---|
| **Periodo de vigencia** | Un tramo de **fechas** del curso con sus propias rejillas y horarios | "Ordinario 2026-27" (15-sep → 31-may) · "Junio 2027" · "Septiembre 2026" |
| **Rejilla** | La plantilla de huecos: cuántas sesiones hay al día y a qué hora empieza y acaba cada una | "Primaria ordinaria" (6 sesiones de 45', desde las 8:00) · "Secundaria ordinaria" (55') |
| **Tramo** | **Un** hueco concreto de la rejilla: día + orden + hora inicio/fin | "Primaria ordinaria · viernes · 3ª · 09:30-10:10" |
| **Actividad** | Qué clase de hora es | clase · guardia · departamento · reunión · atención a padres · oratorio |
| **Asignación** | Qué se imparte, a qué grupo(s) y por qué profe(s). El "Unterricht" de Untis | "Matemáticas de 2ESO B, la da Ana, aula 14" |
| **Sesión** | Una asignación **colocada** en un tramo. Es la celda del horario | "Matemáticas 2ESO B → martes 3ª" |
| **Apoyo** | Un alumno concreto atendido por PT/AL en un tramo concreto | "A PT le saca a Marc los martes a 3ª de Lengua" |

El concepto de **rejilla es de Educamos** y se conserva tal cual a propósito: es el mismo
nombre que David y jefatura usan, y en Educamos también se pueden definir "distintas sesiones
de la materia para cada rejilla horaria" y "particularizar el profesor para cada sesión".
Untis lo llama *grid structure*; TES exige montarla bien **antes** de construir el horario.
Coincide con el orden de fases de aquí.

---

## Las tres capas, y qué problema resuelve cada una

### Capa 1 · La rejilla — `hor_periodos`, `hor_rejillas`, `hor_tramos`

El problema que resuelve: **primaria 45' desde las 8:00, secundaria 55', junio y septiembre
distintos, y algunos años los viernes de primaria distintos al resto de días.**

Tres decisiones de diseño que hacen que todo eso encaje sin casos especiales:

1. **El periodo de vigencia va por fechas, no por meses.** Nada de un enum
   `'ordinario' | 'junio' | 'septiembre'`: `fecha_inicio` y `fecha_fin` + `prioridad`. Es
   "normalmente junio y septiembre", y "normalmente" en un colegio significa que un año será
   del 1 al 19 de junio y otro año no. Con fechas y prioridad, el día que jefatura decida
   que el horario de junio arranca el 29 de mayo, es cambiar dos fechas en una pantalla, no
   una migración.

2. **Un tramo por (rejilla, día, orden)** — no un tramo por orden compartido entre los cinco
   días. Esto es exactamente lo que hace que "los viernes de primaria las sesiones son más
   largas o más cortas, habiendo el mismo número de sesiones" no sea un caso especial:
   el viernes tiene sus 6 filas con sus horas propias, dentro de la MISMA rejilla, y las
   sesiones del horario siguen refiriéndose al tramo por **orden** (la 3ª), no por hora.
   Un horario no se descoloca porque el viernes la 3ª empiece 10 minutos más tarde.
   El coste es escribir 5× las filas de una rejilla regular, y eso lo resuelve un botón
   ("copiar el lunes al resto de días") en la pantalla, no el modelo.

3. **Quién usa qué rejilla se resuelve por ámbito con precedencia**, en una tabla aparte
   (`hor_rejilla_ambitos`): centro → etapa → curso → curso+letra, y gana el más específico.
   Así lo normal (una rejilla por etapa) son 3 filas, y la excepción ("este año 4ESO sale
   media hora antes los jueves") es una fila más, no una rejilla duplicada.

```
hor_periodos          nombre, academic_year, fecha_inicio, fecha_fin, prioridad,
                      es_ordinario, notas, active
hor_rejillas          periodo_id, nombre, notas, active
hor_rejilla_ambitos   rejilla_id, etapa?, curso?, letra?     ← el más específico gana
hor_tramos            rejilla_id, dia_semana (1=lun..5=vie), orden, etiqueta ('1ª','Patio'),
                      hora_inicio 'HH:mm', hora_fin 'HH:mm',
                      tipo ('sesion'|'recreo'|'comedor'|'entrada'|'salida'|'otro')
                      UNIQUE (rejilla_id, dia_semana, orden)
```

Las horas van en **`text` 'HH:mm'**, no `time` ni `timestamp`: es hora de centro, sin zona
horaria, exactamente como ya se guarda `pun_records.hora` ("sin zona horaria, es hora de
centro"). Coherencia con lo que hay y cero bugs de UTC.

El **recreo es un tramo** (`tipo='recreo'`), no un agujero entre tramos. Cuesta una fila y
a cambio se puede decir "llegó tarde a 3ª, que empieza justo después del patio" y, el día
que Puntualidad quiera registrar retrasos tras el patio (apuntado en
`00-desarrollos-futuros.md`), el límite horario sale de la rejilla en vez de una constante
nueva.

### Capa 2 · La asignación docente — `hor_actividades`, `hor_materias`, `hor_asignaciones` (+2 puentes)

El problema que resuelve: **varios profes en la misma aula, horas que no son clase, horas
lectivas y no lectivas, y desdobles.**

Una **asignación** es "esto se imparte, a este grupo, por esta gente". Es la unidad que se
importa y la que se duplica de un año al siguiente. Los profes y los grupos van en tablas
puente porque los dos son **muchos**:

```
hor_actividades       codigo ('clase'|'guardia'|'departamento'|'reunion'|'tutoria'|
                              'atencion_padres'|'coordinacion'|'apoyo_pt'|'apoyo_al'|
                              'oratorio'|'libre_disposicion'|...),
                      nombre, lectiva (DEFECTO), cubre_sustitucion, requiere_grupo,
                      color, orden, active
hor_materias          nombre, abreviatura ('GEH'), etapa?, orden, active
hor_asignaciones      periodo_id, academic_year, actividad_id, materia_id?,
                      etiqueta?, lectiva? (override), aula?, notas,
                      origen ('importado'|'manual'), import_id?, active
hor_asignacion_grupos asignacion_id, curso, letra?, subgrupo?
hor_asignacion_profes asignacion_id, edu_teacher_id,
                      rol ('titular'|'apoyo'|'pt'|'al'|'practicas'), principal
```

Cuatro cosas que salen gratis de esta forma y no salen si se aplasta todo en una fila:

- **Dos profes en un aula** = dos filas en `hor_asignacion_profes`, con `rol`. No hay que
  decidir cuál de los dos "es" el de la clase: hay un `principal` para cuando haga falta uno
  (el destinatario del aviso de Puntualidad, p. ej.) y los demás siguen ahí.
- **Horas que no son clase**: la hora de guardia, la de departamento y la reunión son
  asignaciones con `actividad` distinta y **sin grupo y sin materia**. No hay tabla aparte
  ni columnas nullables sueltas: el horario de un profe es "sus asignaciones colocadas",
  sean clase o no. Una reunión de varias personas es **una** asignación con varios profes.
- **Lectiva / no lectiva**: `hor_actividades.lectiva` es el defecto del catálogo, y
  `hor_asignaciones.lectiva` (nullable) lo pisa cuando toque. Es exactamente el matiz que
  planteó David: "algunas reuniones no son lectivas, pero otras sí se suceden en horas
  lectivas". Con un solo booleano en el catálogo no se podría decir.
- **Desdobles y agrupaciones**: media clase en Religión y media en Valores son dos
  asignaciones con el mismo `curso`/`letra` y `subgrupo` distinto; una optativa que junta a
  1ESO A y 1ESO B es **una** asignación con dos filas en `hor_asignacion_grupos` (el
  *coupling* de Untis). Los dos casos caen solos.

Los grupos se identifican por **`curso` + `letra` en texto**, como en todo el repo
(`edu_tutorias`, `pun_records`, `abc_*`). No se inventa aquí una tabla `edu_clases`: eso es
territorio de la [fuente única de alumnado](./06-fuente-unica-alumnado.md) y hacerlo por la
puerta de atrás en horarios sería justo el tipo de duplicación que causó los cuatro
incidentes de 2026.

### Capa 3 · La colocación — `hor_sesiones`

```
hor_sesiones          asignacion_id, tramo_id,
                      dia_semana, orden      ← desnormalizados, para pintar la cuadrícula
                      semana?  (null = todas; 'A'/'B' si algún día hay ciclo quincenal)
                      aula?    (override del de la asignación)
                      UNIQUE (asignacion_id, tramo_id)
```

Aquí no hay unicidad por grupo ni por profe **a propósito**: dos sesiones del mismo grupo en
el mismo tramo es un desdoble legítimo, y dos del mismo profe es un error de verdad. La
diferencia la sabe el negocio, no una constraint. Va como **informe de conflictos** en el
importador y en la pantalla (profe en dos sitios · grupo con dos clases sin subgrupo · aula
doblemente ocupada), que además es lo que se necesita para revisar un horario recién
importado.

`semana` está de más hoy (el centro es de ciclo semanal de 5 días) y va igualmente: es una
columna nullable que no molesta a nadie y evita una migración el día que alguien monte algo
quincenal. Los ciclos de 2 semanas son el segundo caso más común en las herramientas de
horarios.

### Capa 4 · Apoyos individuales — `hor_apoyos`

Al confirmar David que **PT y AL vienen en el fichero como profesores normales**, esta capa
se encogió a la mitad, que es justo lo que se quiere. Su horario **son asignaciones
corrientes** de las capas 2-3 (con actividad `apoyo_pt` / `apoyo_al`): entran por el
importador como cualquier otro profe y se ven en la cuadrícula sin nada especial.

Lo que el fichero **no** trae, y por eso es lo único que queda aquí, es **a qué alumnos
concretos** afecta cada una de esas horas. Eso se mete a mano desde orientación:

```
hor_apoyos            asignacion_id, edu_student_id,
                      modalidad ('dentro' = entra al aula | 'fuera' = lo saca del aula),
                      sale_de_asignacion_id?  ← de qué clase se lo llevan
                      fecha_inicio?, fecha_fin?, notas, active
```

El profe y la hora salen de la asignación, así que no se duplican en ninguna parte. Y tres
detalles que valen mucho después: `modalidad` distingue al PT que entra a apoyar dentro del
aula del AL que se lleva al alumno fuera; `sale_de_asignacion_id` dice **qué clase se
pierde** ese alumno, que es la pregunta que hará orientación en junio ("¿a Marc siempre le
estamos quitando Lengua?"); y las fechas están porque estos apoyos se reorganizan a mitad de
curso, con lo que el histórico no se borra al cambiarlos.

Si algún día hay un apoyo que no viene en ningún fichero, no hace falta nada nuevo: se crea
la asignación a mano (`origen='manual'`, que el modelo ya soporta) y se le cuelgan sus
alumnos igual.

---

## Lo que esto habilita (y por qué se modela así ahora)

- **Puntualidad, Fase 4** (ya en su checklist): `fecha` + `hora` → periodo por fecha → rejilla
  del grupo → tramo que contiene la hora → sesión del grupo → materia y profe principal.
  Se apaga la elección de asignatura a mano y se enciende `htmlAvisoProfeAsignatura`, que
  está escrito y esperando.
- **Sustituciones** (módulo futuro): con estas capas la pregunta "¿quién puede cubrir 3ª del
  martes?" es una consulta, no un algoritmo: profes **sin** sesión en ese tramo, o con una
  sesión cuya actividad tenga `cubre_sustitucion` (la guardia). Y qué hay que cubrir sale de
  `hor_actividades.lectiva`. Las tablas que faltarían son solo dos (`hor_ausencias` y
  `hor_sustituciones`, ausencia de un profe en unos tramos de un día + quién la cubre) y no
  tocan nada de lo de arriba. **No se construyen ahora.**
- **Documentación por clase**: "los papeles de 2ESO B" cuelgan de `curso`/`letra` como en el
  resto del repo, y el horario da el contexto (quién entra, cuándo).
- **Duplicar de un año al anterior**: todo cuelga de `hor_periodos`, así que duplicar es
  **copiar un periodo en profundidad** (rejillas + tramos + ámbitos, y opcionalmente
  asignaciones y sesiones) cambiando `academic_year`. Un botón, no un import. Es la petición
  explícita de David ("tiene que ser muy fácil sacarlas del año anterior y duplicarlas") y
  es la razón de que el periodo esté en la raíz del modelo y no como columna suelta.

---

## Importación (el diseño, no el parser)

El parser se escribe cuando llegue el primer fichero real. Lo que sí se puede fijar ya:

- **SheetJS (`xlsx`)** y detección de columnas por **cabecera normalizada**, nunca por
  posición — igual que el sync de Educamos (`04-convenciones-tecnicas.md`).
- **Dos formas posibles del export**, y las dos se normalizan a la misma lista antes de
  tocar la BBDD:
  - **Matriz**: filas = sesiones, columnas = días, una hoja por clase o por profe. Es lo que
    suelta la mayoría de generadores al "imprimir a Excel". Hay que leer la celda
    ("MAT / 2ESOB / ALP") y partirla, y ahí es donde se pierde información.
  - **Lista larga**: una fila por sesión (día, orden, grupo, materia, profe, aula). Es la
    forma buena. **Si el generador o Educamos puede sacar esto, se pide esto** — ahorra la
    mitad del importador y casi todos los errores.
- **El horario de profes y el de clases tienen que converger en las MISMAS asignaciones.**
  Es el punto que más fácil se rompe: si se importan por separado, sale un horario duplicado
  y ninguna de las dos copias es la buena. La clave de reconciliación es
  `(periodo, grupo(s), materia, tramo)`; la hoja de profesores no crea asignaciones nuevas,
  **añade filas a `hor_asignacion_profes`** sobre las que ya existen. Y lo que aparece solo
  en la hoja de profes (guardias, departamento, reuniones) sí crea asignaciones, pero sin
  grupo — que es justo lo que son.
- **`hor_alias`**: tabla de traducción de los códigos del fichero a nuestros IDs
  (`tipo` 'profe'|'materia'|'grupo', `codigo_externo`, id destino). Aquí vive el 90% del
  dolor de un importador: el generador dirá `ALP` y `2ESOB`, y nosotros tenemos
  `edu_teachers.alias` y `curso`+`letra`. Con esta tabla, la segunda importación y todas las
  siguientes son automáticas: solo se pregunta por los códigos nuevos.
- **Patrón vista previa → confirmar**, y bitácora en `hor_import_runs` con el resumen
  (altas/cambios/conflictos/errores), calcado de `edu_sync_runs`. Nada de importar a ciegas
  sobre un horario que ya está en uso.
- El fichero de horarios **no se commitea** (lleva nombres de profesorado): gitignore
  primero, trabajar después, borrar al terminar.

---

## Decisiones cerradas (2026-09-03, con David)

1. **`hor_materias` es el catálogo bueno; `pun_subjects` se muere.** No hay históricos de
   Puntualidad todavía, así que David autoriza cargarse la tabla en vez de arrastrarla.
   **Pero no se hace hasta la Fase 1**, y a propósito: `pun_subjects` alimenta hoy los chips
   del formulario, el panel de asignaturas, el dashboard por asignatura y el CSV (≈90
   referencias en 14 ficheros del módulo). Demolerla antes de que exista la pantalla de
   materias de horarios dejaría a Puntualidad sin catálogo editable unos días, sin ganar
   nada. Orden: primero la pantalla de `hor_materias` (Fase 1), después la migración de
   Puntualidad en su propio commit.
2. **Etapas: EI, EP y ESO activas; BACH, CFGM y CFGS previstas y desactivadas.** Están en
   `ETAPAS_HORARIO` con su `active`. La resolución de etapa para horarios vive en
   `etapaDeCursoHorario()` y **no** en `cursos.ts`: ampliar el tipo `Etapa` compartido
   obligaría a inventar reglas de promoción (`cursoSiguiente`) y de banco de libros
   (`cursoEnBanco`) para etapas que aún no existen, tocando dos módulos en producción por
   nada. Cuando esas etapas lleguen de verdad, se sube con sus reglas.
3. **PT y AL vienen en el fichero como profesores normales.** Esto simplificó el modelo:
   su horario son asignaciones corrientes (con `hor_actividades` 'apoyo_pt' / 'apoyo_al'),
   y `hor_apoyos` se queda solo con lo que el fichero NO trae — **qué alumnos concretos**
   toca cada una, a mano desde orientación. La tabla cuelga de la asignación, así que el
   profe y la hora salen de ahí y no se duplican.
4. **Permisos: dos módulos separados, no uno.** Petición literal de David, y tiene razón:
   - `horarios` → ver el horario de las **clases**. Lo tienen todos los roles del claustro.
   - `horarios-profes` → ver el horario de un **profesor**. Va aparte para poder quitárselo
     a alguien sin quitarle lo anterior ("a mí me has puesto…"). Hoy lo traen dirección,
     jefatura y orientación.
   - **Editar** (rejillas, importar, asignaciones) es cuestión de rol, no de módulo:
     `puedeEditarHorarios()` — dirección, jefatura y TIC. Tener el módulo da vista, no lápiz.

### Sigue pendiente

- 🟡 **Días especiales** (un día suelto con rejilla propia: media jornada, día del colegio,
  festivos). Sin respuesta y **no bloquea**: es una tabla chica y aditiva (`hor_dias_especiales`:
  fecha, tipo, rejilla_id?) que se añade el día que se quiera. No la creo por si acaso.
- 📥 **El export real de horarios** de al menos una etapa. Sin él no se escribe la Fase 3.

## Plan técnico

### Datos (`src/db/schema.ts`, prefijo `hor_*`)

| Tabla | Para qué |
|---|---|
| `hor_periodos` | Tramo de fechas con horario propio (ordinario / junio / septiembre), con prioridad |
| `hor_rejillas` | Plantilla de huecos de un periodo |
| `hor_rejilla_ambitos` | A quién aplica cada rejilla (centro / etapa / curso / curso+letra), gana el más específico |
| `hor_tramos` | Un hueco: rejilla + día + orden + horas + tipo (sesión, recreo…) |
| `hor_actividades` | Catálogo de tipos de hora, con `lectiva` y `cubre_sustitucion` |
| `hor_materias` | Catálogo de asignaturas compartido (ver decisión 1) |
| `hor_asignaciones` | Qué se imparte (actividad + materia + aula + periodo) |
| `hor_asignacion_grupos` | A qué grupo(s)/subgrupo(s) va |
| `hor_asignacion_profes` | Qué profe(s), con rol y `principal` |
| `hor_sesiones` | La celda: asignación colocada en un tramo |
| `hor_apoyos` | Qué alumnos concretos toca una asignación de PT/AL (lo único que no viene en el fichero) |
| `hor_alias` | Traducción de códigos del fichero externo a nuestros IDs |
| `hor_import_runs` | Bitácora de importaciones (como `edu_sync_runs`) |

Futuras, **no en este alcance**: `hor_ausencias` y `hor_sustituciones`.

### Código

```
src/lib/horarios.ts             # helpers puros: periodo vigente por fecha, resolución de
                                #   rejilla por ámbito, tramo que contiene una hora,
                                #   detección de conflictos, schemas Zod
src/lib/horarios-server.ts      # queries: horario de un grupo, de un profe, quién libre
src/lib/horarios-import.ts      # normalización matriz/lista larga → sesiones + alias
src/components/horarios/*       # cuadrícula (grupo y profe), editor de rejillas
src/app/gestion/horarios/       # navegador (grupo · profe · rejillas · importar)
src/app/api/horarios/admin/...  # endpoints con guard de módulo
```

La cuadrícula es lo único con enjundia en el front: se pinta desde los **tramos** de la
rejilla (filas) × días (columnas), y las sesiones se colocan por `dia_semana` + `orden`. Por
eso están desnormalizados en `hor_sesiones`: pintar el horario de una clase no debería
necesitar tres joins.

---

## Fases

### Fase 0 · Decisiones y cimientos — ✅
- [x] Confirmar con David las decisiones de arriba (ver "Decisiones cerradas")
- [x] Tablas `hor_*` en `src/db/schema.ts` (aditivas) + SQL idempotente en `src/db/sql/horarios.sql`
- [x] Módulos `horarios` y `horarios-profes` en la matriz de permisos + `puedeEditarHorarios()`, con tests
- [x] Helpers puros con tests: periodo vigente por fecha y prioridad, rejilla por ámbito con
      precedencia, tramo que contiene una hora y el siguiente, lectiva con override,
      conflictos (profe / grupo con desdobles / aula) y generador de rejillas regulares
- [x] Tablas aplicadas en Neon (2026-09-03, vía el conector de Neon). Verificado: 13 tablas,
      17 claves ajenas, 33 índices y 12 actividades, más la prueba de humo de extremo a
      extremo descrita en "Estado". **Ojo**: `psql` no sirve desde una sesión de agente —
      el sandbox solo deja salir por HTTPS y Postgres va por el 5432; hay que usar el
      conector de Neon
- [ ] Ver un export real de horarios de una etapa (CSV/XLSX) y anotar aquí su forma real (**David**)

### Fase 1 · Rejillas y materias — ⬜
- [ ] Pantalla de materias (`hor_materias`) y **migración de `pun_subjects`** (decisión 1)
- [ ] Pantalla de periodos de vigencia (fechas + prioridad + duplicar del año anterior)
- [ ] Editor de rejilla: sesiones, horas, tipo, con "copiar el lunes al resto de días"
- [ ] Ámbitos (a qué etapa/curso aplica cada rejilla) y aviso si un grupo se queda sin rejilla
- [ ] Semillas: primaria (45' desde 8:00) y secundaria (55'), con los datos reales

### Fase 2 · Navegador de horarios — ⬜
- [ ] Cuadrícula por clase (día × sesión) con materia, profe(s) y aula
- [ ] Cuadrícula por profe, con las horas no lectivas marcadas
- [ ] Selector de periodo de vigencia y de fecha ("qué había el 12 de junio")
- [ ] Informe de conflictos y de huecos

### Fase 3 · Importación — ⬜
- [ ] Normalizador matriz / lista larga → lista de sesiones (helper puro con tests)
- [ ] Resolución de códigos vía `hor_alias`, preguntando solo por los nuevos
- [ ] Vista previa → confirmar, con bitácora en `hor_import_runs`
- [ ] Reconciliación de la hoja de profes sobre las asignaciones ya importadas
- [ ] Importación de rejillas, si el fichero las trae

### Fase 4 · Enganche con Puntualidad — ⬜
- [ ] `materiaYProfeEn(grupo, fecha, hora)` y su uso al registrar un retraso
- [ ] Encender `htmlAvisoProfeAsignatura` (ya escrito) — cierra la Fase 4 de [`17`](./17-puntualidad.md)

### Fase 5 · Apoyos PT/AL — ⬜
- [ ] Alta a mano de alumnos sobre las asignaciones de PT/AL ya importadas, con modalidad
      (dentro/fuera) y de qué clase sale
- [ ] Verlos en la cuadrícula del grupo y en la ficha del alumno
