# Números del cole · plan y checklist

Una sola pantalla, **`/gestion/numeros`**, con todos los recuentos del colegio que hoy están
repartidos en nueve pantallas: cuántos alumnos hay, cuántos están en el banco de libros,
cuántos han pagado Tekman, cuántas familias son del AMPA, cuántos pedidos de licencias
faltan… **por clase, por curso, por etapa y del cole entero**, y todo listo para copiar y
pegar en un Sheet, un Doc, un correo o un WhatsApp.

Lo pidió David el 28-sep-2026: «hay varios sitios donde se puede ver el número total de
alumnos, por clase, si son o no del banco de libros… quizá podemos tener un lugar que sea
"Números y resumen"».

Es la idea de «dashboard agregado de dirección» de `00-desarrollos-futuros.md`, con otro
enfoque: más que un panel de gráficos es una **tabla de recuentos que se puede copiar**.

**Maqueta interactiva con los números reales del 28-sep-2026:**
<https://claude.ai/artifact/L1hPaEoBXnkovpiwApr12s> (es privada: David tiene que compartirla
para que la vea otra persona).

---

## Estado: propuesta 🟡 (plan funcional y técnico escritos, pendientes de 4 decisiones de David)

Sin empezar a implementar. Las decisiones abiertas están abajo y en
`00-desarrollos-futuros.md` → «Números del cole».

---

## La pantalla

De arriba abajo:

1. **Cabecera**: «Números del cole», curso académico y la hora de los datos (se calculan al
   abrir; no hay caché que se quede vieja).
2. **Fila de cifras del cole**: alumnos, familias, banco de libros, AMPA, cada material,
   profesorado y, si toca, los pedidos de licencias. **Tocar una cifra la copia**, igual que un
   `Copiable` de la ficha de Alumnado.
3. **La tabla**, que es el centro de todo:
   - **Pestañas** por tema: Resumen · Banco de libros y AMPA · Materiales · Protección de
     datos · Licencias · Datos que faltan (más Salidas y Puntualidad en la fase 2).
   - **Nivel**: etapas / cursos / clases. En «clases» salen los subtotales de curso y de
     etapa intercalados, y siempre una fila final con **todo el cole**.
   - **Filtro de etapa** (todo / Infantil / Primaria / Secundaria) y **números o %**.
   - **Copiar tabla** en tres formatos:
     - **Sheets / Excel**: TSV en texto plano más HTML, así que se pega en A1 y cada número
       cae en su celda;
     - **Docs / correo**: tabla HTML con bordes y subtotales en negrita;
     - **WhatsApp**: una línea por fila («• 1º ESO: 51 alumnos, 49 en el banco…»).
   - **Tocar una fila** escribe debajo la **frase lista para pegar** («En 1º ESO, 49 de 51
     alumnos están en el banco de libros (96 %) y 15 familias son socias del AMPA.»).
   - **Tocar un número** abre Alumnado con esa clase y ese filtro ya puestos. El número lleva
     a la lista, y la lista ya sabe copiarse y sacar informe.
4. **Avisos de «esto no cuadra»**: cuando contar todo junto destapa algo raro (ver
   «Lo que salió al contar»), la pestaña lleva una pastilla y una línea de aviso.

## Lo que se puede contar, y de dónde sale

Todo se puede partir por clase, curso, etapa y colegio porque todo cuelga de `curso` + `letra`
de `edu_students`. Etapa y orden, con `etapaDeCurso` / `compararClases` de `src/lib/cursos.ts`;
el PDC se suma a su curso de ESO (`cursoBaseEso`), igual que en el resto de la app.

| Tema | Qué cuenta | De dónde | Quién lo ve |
|---|---|---|---|
| Alumnado | alumnos, chicas/chicos, clases y media, **nuevos este curso** (`extra['FECHA ALTA']` del año), con hermanos, familias, otra nacionalidad, cumpleaños del mes | `edu_students` (+ `extra`) | todo el que tiene el módulo |
| Banco de libros | participan / no, **solo en cursos con banco** (`cursoEnBanco`), lotes asignados, entregados, documentación, libros valorados | `edu_students.banco_libros` + `bl_*` | ídem |
| AMPA | familias socias (mejor por `familia_id` que por alumno: dos hermanos pagan una cuota) | `edu_students.ampa` | ídem |
| Materiales | por material: a cuántos va, pagado, no, **becado**, no aplica, sin marcar, recaudado (pagados × importe) | `mat_materiales` + `mat_estados` (`aplicaMaterial`) | becado solo `veBecasMateriales`; al resto, sumado a pagado |
| Protección de datos | todo sí / parcial / todo no / sin constar, noes por permiso, desestiman el correo | `edu_students.pd_*` (`generalProteccion`) | `veProteccionDatosCompleta`; el tutor, su tutoría |
| Licencias | alumnos de la campaña, con pedido, faltan, no pedirán, importe, cobrado, licencias y códigos enviados | `lic_students` + `lic_orders` + `lic_licencias` | quien tiene `licencias`, **con campaña no cerrada** |
| Salidas | salidas abiertas, apuntados, justificantes entregados, no van | `sal_trips` + `sal_signups` | fase 2 |
| Puntualidad | retrasos por clase (semana/mes/curso), sin justificar, alumnos con 3+, patios pendientes | `pun_records` + `con_*` | fase 2, con el alcance de Puntualidad |
| Profesorado | activos por etapa, **sin etapa**, tutores por clase, alumnos sin tutor personal donde hay dos tutores | `edu_teachers` + `edu_tutorias` + `edu_tutor_personal` | jefatura, dirección, secretaría, TIC |
| Datos que faltan | sin NIA, sin DNI, sin tarjeta sanitaria, sin teléfono de emergencia, sin cuenta Google, sin número de lista | `edu_students` (+ `extra`) + `cuad_numeracion` | secretaría y TIC (el tutor, su etapa) |
| Familias | familia numerosa, hijos de empleados, familias con 2/3/4 hijos | `edu_students.extra` + `familia_id` | dirección y secretaría |
| ABC · Evaluaciones | registros ABC del curso **solo por etapa** (por clase se sabría quién es); respuestas/objetivo | `abc_*` · `eval_*` | con su módulo |

### Números reales del 28-sep-2026 (para la maqueta)

645 alumnos activos en 28 clases (134 Infantil · 280 Primaria · 231 Secundaria) · 485 familias,
135 con 2+ hijos · 83 altas de 2026 · 66 de otra nacionalidad · banco 399 de 428 en cursos con
banco (93 %) · AMPA 16 · Tekman 22 de 414 pagados · licencias: 254 pedidos de 282 alumnos,
8.609,20 € · 54 profes activos (7 EI · 18 EP · 18 ESO · 11 sin etapa) · 11 salidas abiertas,
201 justificantes de 215 · 8 registros ABC · puntualidad, a cero.

## Lo que salió al contar (28-sep-2026)

Contar todo junto destapa lo que cada pantalla por separado no deja ver. Ninguna se ha
tocado: son para que David decida.

- **85 alumnos con `banco_libros = true` en cursos sin banco** (Infantil y 1º-2º EP): los 24
  de 3 años B, 41 de 43 en 2º EP. Es el `DEFAULT true` de la columna. El panel del banco lo
  esquiva porque solo pinta desde 3º EP, pero quien cuente a pelo dice 484 en vez de 399. La
  pantalla nueva cuenta solo en cursos con banco y lo avisa. Arreglarlo es un `UPDATE` sobre
  datos reales: decisión de David.
- **El AMPA está casi entera en una clase**: 15 de los 16 socios en 1º ESO A, cero en otras
  26 clases. O se empezó por esa clase o fue un «todos sí» sin querer.
- **4º EP A tiene dos tutores y ninguno de sus 25 alumnos tiene tutor personal**. Las otras
  siete clases con dos tutores están al 100 %.
- **131 alumnos sin teléfono de emergencia**, concentrados en 4º y 5º EP (14, 16, 18 y 20 por
  clase). Parece cosa del export de esas clases, no de familias sueltas.
- **Tarjeta sanitaria**: la tienen 231 de 645.
- **Licencias: la campaña sigue en `open` con el plazo vencido el 15-sep**, porque aún se
  mandan códigos. La portada ya la esconde (`campaignAbierta`). Para esta pantalla la regla
  buena es «mientras no esté **cerrada**», no «mientras esté en plazo».
- El escritorio cuenta los pedidos de licencias **sin excluir los archivados** (hoy no hay
  ninguno archivado, así que no cambia la cifra).

## Dónde se ven números hoy

Ninguna de estas pantallas tiene «copiar tabla» y casi ninguna llega a la etapa. La nueva
**no quita ninguna**; cada una puede enlazar aquí.

| Pantalla | Qué cuenta | Nivel |
|---|---|---|
| Escritorio (`/gestion`) | alumnado y profesorado activos, pedidos de licencias, registros ABC | colegio |
| Alumnado | alumnos por clase (chips), «con algún no», banco/AMPA, pagados por material; informes PDF/Excel/CSV | clase |
| Banco de libros | participan/alumnos por clase con subtotal de curso (el AMPA se calcula y no se pinta) | clase, curso |
| Licencias | alumnos, con pedido, faltan, no pedirán; economía (previsto, cobrado); envíos | curso (con códigos «6PRI») |
| Salidas | justificantes entregados / pendientes / no van por salida | salida |
| Puntualidad | retrasos, alumnos, retraso medio; rankings por clase y asignatura | clase |
| Tutorías | tutorías asignadas, alumnos por clase, con tutor personal | clase |
| ABC · Evaluaciones · Cuaderno | registros; respuestas/objetivo; alumnos por lista | varios |

---

## Plan técnico

**Sin tablas nuevas** (hasta la fase 3). Todo se calcula al abrir.

```
src/lib/numeros.ts             # puro, con tests: catálogo de columnas por pestaña, árbol
                               # colegio → etapa → curso → clase (subtotales sumando), %,
                               # y los tres serializadores: TSV, HTML y texto de WhatsApp
src/lib/numeros-server.ts      # recuentosPorClase(user): UNA tanda de consultas en Promise.all,
                               # cada una `GROUP BY curso, letra` con `count(*) FILTER (WHERE …)`
src/app/gestion/numeros/       # layout (guard del módulo) + page (force-dynamic) + loading
src/components/numeros/        # panel (pestañas, nivel, filtros, tabla), copiar, frase
```

- **Una tanda.** Alumnado (`edu_students`, con `extra` solo en las claves que se cuentan),
  materiales, licencias, banco (`bl_asignaciones`), tutorías, salidas, puntualidad: siete u
  ocho consultas en paralelo cuestan lo mismo que una (~130 ms, ver `04-convenciones`). Nunca
  `select *` de una tabla con `extra`.
- **El servidor manda recuentos por clase y nada más.** Subtotales, %, niveles y pestañas se
  hacen en el cliente: cambiar de pestaña o de nivel no cuesta ni una petición. ~28 filas × ~60
  números = unos pocos KB.
- **Lo que no te toca no viaja**: las becas llegan ya sumadas a pagado, la protección de datos
  solo de tu alcance, licencias solo con el módulo y la campaña. Se recorta en
  `numeros-server.ts` con los mismos helpers de `permissions.ts`, no con CSS.
- **Copiar**: `navigator.clipboard.write` con `text/html` + `text/plain` (el HTML hace que Docs
  y Gmail respeten la tabla; el TSV, que Sheets reparta en celdas), con el respaldo de
  `copiarTexto` de `src/components/alumnado/copiable.tsx` (iPads por IP local).
- **Tocar un número → Alumnado filtrado**: `/gestion/alumnado?clase=…&filtro=…`. Alumnado aún
  no entiende `filtro`; es la parte de fase 2 que toca otro módulo.
- **Etiquetas de etapa**: hay siete copias locales de `{EI:'Infantil', …}`. Esta pantalla usa
  `ETAPA_LABELS` de `src/lib/cuaderno/campos.ts` (o se sube a `cursos.ts` en el mismo commit).

### Permisos (propuesta, pendiente de David)

Módulo nuevo `numeros` en `src/lib/permissions.ts`. Dirección, jefatura, orientación,
secretaría y TIC ven el cole entero; **tutor**, su etapa (la regla de Alumnado,
`alcanceAlumnado`); profe, no. Dentro, cada pestaña exige lo de su módulo (ver la tabla de
arriba).

---

## Checklist

### Fase 1 · La tabla
- [ ] Decisiones de David (las cuatro de `00-desarrollos-futuros.md` → «Números del cole»)
- [ ] `numeros.ts`: columnas por pestaña, árbol con subtotales, %, TSV / HTML / WhatsApp (con tests)
- [ ] `numeros-server.ts`: recuentos por clase en una tanda, con el recorte por permisos
- [ ] Módulo `numeros` en permisos y tarjeta en el escritorio (sección de gestión)
- [ ] Pantalla: cifras copiables, pestañas Resumen · Banco y AMPA · Materiales · Protección de
      datos, nivel etapa/curso/clase, filtro de etapa, números o %
- [ ] Copiar tabla en los tres formatos, probado pegando en Sheets, Docs, Gmail y WhatsApp
- [ ] Frase lista para pegar al tocar una fila
- [ ] Probado en claro y oscuro, a 1180 px y en iPad vertical; como TIC y como tutor
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` en verde

### Fase 2 · Lo del equipo
- [ ] Pestaña Licencias (quien tiene `licencias`, campaña no cerrada)
- [ ] Pestaña Datos que faltan y avisos de «esto no cuadra»
- [ ] Tocar un número abre Alumnado filtrado (`?filtro=` en Alumnado)
- [ ] Salidas y Puntualidad por clase
- [ ] Selector de material cuando haya más de uno

### Fase 3 · La memoria
- [ ] «Foto» de los números a una fecha (el 1 de octubre, para la memoria o Conselleria): la
      única parte con tabla propia (`num_fotos`)
- [ ] Comparar con el curso pasado
- [ ] Excel con todas las pestañas a la vez
