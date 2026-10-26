# Dispositivos 1:1 · el iPad de cada alumno, y los del cole

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (Fases 1 y 2 en `/gestion/dispositivos` desde el 20-oct-2026, probadas contra Neon y en el navegador; falta el volcado real de Bárbara y Amparo y cerrar cómo se cobra)

Idea de Jose Miguel Batalla (13-oct-2026, «Módulo nuevo: iPad»), cerrada con David el
19/20-oct-2026 sobre un wireframe. Se llama **Dispositivos 1:1** y no «iPad» porque mañana
puede entrar otro aparato; hoy **todo es iPad** y el tipo sale por defecto.

Ruta: `/gestion/dispositivos`. Acceso: **TIC, SuperTIC, Secretaría y Dirección** (módulo
`dispositivos`). Los tutores y profes no entran: solo ven, en la ficha de Alumnado, si un
alumno **no se lleva el iPad a casa** (decisión 7).

Cuatro preguntas a las que responde:

1. **¿Cómo tiene el iPad cada alumno?** Comprado, lo trae de casa, prestado por el cole o
   heredado de un hermano. Y quién está todavía **sin informar**.
2. **¿Quién tiene que pagar qué?** El listado de cuotas.
3. **¿Qué iPads tiene el cole y quién tiene cada uno?** Los de sustitución (`S1`, `S2`…), que son
   los del alumnado, y los del profesorado (`P1`, `P2`…).
4. **¿Qué modelos hay?** Un catálogo corto de modelos estándar («iPad 9.ª generación · 64 GB»)
   para que nadie escriba el mismo modelo de cinco maneras.

---

## Decisiones cerradas

1. **Cinco estados por alumno** (Jose Miguel, 13-oct; David, 20-oct):

   | Estado | Qué es | Cuota |
   |---|---|---|
   | **Sin informar** | Nadie lo ha marcado todavía. Es como empieza todo el mundo y donde caen las altas nuevas | — |
   | **Comprado** | La familia lo compró a través del cole, con su seguro de 4 cursos. Se apunta el **curso de compra** | Nada mientras dura el seguro; **30 €/año** cuando vence |
   | **De casa** | Lo trae de casa, comprado fuera | **10 €/mes** |
   | **Prestado** | Es del cole. Si la familia firma el documento en secretaría y paga la cuota, **se lo lleva a casa**; si no, **se queda en el cole** | **10 €/mes** si se lo lleva; nada si se queda |
   | **De hermano** | Un iPad comprado que pasa de un hermano a otro: **hereda el curso de compra** del hermano | Como «Comprado»: nada con seguro, **30 €/año** cuando vence |

2. **El seguro cuenta por curso escolar, no por año natural** (David: «obvio»). Comprado en
   2022-23 cubre 2022-23, 23-24, 24-25 y 25-26; en 2026-27 ya paga. El último curso con seguro
   sale con un aviso suave («último curso con seguro») para poder avisar a la familia antes.
   Los números (4 cursos, 30 €, 10 €) viven en `CONFIGURACION.dispositivos`, no en el código.

3. **Quién sale en la lista: los mismos que en AUTOASM** (David, 20-oct). El alcance es el
   «Alumnado desde» de **la última subida a ASM del curso** (este curso, desde 6º EP; desde
   2027-28, desde 1º ESO); sin subidas, el de la última entrega, y si no hay ninguna, el de por
   defecto de AUTOASM. Mismo criterio que `entraEnAlcance()`, Bachillerato fuera. Quien sale
   del alcance conserva lo apuntado, pero no se pinta.

4. **Prestado: se apunta QUÉ iPad es** (David: «¡SÍ!»). Los iPads del cole son un inventario
   propio con un **código corto**, el **modelo** del catálogo, el **nº de serie (opcional)**, su
   estado (operativo · en reparación · de baja) y notas. **Son dos lotes** (David, 20-oct-2026):

   | Lote | Código | Para qué |
   |---|---|---|
   | **Sustitución** | `S1`, `S2`… | Los del alumnado. El mismo iPad sirve para **prestarlo todo el curso** (el alumno pasa a «Prestado») o para **dejarlo mientras arreglan el suyo** (el alumno sigue como estaba). David: «los de préstamo son de sustitución» |
   | **Profesorado** | `P1`, `P2`… | Los del claustro (decisión 6) |

   Al dar uno de sustitución a un alumno desde el inventario se pregunta cuál de las dos cosas es.
   Bárbara y Amparo tienen toda la información y la vuelcan: por eso hay **alta en serie** (cuántos y
   de qué modelo) y **pegar números de serie** (una línea, un iPad).

   **Cargadores** (26-oct-2026): cada iPad del cole puede llevar su cargador, que es una pieza propia
   con su estado (operativo, perdido, de baja) y lo que lleva escrito (`S3`). Un iPad sin cargador
   sale en ámbar en la lista y en el filtro «Sin cargador»; el alta en serie los crea con el mismo
   código del iPad.

5. **Quién tiene un iPad del cole vive en el iPad, no en el alumno.** Un aparato del inventario
   tiene como mucho un titular (un alumno o un profe). El alumno prestado no guarda «el S12»:
   se busca qué aparato le tiene a él. Una sola verdad, la lección de
   [`06-fuente-unica-alumnado.md`](./06-fuente-unica-alumnado.md). Que sea prestado o temporal lo
   dice la modalidad del alumno. Si un alumno **deja de estar «Prestado»**, su iPad **vuelve solo al
   almacén** (y queda en el historial); si no lo estaba, el que tenga por una reparación no se toca.

6. **iPads del profesorado**: son del cole, llevan código `P` y se asignan a profes **desde el
   3er ciclo de Primaria** (5º EP) en adelante (David, 20-oct). La pantalla enseña qué profes
   «les toca» (ESO marcada en su ficha, o clase o tutoría de 5º EP para arriba en Horarios) y
   cuáles de ellos no tienen iPad todavía. Se le puede dar uno a cualquiera igualmente.

7. **Tutores y profes de la etapa ven solo si NO se lo lleva a casa** (David, 20-oct): un aviso
   **bien destacado arriba** en la ficha de Alumnado («No se lleva el iPad a casa»), y un icono
   en la lista de la clase. **No ven si es prestado o no**, ni cuotas. Quien tiene el módulo
   ve además el estado completo en la ficha, con enlace aquí.

8. **Sin becas ni exenciones** (David, 20-oct: «en principio nada»). Cada alumno paga lo suyo,
   también entre hermanos.

9. **Enganchado a Nouvinguts** (David: «el tema iPad hay que resolverlo de alguna forma»). El
   paso «iPad» de [`28-nouvinguts.md`](./28-nouvinguts.md) deja de marcarse a mano: está hecho
   cuando el alumno tiene estado aquí, y desde la propia ficha del nouvingut se elige con un
   toque. Las altas nuevas aparecen además como «Sin informar» en este módulo.

10. **Modelos estándar** (David: «otro menú fácil para que sean estándar»): nombre + capacidad
    + notas. Un modelo en uso no se borra, se archiva (deja de ofrecerse).

11. **Historial**: cada cambio (estado de un alumno, asignar o devolver un iPad, reparación,
    baja) queda apuntado con quién y cuándo en `dis_historial`. Es lo que contesta «¿desde
    cuándo se lo lleva a casa?» o «¿quién tuvo el S3 en noviembre?».

### Pendiente (no bloquea)

- **Cómo se cobra** (David, 20-oct: «pendiente de secretaría y Jose Miguel»): si el listado
  se saca cada mes o una vez al curso, de qué meses son los 10 €/mes, y si un cambio a mitad de
  curso se prorratea. Mientras tanto, el listado es **la foto del día** con lo que pagaría cada
  uno, en Excel y CSV. Apuntado en `00-desarrollos-futuros.md`.
- **Si se lleva «pagado / no pagado» aquí o en Educamos** (David: «esto ya lo vemos»). Hoy
  solo el listado; el cobro sigue fuera.

## Plan técnico

- **Tablas** (`src/db/schema.ts`, SQL aditivo `src/db/sql/dispositivos.sql`):
  - `dis_modelos`: catálogo (tipo, nombre, capacidad en GB, notas, activo).
  - `dis_aparatos`: el inventario del cole. `uso` (`sustitucion`|`profesorado`),
    `codigo` único (`S1`, `P1`), modelo, nº de serie, estado
    (`activo`|`reparacion`|`baja`), notas y **titular** (`edu_student_id` o `edu_teacher_id`,
    nunca los dos) con fecha de asignación.
  - `dis_cargadores`: el cargador de un iPad del cole (SQL `dispositivos-cargadores.sql`).
    `aparato_id` único (un cargador por iPad), `codigo` (lo que lleva escrito, suele ser el del
    iPad; no único a propósito), estado (`activo`|`perdido`|`baja`) y notas.
  - `dis_alumnos`: una fila por alumno informado (PK `edu_student_id`): `modalidad`
    (`comprado`|`casa`|`prestado`|`hermano`), tipo (`ipad`), curso de compra, `a_casa` (del
    prestado), fecha de firma, de qué hermano viene, modelo y nº de serie opcionales y notas.
    Sin fila = sin informar. **No copia ni curso ni clase**: se leen de `edu_students`.
  - `dis_historial`: qué cambió, de quién o de qué iPad, quién y cuándo.
- **Helpers puros** (`src/lib/dispositivos.ts`, tests en `__tests__/dispositivos.test.ts`):
  cursos escolares, seguro y cuota, siguiente código libre, textos y schemas Zod.
- **Servidor** (`src/lib/dispositivos-server.ts`): alcance de AUTOASM, panel entero en una
  tanda, guardar estado (uno y en bloque), inventario (alta en serie, editar, asignar,
  devolver), modelos, profes a los que les toca, historial, y lo que leen Alumnado y
  Nouvinguts (`resumenDispositivo`, `ipadsEnElCole`).
- **API** (`/api/dispositivos/…`, todas con `requireModule('dispositivos')`): `alumnos`,
  `alumnos/masivo`, `aparatos`, `aparatos/[id]`, `modelos`, `modelos/[id]`, `historial`,
  `cuotas` (Excel/CSV).
- **UI** (`src/components/dispositivos/`): pestañas **Alumnado** (por clase, un toque por
  estado), **Cuotas**, **iPads del cole** (sustitución y profesorado) y **Modelos**.

## Checklist

### Fase 1 · el módulo (20-oct-2026)
- [x] Ficha y fila en la tabla maestra
- [x] Tablas `dis_*` y SQL aplicado en Neon (`dispositivos.sql`, 20-oct-2026; con el modelo «iPad (9.ª generación) · 64 GB» de partida)
- [x] Helpers puros con tests (seguro, cuotas, códigos)
- [x] Alumnado por clase: estado de un toque, curso de compra, prestado a casa / en el cole con su iPad, de hermano, filtros y «a todos los sin informar»
- [x] Cuotas: 10 €/mes y 30 €/año, avisos (falta el curso de compra, prestado sin iPad), Excel y CSV
- [x] iPads del cole: sustitución (prestados o mientras arreglan el suyo) y profesorado; alta en serie, pegar nº de serie, editar, asignar, devolver, reparación y baja; bajas con un iPad del cole sin devolver
- [x] Profesorado: a quién le toca desde 5º EP y quién no tiene iPad
- [x] Modelos estándar
- [x] Historial de cada alumno y de cada iPad
- [x] Módulo `dispositivos` en la matriz de roles y tarjeta en el escritorio

### Fase 2 · enganches (20-oct-2026)
- [x] Nouvinguts: el paso «iPad» sale de aquí y se resuelve desde su ficha
- [x] Alumnado: «No se lleva el iPad a casa» destacado en la ficha y en la lista; estado completo para quien tiene el módulo

Cómo se probó (20-oct-2026): las escrituras del servidor contra Neon con firma de prueba (préstamo,
cambio de iPad, vuelta al almacén, hermano, en bloque, sustitución, baja, borrado protegido,
modelos), y las pantallas con Playwright a 1180 px, en oscuro y a 390 px (alta en serie y pegando nº
de serie, préstamo con su iPad, cuotas, Excel y CSV, la ficha de Alumnado como TIC y como
orientación, y el paso «iPad» de un nouvingut). Todo lo de prueba se borró después: las tablas
`dis_*` están vacías salvo el modelo de partida.

### Fase 2b · cargadores y volcado de sustitución (26-oct-2026)
- [x] Tabla `dis_cargadores` (`dispositivos-cargadores.sql`) y su pieza en la ficha del iPad, la lista y el alta en serie
- [x] Volcado del Excel «iPad de Sustitución/Beca»: iPads S1–S21 con su cargador (ver decisiones en `00-desarrollos-futuros.md`)

### Fase 3 · estrenarlo
- [ ] Que Bárbara y Amparo vuelquen el estado del alumnado (el inventario de sustitución ya está volcado)
- [ ] Cerrar con secretaría y Jose Miguel cómo se cobra (pendiente arriba)
