# Alumnado · la ficha de cada alumno

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (navegador, ficha, protección
de datos, pestañas de banco de libros / AMPA / venta de materiales e informes a medida, todo
probado contra datos reales el 23-sep-2026; queda quitar `pd_firmada` de Neon tras el
despliegue — ver la Fase 3)

Pantalla de consulta de `/gestion/alumnado`: eliges una clase (o buscas), tocas a un alumno y
tienes **todo lo que la plataforma sabe de él** en una sola vista, con lo importante arriba y
todo lo copiable a un toque.

Es **transversal y casi todo de solo lectura**: no crea tablas ni duplica campos, lee `edu_*`
como identidad y va a preguntar a cada módulo por lo suyo. Lo único que se escribe desde aquí
son los interruptores que ya vivían en `edu_students` (protección de datos, banco de libros
y AMPA), llamando al mismo código que su módulo y con su mismo permiso: la ficha **condensa la
información, no se queda con la autoridad**. La excepción, desde el 23-sep-2026, es la **venta
de materiales** (decisión 15): esa sí tiene sus dos tablas `mat_*`, porque no es un dato de la
ficha de nadie sino columnas que se crean y se quitan cada curso. Nada se copia a una tabla nueva, que es
exactamente la deuda que documenta
[`06-fuente-unica-alumnado.md`](./06-fuente-unica-alumnado.md).

---

## Decisiones cerradas

1. **El orden de la pantalla es la decisión de diseño.** De arriba abajo, por cuántas veces al
   año alguien abre la ficha para eso:

   | | Bloque | Por qué ahí |
   |---|---|---|
   | 1 | **Quién es** — nombre, clase, nº de lista, tutores, edad, cumpleaños | La cabecera; confirma que has abierto a quien querías |
   | 2 | **Lo que hay que saber ya** — chips de banco de libros, licencias, AMPA, retrasos, ABC, apoyos | Es la pregunta que se hace de pie en la puerta del aula |
   | 3 | **A quién llamo** — familias con llamar / WhatsApp / correo / copiar | El uso más frecuente, y por eso va **antes** que los identificadores |
   | 4 | **Identificadores** — NIA, DNI, nombre legal, nacimiento, tarjeta sanitaria, código, matrícula | El segundo uso: rellenar un formulario de fuera |
   | 5 | **Familia y casa** — hermanos en el centro y domicilio | Contexto, no urgencia |
   | 6 | **Historial** — lo de cada módulo, **plegado** | Consulta en frío; desplegado empujaría el contacto fuera de la pantalla de un iPad |

2. **Copiar es un toque sobre el propio valor.** El botón es el dato entero, no un icono de
   16 px al lado: en iPad, un objetivo de 16 px es un objetivo que se falla. Confirma cambiando
   el texto por «copiado» y con un haptic, **sin toast** — un toast por cada NIA copiado sería
   insufrible. Hay respaldo con `execCommand` porque `navigator.clipboard` no existe fuera de
   contexto seguro y los iPads del colegio entran por IP local más de lo que parece.

3. **Las clases son un carril fijo y a lo ancho, no un desplegable.** Son 28 y son las mismas
   todos los años (decisión de David), así que caben a la vista. Va arriba y a todo lo ancho:
   dentro de la columna de la lista ocupaba diez filas y dejaba la lista bajo el pliegue.
   **Sin clase elegida se ve el centro entero**, para que la pantalla nunca esté muerta.

4. **La lista entera viaja en el HTML.** 639 alumnos son ~90 KB de texto, así que buscar y
   cambiar de clase no cuesta ni una petición: se filtra en memoria y se pinta en el mismo
   frame. La ficha, que sí es cara (13 preguntas a Neon), se pide al abrirla y se queda en una
   caché del cliente: ir y venir entre dos hermanos es instantáneo.

5. **`?alumno=<id>` se resuelve en el servidor.** Quien abra un enlace a una ficha, o recargue,
   recibe el HTML con la ficha dentro: sin parpadeo y sin petición extra. El botón «atrás» se
   atiende con un `popstate`, no con un efecto que dispare `fetch` en cada render.

6. **El alcance es la ETAPA, no la tutoría** (David, 10-sep-2026). Un tutor de 1º de ESO
   puede consultar a cualquier alumno de Secundaria, y **entra ya en su propia tutoría**, que es
   lo que quiere el 90% de las veces. El motivo: a diario hacen falta datos de alumnado que no
   es el tuyo —una guardia, una salida, un correo a una familia de otra clase— y tener que
   pedírselo a otro tutor no protege nada. Lo que **no** cruza es la etapa: quien lleva Infantil
   no tiene por qué ver las fichas de la ESO.

   La etapa sale de `edu_teachers.etapa` y, si está en blanco, de las etapas de sus tutorías de
   este curso. Sin ninguna de las dos cosas no se ve nada, y la pantalla lo dice con un aviso
   que manda a hablar con TIC (hoy hay 10 profes activos sin etapa asignada).

   > Ojo: esto es **más ancho que el alcance de Puntualidad**, que sigue siendo por tutoría, y es
   > a propósito. Allí se registran y se corrigen datos de un alumno; aquí solo se consultan.

   Dirección, jefatura, orientación, secretaría y TIC ven el centro entero. El alcance se
   comprueba **tres veces**: al montar el listado, al pintar `?alumno=` en el servidor y en la
   ruta API — y en la API un alumno fuera de alcance devuelve **404, no 403**: quién está en cada
   clase tampoco es información que deba dar esa ruta a quien no le toca.

7. **Los bloques sin datos no se pintan como tarjeta vacía.** Desaparecen, o se quedan en una
   línea gris. Una ficha de infantil tiene la mitad de secciones que una de 4º de ESO y tiene
   que verse igual de acabada. Hoy Puntualidad, Evaluaciones y Apoyos están a cero porque el
   curso acaba de empezar: la ficha lo dice en una línea.

8. **Al tutor legal fallecido no se le ofrece contacto.** Educamos lo marca (`FALLECIDO TUTORn`)
   y hay uno en el listado real. Se enseña la relación, pero sin botones de llamar ni escribir:
   que la app invite a llamar a alguien que ha muerto es el tipo de fallo que no se puede
   permitir.

9. **Protección de datos: cuatro permisos tri-estado, y viven en `edu_students`**
   (David, 17-sep-2026). Son los cuatro que firma la familia al matricular:

   | Campo | Qué autoriza |
   |---|---|
   | **Imagen y voz** | Que se le hagan fotos y vídeos en actividades del colegio |
   | **Redes y web** | Publicarlas en la web y las redes del colegio |
   | **AMPA** | Que el AMPA publique fotos suyas en sus canales |
   | **ONG** | Cesión a la ONG (MCM) para sus materiales y campañas |

   Cada uno vale **sí · no · no consta**. El **punto de partida es «sí a todo»** (David,
   17-sep-2026): el SQL de estreno pone los cuatro a `true` en el alumnado activo, las altas
   nuevas entran igual (`DEFAULT true`) y a partir de ahí **se marcan los noes según
   llegan**, que es como trabaja el colegio de verdad. El `null` no desaparece: se queda
   para lo que alguien desmarque a mano, y la pantalla lo pinta como «sin constar».

   Hubo un quinto campo, `pd_firmada` («documento firmado»), que **se quitó el 23-sep-2026**
   (David: «el de firmado se va fuera, en la UI y en la BBDD»). No se llegó a usar: estaba a
   `false` en las 645 filas.

   Van como columnas `pd_*` de `edu_students`, no en una tabla nueva: es un dato por alumno
   que no tiene histórico ni pertenece a ningún módulo, igual que `banco_libros` y `ampa`.
   Se guarda además **quién** lo cambió y **cuándo** (`pd_actualizado_por` / `_at`): esto es
   la voluntad de una familia, y tiene que poder rastrearse.

   Ojo con el nombre: el permiso `pd_ampa` («que el AMPA publique fotos») **no es**
   `edu_students.ampa` («la familia es socia del AMPA»). Se llaman igual y son dos cosas
   distintas; las dos se editan desde esta pantalla, en bloques separados.

10. **La protección de datos se ve más cerrada que el resto de la ficha** (David,
    17-sep-2026): dirección, jefatura, orientación, secretaría y TIC la ven de todo el
    centro; **un tutor solo la de su tutoría**, no la de toda su etapa. Sí, es una regla
    distinta a la de la decisión 6, y es a propósito: lo demás son datos de gestión diaria
    (a quién llamo, qué NIA tiene) y esto es la voluntad firmada de una familia sobre la
    imagen de su hijo. Quien la necesita es quien va a publicar la foto de su clase.

    Y **editarla es aún más estrecho**: secretaría, dirección y TIC. Ellos guardan los
    papeles. Un tutor la ve y no la toca, porque si cada uno pudiera cambiarla el dato
    dejaría de significar «lo que hay firmado» para significar «lo que le pareció a alguien».
    Lo que no le toca a quien mira **no se le manda por la red**, no se esconde con CSS: la
    API la quita de la respuesta (`fichaVisible`).

11. **Banco de libros y AMPA se editan también desde aquí, con el permiso de su módulo.**
    Era la petición de David: «que se pueda ajustar en su módulo concreto, pero el de
    alumnos condense toda la información». La ruta de la ficha llama a `setBanco`/`setAmpa`
    del banco de libros —los mismos, que además propagan el banco al snapshot de la campaña
    de Licencias— y exige lo mismo que su panel (`puedeGestionarParticipantesBanco`:
    dirección/TIC **con** el módulo del banco). Quien no lo tenga, los ve como chips y no
    ve interruptores.

12. **La pantalla tiene varias vistas: fichas y tablas por clase** (David, 17-sep-2026; las
    de banco, AMPA, materiales e informes, 23-sep-2026). La ficha responde por una persona; llenar esto son 639 alumnos × 5
    casillas, y eso no se hace ficha a ficha. La pestaña «Protección de datos» enseña la
    clase elegida como tabla —una fila por alumno, una columna por permiso— con:

    - **un toque por celda**, que cicla sí → no → sin constar;
    - **«todos sí» y «todos no» en la cabecera de cada columna**, que es lo que se pidió por
      columna: entra una autorización nueva y se resuelve sin bajar por las 25 filas;
    - **«Poner todo a SÍ»** para la clase entera.

    Todo lo masivo pide **un segundo toque** y en él dice a cuántos va a afectar: cambiar 25
    fichas sin querer es un mal rato, y el segundo toque cuesta medio segundo. Y el alcance
    no se cree lo que venga en la petición: la ruta masiva lee en la BBDD las clases de esos
    ids y descarta lo que no le toque a quien pulsa.

13. **Protección de datos en dos columnas, no en cinco** (David, 23-sep-2026). La tabla se ve
    con un **check general sí / no** y la **desestimación del correo del alumno**; las cuatro
    de detalle (imagen, redes, AMPA, ONG) se despliegan con un toque en la cabecera.

    - La general **no es un dato guardado**: se deduce de los cuatro (`generalProteccion`).
      Sí = los cuatro sí; no = los cuatro no; **«parcial»** en ámbar si hay algún no suelto,
      que es la señal de que hay que desplegar; gris si falta algo por marcar. Un toque la
      pone toda a sí (o toda a no si ya estaba a sí). Guardarla aparte sería tener dos
      verdades que sincronizar, el error de [`06`](./06-fuente-unica-alumnado.md).
    - **Desestimación del correo** (`pd_desestima_correo`): la familia no quiere que el
      colegio le dé cuenta de correo al alumno. Por defecto **nadie desestima**, y eso es lo
      verde; desestimar sale en **rojo**. En la ficha sale de coletilla en el chip de
      protección de datos («sin correo del alumno»), sin cambiar su color: no tiene que ver
      con las fotos, pero quien abre la ficha tiene que enterarse.

14. **Banco de libros y AMPA también en tabla, «solo marcar el check»** (David, 23-sep-2026).
    Una columna, un check por alumno, «todos sí / todos no» con segundo toque. En cada una se
    puede **sacar la otra al lado** (en la del banco, el AMPA; y al revés), porque a principio
    de curso se piden juntas. Mismo permiso que la ficha y que el panel del banco:
    dirección/TIC con el módulo del banco. **El AMPA ya no se lleva desde el banco de libros**:
    solo desde aquí.

15. **Venta de materiales** (David, 23-sep-2026). Secretaría, dirección y TIC crean
    **materiales** (la agenda, la bata…), y cada uno es una **columna** para las clases a las
    que va. A quién va se elige al crearlo: **una etapa entera, un curso entero o clases
    sueltas, mezclables**; se guarda la regla (`destinos`), no la lista de alumnos, así que una
    alta de mitad de curso ya tiene su casilla. Un curso de ESO incluye a su PDC.

    Cada celda tiene **cinco estados**, un toque cicla: **—** (sin información, que es como
    empieza todo el mundo) → **pagado** → **no** → **becado** → **no aplica**.

    **«Becado» solo lo ven dirección, secretaría, orientación y TIC.** A los demás —tutores,
    jefatura— se les manda como «pagado» desde el servidor (`estadoVisible`), no se esconde
    con CSS: para un tutor lo único que importa es que el alumno tiene su material.

    No se crean columnas en Postgres por material: un material es una fila de
    `mat_materiales` y su estado por alumno una de `mat_estados`. Quitar un material que ya
    tiene pagos lo **archiva** (los pagos son historia del curso); si no tiene ninguno, se borra.

16. **Informes a medida en PDF, Excel y CSV** (David, 23-sep-2026: «a principio de curso nos
    hace falta esa información»). Eliges columnas (NIA, banco, AMPA, protección de datos
    general o detallada, correo, cada material), clases (la elegida, todas las que ves o las
    que marques), un filtro opcional («solo quien NO ha pagado la agenda») y formato. Sale
    agrupado por clase con el total de cada una; en el PDF, apaisado si hay muchas columnas y,
    si se quiere, **una página por clase** para repartir a los tutores.

    El informe lo monta el servidor con **la misma función que pinta la lista**
    (`listaAlumnado`), así que no enseña nada que no se vea ya en pantalla: el alcance por
    etapa, la protección de datos que no te toca (sale en blanco) y las becas (salen como
    «pagado») se recortan igual. Cada tabla tiene su botón «Informe», que abre este mismo
    formulario con sus columnas ya puestas.

---

## Lo que se enseña, y de dónde sale

Inventariado contra los **639 alumnos activos** de Neon (10-sep-2026), no contra el schema:

| En la ficha | De dónde | Cobertura real |
|---|---|---|
| Nombre, apellidos, sexo, nacimiento | `edu_students` (+ `nombresDe` de `personas.ts`) | 639 / 635 con fecha |
| Clase, nº de lista | `edu_students` + `cuad_numeracion` | 352 con número congelado |
| Tutores de la clase y tutor personal | `edu_tutorias` + `edu_tutor_personal` | 28 clases, 101 con tutor personal |
| Etapa de quien consulta (para el alcance) | `edu_teachers.etapa`, o la de sus tutorías | 44 de 54 profes activos con etapa |
| NIA · DNI · código · matrícula | `edu_students` | 636 · 337 · 635 · 639 |
| Tarjeta sanitaria | `extra` → `TARJETA SANITARIA` | 231 |
| **Teléfono de emergencia** | `extra` → `TEL EMERGENCIA ALUMNO` | 511 — ver el aviso de abajo |
| Nacimiento (lugar, provincia, país) y nacionalidad | `extra` | 601 · 574 · 639 |
| Familia numerosa · hijo de empleado | `extra` (`TRUE`/`FALSE`) | 9 · 17 |
| Familiares: nombre, parentesco, teléfonos, correos, custodia | `edu_guardians` + `edu_student_guardians` | 977 familiares; 854 con correo |
| **Domicilio** | recompuesto del `extra` del tutor legal | 496 — ver el aviso de abajo |
| Hermanos en el centro | `edu_students.familia_id` | 133 familias con 2+ |
| Banco de libros (sí/no, lote, entregado, libros valorados) | `edu_students.banco_libros` + `bl_*` | 492 participan; 21 lotes asignados |
| Licencias (participa, pedido hecho, importe, pagado, libros) | `lic_students` + `lic_orders` + `lic_order_items` | 348 participan, 206 con pedido |
| AMPA (familia socia) | `edu_students.ampa` | 15 |
| **Protección de datos** (imagen y voz, redes, AMPA, ONG + desestimación del correo) | `edu_students.pd_*` | todos a «sí» de salida (y nadie desestima el correo); los noes se marcan desde la ficha o la tabla |
| **Venta de materiales** (pagado / no / becado / no aplica) | `mat_materiales` + `mat_estados` | desde el 23-sep-2026 |
| Puntualidad (retrasos, minutos, justificados, consecuencias) | `pun_records` + `con_consequences` | 0 (curso recién empezado) |
| Salidas (apuntado, justificante) | `sal_signups` + `sal_trips` | 3 |
| ABC (nº de informes, último) | `abc_students` + `abc_behavior_reports` | 7 informes, 1 alumno |
| Apoyos | `hor_apoyos` | 0 |
| Resto del export sin colocar | `extra`, filtrando el ruido | — |

### Dos cosas que el sync de Educamos no está guardando donde debería

Salieron al inventariar los datos reales, y la ficha las **lee del `extra`** para que se vean
igual. Arreglarlas en el sync es trabajo pendiente, no de esta pantalla:

- **`edu_students.tel_emergencia` está a null en las 639 filas activas**, pero
  `extra['TEL EMERGENCIA ALUMNO']` lo trae en 511. El campo existe en el schema y el sync no lo
  mapea. La ficha mira los dos sitios, por si algún día se arregla.
- **`edu_guardians.direccion` está a null en las 977 filas.** La dirección viene repartida en
  `TIPO VÍA` / `CALLE` / `NÚMERO` / `BLOQUE` / `ESCALERA` / `PISO` / `PUERTA` dentro del `extra`,
  y `domicilio()` la vuelve a juntar en la línea de siempre («C/ Mayor 14, esc. 2, 3º B»).

### Y tres campos que NO se enseñan, a propósito

Están en el export pero no dicen nada, comprobado sobre los 639: `Nº HIJOS` es `0` en todos,
`ACCESO PLATAFORMA ALUMNO` es `TRUE` en 638 de 639, y `modelo_linguistico` y `deficit` están
vacíos en la tabla entera. Los `… SMS` tampoco: son banderitas de si Educamos manda SMS a ese
número, no teléfonos.

---

## Un detalle de datos que costó un rato

`M` en `edu_students.sexo` es **masculino**, no «mujer». Son 299 M y 340 F, y la primera versión
de la ficha le puso «Chica» a un Ivan. Si algún día hay que tocar esto, el mapa está en
`SEXO` de `ficha-alumno.tsx` y solo existen esos dos valores en la tabla.

Y las clases de PDC vienen con el ordinal pegado y la letra repetida (`curso = '3ºPPDC'`,
`letra = 'PDC'`), así que `claseLarga()` no le añade otro `º` ni repite el `PDC`, y traduce el
`PPDC` de Educamos al `PDC` que se dice y se escribe.

---

## Plan técnico

### Módulos de código

```
src/lib/alumnado.ts                        # helpers puros: búsqueda normalizada, edad y
                                           # cumpleaños, teléfonos y WhatsApp, domicilio,
                                           # banderitas del extra (con tests)
src/lib/alumnado-server.ts                 # listaAlumnado() y fichaAlumno(): las dos queries
src/app/api/alumnado/[id]/route.ts         # la ficha completa, con guard y alcance
src/app/api/alumnado/[id]/proteccion/...   # cambiar los 4 permisos + correo + notas
src/app/api/alumnado/[id]/participacion/…  # banco de libros y AMPA (llama a bancolibros-server)
src/app/api/alumnado/proteccion/route.ts   # masivo: una columna, o la clase entera
src/app/gestion/alumnado/                  # layout (guard de módulo) + página + loading
src/components/alumnado/alumnado-panel.tsx # clases, buscador, lista y orquestación
src/components/alumnado/ficha-alumno.tsx   # la ficha, en el orden de la tabla de arriba
src/components/alumnado/copiable.tsx       # Copiable, Dato y CopiarLista
# Fase 3 (23-sep-2026)
src/lib/materiales-server.ts               # materiales: lista, estados (con la beca recortada), crear/editar/quitar
src/lib/alumnado-informe.ts                # informes: columnas, celdas, filtro, agrupado y CSV (puro, con tests)
src/lib/alumnado-informe-formatos.ts       # PDF (pdf-lib) y Excel (xlsx-escribir) del informe
src/app/api/alumnado/participacion/…       # banco / AMPA masivo
src/app/api/alumnado/materiales/…          # crear, editar, quitar un material y marcar estados
src/app/api/alumnado/informe/route.ts      # GET → PDF, Excel o CSV
src/components/alumnado/piezas-tabla.tsx   # celdas, botones de columna y masivos compartidos
src/components/alumnado/tabla-participacion.tsx · tabla-materiales.tsx · informes.tsx
```

Columnas `pd_*` en `edu_students` (`pd_imagen`, `pd_redes`, `pd_ampa`, `pd_ong`, `pd_notas`,
`pd_actualizado_at`, `pd_actualizado_por`) en `src/db/sql/proteccion-datos.sql`, y
`pd_desestima_correo` más las tablas `mat_materiales` / `mat_estados` en
`proteccion-datos-v2.sql`: aditivos e idempotentes. `pd_firmada` se retira con
`proteccion-datos-quita-firmada.sql`, **después** del despliegue.

### Rendimiento: lo que importa es el número de TANDAS, no las consultas

Medido contra Neon: **un viaje cuesta ~127 ms**, pase lo que pase. Con eso, optimizar una
consulta no sirve de nada si el código encadena cuatro. Todo lo de esta pantalla está montado
para ir en **una sola tanda** (13 consultas en paralelo cuestan lo que una).

| | Antes | Ahora | Qué era |
|---|---|---|---|
| `fichaAlumno()` | 515 ms | **144 ms** | 4 tandas encadenadas (alumno → …→ campaña → pedido → líneas) y un `select *` de los 97 profes que él solo valía 357 ms por arrastrar su `extra` |
| `GET /api/alumnado/[id]` | 432 ms | **296 ms** | la ficha y el alcance iban en cadena, y `alcanceAlumnado` hacía dos viajes más |
| `listaAlumnado()` | ~400 ms | ~260 ms | la campaña activa se pedía antes; ahora es una subconsulta |
| Clic en un alumno | **2 peticiones** | **1** | ver abajo |
| Volver a uno ya abierto | — | 0 peticiones | la caché del cliente |

**La causa gorda era la navegación, no las consultas.** `router.replace` para mover
`?alumno=` re-renderizaba en el servidor la página ENTERA a cada clic —`force-dynamic` + lee
`searchParams`—, así que cada toque costaba el listado de 639 otra vez (~90 KB) *más* la
llamada a la API, en paralelo. Ahora se usa `window.history.pushState`, que Next integra con
`useSearchParams` justo para esto (guía «Shallow routing on the client» en
`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`). Un clic = una
petición a la API y nada más.

Las subconsultas son la herramienta para esto: lo que dependía del alumno (sus hermanos, las
tutorías de su curso, la campaña activa) se resuelve dentro de la misma consulta en vez de
esperar a un viaje previo.

### Estados de carga

Abrir una ficha enseña un **esqueleto con la forma de la ficha**, no un spinner centrado: así
lo que llega no da un salto. Al saltar de una ficha a otra se deja la anterior a la vista con
un «Cargando» arriba a la derecha, que es menos brusco que vaciar la pantalla. La fila tocada
se marca en el mismo frame, sin esperar a la red.

### Permisos

Tres capas, no una: el **módulo** (quién entra), el **alcance** (a quién ve dentro) y, para la
protección de datos, **quién la ve y quién la toca** (`veProteccionDatosCompleta` y
`puedeEditarProteccionDatos`). Los tres se comprueban en el servidor —listado, HTML de
`?alumno=` y rutas API—, y las rutas de escritura además vuelven a comprobar el alcance antes
de tocar nada; fuera de alcance devuelven 404, no 403, por el mismo motivo que la de lectura.

Módulo `alumnado` en `src/lib/permissions.ts`. Lo trae el rol de dirección, jefatura,
orientación, secretaría, TIC y **tutor** (que ve su etapa). `profe` **no** lo trae por defecto:
se le puede dar a mano desde `/gestion/usuarios` como cualquier otro módulo, y con el criterio
de etapa vería lo mismo que un tutor de su etapa. Dárselo al rol entero es cambiar una línea de
`ROLE_MODULES`, pero es una decisión de David, no un detalle de implementación.

---

## Checklist

### Fase 1 · Navegador y ficha
- [x] `alumnado.ts`: búsqueda sin acentos por nombre/NIA/DNI/código, edad y aviso de cumpleaños,
      teléfonos pulsables, WhatsApp solo en móviles, domicilio recompuesto y banderitas (con tests)
- [x] `alumnado-server.ts`: listado con alcance por tutor y ficha completa de los 8 módulos
- [x] Ruta API con guard de módulo y comprobación de alcance (404, no 403)
- [x] Panel: carril de clases a lo ancho, buscador con `/`, lista con avatar, nº y distintivos
- [x] Ficha en el orden decidido, con todo copiable de un toque
- [x] `?alumno=` resuelto en el servidor; «atrás» por `popstate`; `Esc` cierra
- [x] Módulo `alumnado` en permisos y tarjeta en el escritorio
- [x] Probado en claro y oscuro, a 1180 px y en iPad vertical
- [x] Rendimiento: una sola tanda de consultas y un clic = una petición (13-sep-2026)
- [x] Esqueleto de carga con la forma de la ficha
- [x] Probado el alcance de verdad contra la app: un tutor de 2º ESO B entra en su clase, alcanza
      las 10 de Secundaria (230 alumnos), abre sin problema a una alumna de 4º ESO A, y la API le
      devuelve 404 con un alumno de Infantil. Un tutor de Primaria alcanza sus 12 clases (275) y
      ninguna de ESO; quien no tiene etapa ni tutoría no ve a nadie
- [ ] Exportar a Google Sheets la tutoría entera desde aquí (reutilizando `lista-clase.ts`)
- [ ] Foto del alumno, si algún día se saca de Educamos
- [ ] Lo que salga de usarlo dos semanas

### Fase 2 · Protección de datos y ajustes desde la ficha (17-sep-2026)
- [x] Helpers puros: los cuatro permisos tri-estado, el aviso de la ficha (rojo si no puede
      salir en fotos) y el reparto sí/no/no consta, con tests (`alumnado.test.ts`)
- [x] `permissions.ts`: `veProteccionDatosCompleta` (dirección y demás ven el centro; el tutor,
      su tutoría) y `puedeEditarProteccionDatos` (secretaría, dirección, TIC)
- [x] `alumnado-server.ts`: alcance propio de la protección de datos, `fichaVisible()` (lo que
      no te toca no se manda), `guardarProteccion()` firmado con quién y cuándo
- [x] Rutas `POST /api/alumnado/[id]/proteccion` y `.../participacion`, con Zod, alcance y 404
      (no 403) para quien está fuera
- [x] Tarjeta editable en la ficha: los 4 permisos en sí/no/no consta, documento firmado,
      notas, y los interruptores de banco de libros y AMPA para quien pueda
- [x] Chip arriba del todo: **rojo** si la familia ha dicho que no a la imagen, ámbar si falta
      la firma o hay algún no, verde si está todo autorizado
- [x] Cámara tachada en la fila de la lista, solo para alumnado cuya protección de datos te toca
- [x] Vista «Protección de datos»: la clase entera en tabla, un toque por celda, «todos sí /
      todos no» por columna y «Poner todo a SÍ» para la clase, todo con segundo toque de
      confirmación (17-sep-2026)
- [x] Botón «Todo sí» también en la ficha individual
- [x] Punto de partida «sí a todo» en el SQL de estreno (`UPDATE … WHERE pd_x IS NULL`, así que
      relanzarlo no pisa ningún «no» ya marcado) y `DEFAULT true` para las altas nuevas
- [x] `pnpm test`, `pnpm lint`, `pnpm build` en verde
- [x] **Aplicar `src/db/sql/proteccion-datos.sql` en Neon** — ya estaba aplicado (comprobado el
      23-sep-2026: las columnas `pd_*` existen y las 645 fichas activas están a «sí»)
- [x] Probado contra la app con datos reales (23-sep-2026, junto con la Fase 3)
- [ ] Ver cómo va la carga real con secretaría: con el arranque en «sí» y los masivos por
      clase, lo que queda es marcar los noes. Si aparece un Excel con las autorizaciones,
      un importador por NIA sigue siendo la opción rápida (`00-desarrollos-futuros.md`)

### Fase 3 · Pestañas de banco, AMPA y materiales, e informes (23-sep-2026)
- [x] Protección de datos: check general sí/no deducido de los cuatro (`generalProteccion`,
      con tests), detalle plegable, columna de desestimación del correo (verde por defecto,
      rojo si desestima) en la tabla y en la ficha, y fuera `pd_firmada` de la UI y del código
- [x] Pestañas «Banco de libros» y «AMPA»: un check por alumno, todos sí / todos no con segundo
      toque, «ver también» la otra columna y botón de informe; ruta masiva
      `POST /api/alumnado/participacion` (con `setBancoVarios`, que propaga a Licencias)
- [x] El AMPA sale del panel del banco de libros (pestaña, columna del resumen y ruta `admin/ampa`)
- [x] Venta de materiales: `mat_materiales` + `mat_estados`, crear/editar/quitar (secretaría,
      dirección, TIC), destinos por etapa/curso/clase (`aplicaMaterial`, con tests), cinco
      estados con un toque, masivos por columna, y beca recortada en el servidor para quien no
      deba verla (`estadoVisible` + `veBecasMateriales`)
- [x] Informes a medida: columnas, clases, filtro, título y formato PDF / Excel / CSV, agrupado
      por clase con totales y opción de una página por clase (`alumnado-informe.ts`, con tests
      de celdas, filtro, totales, CSV, PDF y Excel)
- [x] `proteccion-datos-v2.sql` aplicado en Neon (`pd_desestima_correo`, `mat_*`)
- [x] Probado contra la app con datos reales (sesión de TIC y de una tutora de 2º ESO B): crear
      material, marcar pagos y beca, rechazo de un alumno al que el material no va, informes en
      los tres formatos (el del centro entero, 28 páginas, en 0,4 s); la tutora ve la beca como
      «pagado», la protección de datos de otra clase en blanco, 404 en Infantil y 403 al
      intentar marcar. Capturas en claro y oscuro a 1180 px. Los cambios de prueba se deshicieron
- [ ] **Aplicar `proteccion-datos-quita-firmada.sql` en Neon DESPUÉS de desplegar** (el código
      que hay hoy en producción todavía lee `pd_firmada`): `pnpm db:sql --pendientes`
- [ ] Revisar con David las decisiones que tomé yo (`00-desarrollos-futuros.md`): quién marca el
      AMPA, jefatura y las becas, materiales en la ficha individual

### Pendiente en otros módulos (salió de aquí)
- [ ] **Sync de Educamos**: mapear `TEL EMERGENCIA ALUMNO` a `edu_students.tel_emergencia` y la
      dirección a `edu_guardians.direccion`, en vez de dejarlas solo en `extra`
      (ficha [`02`](./02-integracion-educamos.md))
