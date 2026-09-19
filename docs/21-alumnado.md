# Alumnado · la ficha de cada alumno

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (navegador y ficha completos y
probados contra datos reales; la protección de datos está escrita y probada en local, pero su
SQL sigue pendiente de aplicar en Neon — ver el aviso al final)

Pantalla de consulta de `/gestion/alumnado`: eliges una clase (o buscas), tocas a un alumno y
tienes **todo lo que la plataforma sabe de él** en una sola vista, con lo importante arriba y
todo lo copiable a un toque.

Es **transversal y casi todo de solo lectura**: no crea tablas ni duplica campos, lee `edu_*`
como identidad y va a preguntar a cada módulo por lo suyo. Lo único que se escribe desde aquí
son cuatro interruptores que ya vivían en `edu_students` (protección de datos, banco de libros
y AMPA), llamando al mismo código que su módulo y con su mismo permiso: la ficha **condensa la
información, no se queda con la autoridad**. Nada se copia a una tabla nueva, que es
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

   `pd_firmada` se queda aparte y en `false`: el punto de partida de trabajo no es un papel
   firmado, y ponerlo a `true` sería decir que hay 639 firmas que no existen. Por eso el
   chip de la ficha, cuando todo está autorizado pero sin firmar, sale **verde con un «sin
   firmar» al lado** y no en ámbar: un aviso que sale en las 639 fichas no lo lee nadie.

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

12. **La pantalla tiene dos vistas: fichas y tabla de protección de datos** (David,
    17-sep-2026). La ficha responde por una persona; llenar esto son 639 alumnos × 5
    casillas, y eso no se hace ficha a ficha. La pestaña «Protección de datos» enseña la
    clase elegida como tabla —una fila por alumno, una columna por permiso— con:

    - **un toque por celda**, que cicla sí → no → sin constar;
    - **«todos sí» y «todos no» en la cabecera de cada columna**, que es lo que se pidió por
      columna: entra una autorización nueva y se resuelve sin bajar por las 25 filas;
    - **«Poner todo a SÍ»** para la clase entera, y «Marcar firmadas».

    Todo lo masivo pide **un segundo toque** y en él dice a cuántos va a afectar: cambiar 25
    fichas sin querer es un mal rato, y el segundo toque cuesta medio segundo. Y el alcance
    no se cree lo que venga en la petición: la ruta masiva lee en la BBDD las clases de esos
    ids y descarta lo que no le toque a quien pulsa.

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
| **Protección de datos** (imagen y voz, redes, AMPA, ONG + firmada) | `edu_students.pd_*` | todos a «sí» de salida; los noes se marcan desde la ficha o la tabla |
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
src/app/api/alumnado/[id]/proteccion/...   # cambiar los 4 permisos + firmada + notas
src/app/api/alumnado/[id]/participacion/…  # banco de libros y AMPA (llama a bancolibros-server)
src/app/api/alumnado/proteccion/route.ts   # masivo: una columna, o la clase entera
src/app/api/alumnado/participacion/…       # masivo de banco de libros y AMPA por clase
src/app/gestion/alumnado/                  # layout (guard de módulo) + página + loading
src/components/alumnado/alumnado-panel.tsx # clases, buscador, lista, pestañas y orquestación
src/components/alumnado/ficha-alumno.tsx   # la ficha, en el orden de la tabla de arriba
src/components/alumnado/proteccion-datos.tsx  # la tarjeta de la ficha (permisos + participación)
src/components/alumnado/tabla-proteccion.tsx  # pestaña: los 4 permisos de la clase entera
src/components/alumnado/tabla-participacion.tsx # pestañas de banco de libros y AMPA
src/components/alumnado/copiable.tsx       # Copiable, Dato y CopiarLista
```

Sin tablas nuevas. Sí hay **8 columnas nuevas** en `edu_students` (`pd_imagen`, `pd_redes`,
`pd_ampa`, `pd_ong`, `pd_firmada`, `pd_notas`, `pd_actualizado_at`, `pd_actualizado_por`), en
`src/db/sql/proteccion-datos.sql`: aditivo e idempotente.

Las pestañas de banco de libros y AMPA (Fase 3) **no añaden nada al schema**: escriben
`edu_students.banco_libros` y `edu_students.ampa`, que ya existían y son del módulo del banco.

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
- [x] Aplicado `src/db/sql/proteccion-datos.sql` en Neon (19-sep-2026): las 8 columnas
      nuevas en `edu_students` y el arranque «sí a todo» para el alumnado activo, verificado
      sentencia a sentencia
- [ ] Probado contra la app con datos reales
- [ ] Ver cómo va la carga real con secretaría: con el arranque en «sí» y los masivos por
      clase, lo que queda es marcar los noes. Si aparece un Excel con las autorizaciones,
      un importador por NIA sigue siendo la opción rápida (`00-desarrollos-futuros.md`)

### Fase 3 · Banco de libros y AMPA por clase, desde Alumnado (19-sep-2026)

David: «da igual si vas al módulo banco de libros o vas al módulo alumnado, te vas a encontrar
esas opciones para cambiarlo rápido y fácil». Los interruptores de la ficha ya existían desde
la Fase 2, pero eran de uno en uno, y marcar quién va al banco son 492 personas.

- [x] Dos pestañas nuevas junto a «Protección de datos»: **Banco de libros** y **AMPA**, cada
      una con la clase entera en tabla, un toque por celda y «todos sí / todos no» con segundo
      toque de confirmación (`tabla-participacion.tsx`, una sola implementación parametrizada
      por campo)
- [x] No son tri-estado, y por eso no se pintan como la protección de datos: se participa o no,
      y el «no» va en gris y no en rojo. Nadie ha dicho que no a nada; esa familia no está
      apuntada, que es otra cosa
- [x] El módulo del banco de libros se queda **exactamente como estaba**: la API nueva
      (`POST /api/alumnado/participacion`) llama a sus mismos `setBancoMuchos`/`setAmpa`, que
      son los que además propagan el banco al snapshot de Licencias. Alumnado da el atajo, no
      se queda con la autoridad
- [x] Mismo permiso que el panel del banco (dirección/TIC): extraído a `puedeParticipacionDe()`
      para que la ficha, las pestañas y la API no puedan dejar de coincidir. Quien no lo tiene
      no ve las pestañas, porque son un atajo de edición y no un dato que consultar aquí
- [x] El alcance se lee de la BBDD y no del cuerpo de la petición, igual que en la protección
      masiva: quien manda ids que no le tocan se queda sin esos, no con un 403
- [x] Verificado contra Neon con datos reales sin alterar ninguno (fuera de alcance → 0,
      id inexistente → 0, filtro por clase → 26 de 50) y contra la app en el navegador: las
      tres pestañas, en claro y oscuro, a 1180 px y en iPad vertical sin scroll horizontal
- [x] `pnpm test` (654), `pnpm build` en verde; `pnpm lint` sin ningún problema nuevo
- [ ] Probado por David en uso real: queda pendiente tocar un interruptor de verdad, que en la
      verificación no se hizo para no cambiar datos del colegio

### Fase 4 · Plegar la protección de datos en la ficha (lo siguiente que toca)

David, 19-sep-2026. En la ficha, los cuatro permisos ocupan cuatro filas que casi nadie va a
tocar: el caso normal es «sí a todo» y el «no» es lo raro. Queda a la vista lo que se mira, y
el detalle plegado, como cuando en Excel agrupas varias columnas.

- [ ] Interruptor general arriba, y los cuatro permisos (imagen y voz, redes, AMPA, ONG)
      plegados detrás de un desplegable que casi nunca se abrirá
- [ ] «No» en el general = «no» en los cuatro. El «sí» ya lo hace hoy el botón «Todo sí», que
      este interruptor absorbe
- [ ] Confirmar con David: «el toggle general + el de la protección de datos en sí misma» lo he
      leído como **general + «Documento firmado»** a la vista y los cuatro permisos plegados. Si
      quería decir general + imagen y voz (que es el permiso caro), cambia qué queda arriba
- [ ] Decidir qué pinta el general cuando los cuatro NO coinciden (dos síes y un no): o es
      tri-estado/«mixto», o el resumen lo sigue dando el chip de arriba y el interruptor se
      queda solo como atajo de escritura. Sin esto, abrir la ficha de alguien con un «no»
      marcado y ver el general en «sí» es justo el error que esta tarjeta existe para evitar
- [ ] El detalle por columnas sigue entero en la vista «Protección de datos» por clase, que es
      donde se marcan los noes de verdad: plegar en la ficha no esconde nada que no esté a un toque

### Fase 5 · Informes en PDF, Word y Excel (después de la 4)

David, 19-sep-2026. Cuatro listados que hoy solo se miran en pantalla y que se piden en papel o
para mandar: clase completa, banco de libros, AMPA y protección de datos.

- [ ] Botón de informe en PDF, Word y Excel para los cuatro listados
- [ ] En los cuatro, el mismo interruptor: **lista completa** con quien no participa en gris, o
      **solo los que sí**. Es la misma pregunta en clase, banco, AMPA y protección, así que se
      resuelve una vez y se reutiliza
- [ ] Excel: el repo ya exporta CSV con `;` y BOM en cuatro módulos (`licencias-`, `puntualidad-`,
      `salidas-` y `evaluaciones-exports.ts`); para .xlsx de verdad, la dependencia `xlsx` ya está
- [ ] PDF y Word: no hay librería todavía, hay que decidirla antes de empezar. Se generan en
      servidor: esto es alumnado, no se manda la clase entera al navegador para montar el PDF
- [ ] El de protección de datos es una lista de nombres con sus permisos y sale en papel del
      colegio: pie con la fecha y quién lo generó, y no se guarda en Blob

### Pendiente en otros módulos (salió de aquí)
- [ ] **Sync de Educamos**: mapear `TEL EMERGENCIA ALUMNO` a `edu_students.tel_emergencia` y la
      dirección a `edu_guardians.direccion`, en vez de dejarlas solo en `extra`
      (ficha [`02`](./02-integracion-educamos.md))
