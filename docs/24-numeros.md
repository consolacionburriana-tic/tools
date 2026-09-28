# Números del cole · plan y checklist

Una sola pantalla, **`/gestion/numeros`**, con todos los recuentos del colegio que hoy están
repartidos en nueve pantallas: cuántos alumnos hay, cuántas familias (y cuántos papeles hay
que imprimir), cuántos están en el banco de libros, cuántos han pagado Tekman, cuántas
familias son del AMPA, cuántos pedidos de licencias faltan… **por clase, por curso, por etapa
y del cole entero**, todo listo para copiar y pegar en un Sheet, un Doc, un correo o un
WhatsApp, y con **fotos mensuales** para ver cómo evoluciona.

Lo pidió David el 28-sep-2026: «hay varios sitios donde se puede ver el número total de
alumnos, por clase, si son o no del banco de libros… quizá podemos tener un lugar que sea
"Números y resumen"». Es la idea de «dashboard agregado de dirección» de
`00-desarrollos-futuros.md`, con otro enfoque: más que un panel de gráficos es una **tabla
de recuentos que se puede copiar**, y un histórico al lado.

**Maqueta interactiva con los números reales del 28-sep-2026** (versión 2, con lo decidido):
<https://claude.ai/artifact/L1hPaEoBXnkovpiwApr12s>

---

## Estado: plan funcional ✅ · plan técnico ✅ · implementado 🟡

En `/gestion/numeros` desde el 28-sep-2026, con las **ocho pestañas** (Resumen, Familias y
papeles, Banco y AMPA, Materiales, Protección de datos, Licencias, Perfil del alumnado y Datos
que faltan), copiar para Sheets / Docs / WhatsApp (imagen), **fotos mensuales** y la vista
**Histórico**. Probado contra Neon con sesión de TIC y de una tutora de 2º ESO B. `num_fotos`
aplicada en Neon, con una primera foto a mano del 28-sep-2026 («arranque del módulo»); la
primera mensual la hará el cron el 1-oct-2026 (hace falta el despliegue con `vercel.json`).

Queda: botón A4 en PDF, tocar un número → Alumnado filtrado, Salidas y Puntualidad por clase,
y la IA (ver checklist).

---

## Decisiones cerradas

1. **Módulo nuevo, `numeros`**, con su tarjeta en el escritorio. Alumnado responde «¿quién
   es?» y esto «¿cuántos?», y además junta cosas que no son de Alumnado (licencias, salidas,
   profesorado). Se enlazan: tocar un número abre Alumnado con ese filtro.
2. **Quién entra.** Dirección, jefatura, orientación, secretaría y TIC ven el cole entero.
   Los **tutores, su etapa** (la regla de Alumnado, `alcanceAlumnado`), y la pantalla **se lo
   dice arriba y en grande** («Estás viendo Secundaria, tu etapa»), no en letra pequeña.
   Profe, no. Dentro, lo sensible se recorta en el servidor como ya se hace: becas sumadas a
   pagado, protección de datos solo de su tutoría (y por eso el tutor no tiene esa pestaña),
   ABC nunca por clase.
3. **Licencias: solo TIC, secretaría y equipo directivo**, y solo mientras la campaña **no
   esté cerrada** (`status !== 'closed'`; no `campaignAbierta`, que da el plazo por vencido
   cuando aún se mandan códigos). Hoy son los roles con el módulo `licencias` (`direccion`,
   `secretaria`, `tic`, `supertic`). Jefatura **no**: el rol `jefe` es «Jefatura/Coord.» y
   lleva también coordinadores; si algún jefe de estudios la necesita, se le da el módulo a
   mano en `/gestion/usuarios`.
4. **«Solo lo básico».** Un interruptor que deja una o dos columnas por pestaña (en Resumen,
   solo «Alumnos»: cuántos hay en cada clase). Los datos finos (chicas/chicos, nuevos…) siguen
   ahí con el interruptor apagado. Se recuerda por persona (`localStorage`).
5. **Copiar para WhatsApp es una imagen**, no texto: la tabla se dibuja en un PNG (siempre
   en claro, con los colores de etapa) y se copia; en el iPad el botón abre directamente
   «Compartir» (`navigator.share` con el fichero) para elegir WhatsApp. Sheets/Excel y
   Docs/correo siguen como texto (TSV + HTML).
6. **Familias y papeles.** Una pestaña para repartir **un papel por familia, al hermano
   mayor**: cuántas copias hacen falta en cada clase. Si el papel es solo para una etapa, el
   mayor se busca **dentro de esa etapa** (el mayor de Primaria aunque tenga un hermano en la
   ESO). La familia es `edu_students.familia_id` (o el propio alumno si no lo tiene).
7. **Fotos mensuales para el histórico.** El día 1 de cada mes se guarda una foto de todos
   los recuentos por clase (más una a mano cuando se quiera). Es la base del «big data»: se
   pueden sacar todas juntas. El histórico **va aparte**, en una vista «Histórico» con su
   propio interruptor arriba («Hoy | Histórico»), para no mezclar nunca lo de hoy con lo
   congelado.
8. **Más datos de Educamos, sin miedo.** Pestaña «Perfil del alumnado» con lo que da el
   export (ver la tabla de abajo). La simplicidad la da el interruptor, no quitar datos.
9. **Abierto a IA y a imprimir.** «Lo que llama la atención» empieza con reglas sencillas y
   deja el hueco para un botón «Pedir análisis» a Gemini (solo recuentos, nunca nombres). Y
   un botón **A4**: una hoja, una por etapa o una por clase.
10. **Un poco de color**, sin pasarse: un color por pestaña (en el punto, la barra y el
    borde), y un color por etapa en filas de subtotal, puntos y gráficos (naranja Infantil,
    azul Primaria, verde Secundaria; validados para daltonismo en claro y oscuro).
11. **Se limpió el banco en cursos sin banco** (ver abajo), y se arregló en el sync para que
    no vuelva.

---

## La pantalla

1. **Cabecera**: «Números del cole», curso y hora de los datos. A la derecha, **Hoy |
   Histórico**.
2. **Aviso de alcance** (solo tutores): «Estás viendo Secundaria, tu etapa».
3. **Cifras del cole**: alumnos, familias (= papeles), banco, AMPA, cada material,
   profesorado y, si toca, pedidos de licencias. Tocar una la copia.
4. **La tabla**:
   - **Pestañas**: Resumen · Familias y papeles · Banco de libros y AMPA · Materiales ·
     Protección de datos · Licencias · Perfil del alumnado · Datos que faltan (más Salidas y
     Puntualidad en la fase 2).
   - **Solo lo básico** · nivel **etapas / cursos / clases** (subtotales intercalados y fila
     final de todo el cole) · filtro de etapa · **Nº o %**.
   - **Copiar tabla** para Sheets / Excel (TSV + HTML: se pega en A1 y cada número cae en su
     celda), Docs / correo (tabla con formato) o **WhatsApp (imagen)**. Botón **A4**.
   - **Tocar una fila** escribe la **frase para pegar** («Para dar un papel por familia en
     3º EP hacen falta 27 copias, no 45…»). **Tocar un número** abre Alumnado filtrado.
   - **Lo que llama la atención**: dos o tres frases sobre lo que se está viendo.
5. **Histórico**: evolución mensual por etapa del número elegido (alumnos, familias, banco,
   licencias…), con cursor y valores al pasar; **comparar dos fotos** cualquiera (antes →
   después, con +/−); la tira de fotos guardadas; y copiar la serie para un Sheet.

## Lo que se puede contar, y de dónde sale

Todo se parte por clase, curso, etapa y colegio porque todo cuelga de `curso` + `letra` de
`edu_students`. Etapa y orden, con `etapaDeCurso` / `compararClases` de `src/lib/cursos.ts`;
el PDC se suma a su curso de ESO (`cursoBaseEso`), igual que en el resto de la app.

| Pestaña | Qué cuenta | De dónde | Quién |
|---|---|---|---|
| Resumen | alumnos, chicas/chicos, clases y media, nuevos este curso (`extra['FECHA ALTA']` del año), con hermanos | `edu_students` | todo el que entra |
| Familias y papeles | familias distintas; papeles por clase (una por familia, al mayor del cole o de la etapa); hermanos pequeños | `edu_students.familia_id` | todo el que entra |
| Banco y AMPA | participan / no, **solo en cursos con banco** (`cursoEnBanco`); lotes, entregados, documentación, libros valorados; AMPA | `edu_students` + `bl_*` | todo el que entra |
| Materiales | por material: a cuántos va, pagado, no, **becado**, no aplica, sin marcar, recaudado | `mat_*` (`aplicaMaterial`) | becado solo `veBecasMateriales` |
| Protección de datos | todo sí / parcial / todo no / sin constar, noes por permiso, desestiman el correo | `edu_students.pd_*` | `veProteccionDatosCompleta` |
| Licencias | con pedido, faltan, no pedirán, importe, cobrado, licencias y códigos enviados | `lic_*` | TIC, secretaría, dirección · campaña no cerrada |
| Perfil del alumnado | edad media; **con nosotros desde los 3 años** (fecha de alta); **mayores que su curso** por año de nacimiento (casi siempre repetición); otra nacionalidad y país; **de fuera de Burriana** (localidad del tutor 1); familia numerosa; hijos de empleados | `edu_students` + `extra` + `edu_guardians` | equipo directivo, orientación, secretaría, TIC |
| Datos que faltan | sin NIA, DNI, tarjeta sanitaria, teléfono de emergencia, cuenta Google, número de lista; sin tutor personal donde hay dos tutores | `edu_students` + `extra` + `cuad_numeracion` + `edu_tutor_personal` | secretaría, TIC, tutores (su etapa) |
| Salidas (fase 2) | salidas abiertas, apuntados, justificantes, no van | `sal_*` | con su alcance |
| Puntualidad (fase 2) | retrasos por clase (semana/mes/curso), sin justificar, patios pendientes | `pun_*` + `con_*` | con su alcance |
| Profesorado | activos por etapa, sin etapa, tutores por clase | `edu_teachers` + `edu_tutorias` | jefatura, dirección, secretaría, TIC |

«Mayores que su curso» se calcula con el año que toca (curso 2026-27: 3 años → 2023, 1º EP →
2020, 1º ESO → 2014) y lleva candado: es información académica.

### Números reales del 28-sep-2026 (los de la maqueta)

645 alumnos en 28 clases (134 Infantil · 280 Primaria · 231 Secundaria) · **485 familias**
(135 con 2+ hijos, 16 con 3+; 160 alumnos con un hermano mayor) · 83 altas de 2026 (47 de
ellas, 3 años) · 66 de otra nacionalidad · 25 familias de fuera de Burriana · 33 mayores que su
curso · banco 399 de 428 en cursos con banco (93 %) · AMPA 16 · Tekman 22 de 414 pagados ·
licencias: 254 pedidos de 282 alumnos, 8.609,20 € · 54 profes activos (7 EI · 18 EP · 18 ESO ·
11 sin etapa) · 11 salidas abiertas, 201 justificantes de 215 · 8 registros ABC · puntualidad,
a cero.

## Lo que salió al contar (28-sep-2026)

- ✅ **85 alumnos con `banco_libros = true` en cursos sin banco** (Infantil y 1º-2º EP: 32 en
  3 años, 41 en 2º EP…). Venía del `DEFAULT true` de la columna: el sync de Educamos no decía
  nada del banco al dar de alta. **Limpiado en Neon el 28-sep-2026** (decisión de David; 85
  filas a `false`, el banco da 399) y **arreglado en el sync**: `bancoTrasCambioDeCurso()` en
  `cursos.ts` (con tests) da de alta en el banco solo si el curso lo tiene, marca al entrar en
  un curso con banco (2º → 3º EP) y desmarca al salir; entre dos cursos del mismo lado
  respeta lo marcado.
- **El AMPA está casi entera en una clase**: 15 de los 16 en 1º ESO A, cero en otras 26
  clases. O se empezó por esa clase o fue un «todos sí» sin querer. Que lo mire quien lo marcó.
- **4º EP A tiene dos tutores y ninguno de sus 25 alumnos tiene tutor personal**. Las otras
  siete clases con dos tutores están al 100 %.
- **131 alumnos sin teléfono de emergencia**, 68 en 4º y 5º EP. Parece cosa del export de
  esas clases.
- **Licencias: la campaña sigue en `open` con el plazo vencido el 15-sep** (aún se mandan
  códigos). De ahí la regla de la decisión 3.
- El escritorio cuenta los pedidos de licencias sin excluir los archivados (hoy no hay).
- La localidad viene escrita de dos maneras (`BORRIANA` 431, `BURRIANA` 167): el recuento las
  junta.

## Dónde se ven números hoy

Ninguna tiene «copiar tabla» y casi ninguna llega a la etapa. La nueva **no quita ninguna**;
cada una puede enlazar aquí.

| Pantalla | Qué cuenta | Nivel |
|---|---|---|
| Escritorio (`/gestion`) | alumnado y profesorado activos, pedidos de licencias, registros ABC | colegio |
| Alumnado | alumnos por clase, «con algún no», banco/AMPA, pagados por material; informes PDF/Excel/CSV | clase |
| Banco de libros | participan/alumnos por clase con subtotal de curso | clase, curso |
| Licencias | con pedido, faltan, no pedirán; economía; envíos | curso (con códigos «6PRI») |
| Salidas | justificantes entregados / pendientes / no van | salida |
| Puntualidad | retrasos, alumnos, retraso medio; por clase y asignatura | clase |
| Tutorías | tutorías asignadas, alumnos por clase, con tutor personal | clase |
| ABC · Evaluaciones · Cuaderno | registros; respuestas/objetivo; alumnos por lista | varios |

---

## Plan técnico

```
src/lib/numeros.ts             # puro, con tests: catálogo de columnas por pestaña (con `basic`),
                               # árbol colegio → etapa → curso → clase (subtotales sumando), %,
                               # serializadores TSV / HTML, frases y reglas de «lo que llama la atención»
src/lib/numeros-imagen.ts      # la tabla a PNG en un <canvas> (cliente), para WhatsApp
src/lib/numeros-server.ts      # recuentosPorClase(user): UNA tanda de consultas en Promise.all,
                               # cada una `GROUP BY curso, letra` con `count(*) FILTER (WHERE …)`;
                               # el recorte por permisos se hace aquí
src/lib/numeros-fotos.ts       # guardarFoto() y leer fotos (fase 3)
src/app/gestion/numeros/       # layout (guard del módulo) + page (force-dynamic) + loading
src/app/api/numeros/foto/      # cron del día 1 (CRON_SECRET) y foto a mano (fase 3)
src/components/numeros/        # panel, tabla, copiar, frase, histórico
```

- **Una tanda.** Alumnado, familias, materiales, licencias, banco, tutorías, salidas y
  puntualidad: siete u ocho consultas en paralelo cuestan lo mismo que una (~130 ms). Nunca
  `select *` de una tabla con `extra`: se piden solo las claves que se cuentan
  (`extra->>'FECHA ALTA'`, `'NACIONALIDAD ALUMNO'`, `'FAM.NUMEROSA'`…).
- **Papeles por familia**, en SQL: `row_number() over (partition by coalesce(familia_id,
  id::text) order by orden_curso desc, fecha_nacimiento)` y contar los `rn = 1` por clase. Se
  calcula dos veces en la misma consulta: particionando por familia (papel del cole) y por
  familia + etapa (papel de etapa).
- **El servidor manda recuentos por clase y nada más** (~28 filas × ~60 números). Subtotales,
  %, niveles, pestañas y «solo lo básico» se hacen en el cliente: cambiar de pestaña no cuesta
  una petición.
- **Lo que no te toca no viaja**: becas sumadas a pagado, protección de datos solo de tu
  alcance, licencias solo con el permiso y la campaña, «mayores que su curso» solo para quien
  lo ve. Con los helpers de `permissions.ts`, no con CSS.
- **Copiar**: `navigator.clipboard.write` con `text/html` + `text/plain`, y el respaldo de
  `copiarTexto` (`src/components/alumnado/copiable.tsx`). La imagen: `canvas.toBlob` →
  `ClipboardItem({'image/png'})`; en iPad, `navigator.share({ files })`; si nada vale, se
  enseña la imagen para mantenerla pulsada.
- **A4**: PDF con `pdf-lib`, como los informes de Alumnado (`alumnado-informe-formatos.ts`):
  una hoja, una por etapa o una por clase.
- **Tocar un número → Alumnado filtrado**: `/gestion/alumnado?clase=…&filtro=…`. Alumnado aún
  no entiende `filtro`; es la parte de fase 2 que toca otro módulo.
- **Etiquetas de etapa**: hay siete copias locales de `{EI:'Infantil', …}`; esta pantalla usa
  `ETAPA_LABELS` de `src/lib/cuaderno/campos.ts` (o se sube a `cursos.ts` en el mismo commit).

### Fotos mensuales (fase 3)

Tabla `num_fotos`, la única nueva del módulo (SQL aditivo en `src/db/sql/numeros-fotos.sql`,
apuntado en `pendientes.txt`):

| Columna | |
|---|---|
| `id` uuid | |
| `tomada_at` timestamp | cuándo |
| `academic_year` text | `2026-27` |
| `origen` text | `'mensual'` (cron) · `'manual'` (botón, con nota) |
| `nota` text | «para la memoria», «antes de la campaña»… |
| `version` int | versión del formato de `datos`, para poder leer fotos viejas cuando se añadan números |
| `datos` jsonb | los recuentos **por clase** tal cual los da `recuentosPorClase` (sin recorte por permisos: la foto es completa y se recorta al leerla) |
| `creada_por` text | correo, o `cron` |

- Unas 28 clases × ~60 números: ~15 KB por foto, ~180 KB al año. Sin prisa por limpiar nada.
- **Cron el día 1 a las 6:00** en `vercel.json` (como los de Puntualidad y el Cuaderno), con
  `CRON_SECRET`. Idempotente: si ya hay foto mensual de ese mes, no hace otra.
- **Solo recuentos, nunca personas**: una foto no dice quién, así que no arrastra datos
  personales al histórico.
- Para el «big data»: botón «Sacar todas las fotos» (Excel largo: una fila por foto × clase ×
  número), que es lo que se le da a una hoja de cálculo o a un modelo.

### Análisis con IA (fase 4)

«Lo que llama la atención» nace con reglas (la clase más llena, la de menos banco, dónde se
concentra lo que falta). Después, un botón «Pedir análisis» manda **los recuentos** de la
tabla (y, si hay, las últimas fotos) a Gemini y devuelve tres frases. Nunca nombres ni nada
por alumno. Necesitará su variable de entorno y su decisión de proveedor.

---

## Checklist

### Fase 1 · La tabla
- [x] `numeros.ts`: columnas por pestaña (con `basico`), árbol con subtotales, %, TSV / HTML, frases, «lo que llama la atención», recorte por permisos y preferencias (con tests: `numeros.test.ts`)
- [x] `numeros-server.ts`: recuentos por clase en una tanda (papeles por familia, perfil y datos que faltan incluidos); cuadra con los recuentos a mano del 28-sep-2026 (645 · 485 familias · banco 399/428 · 254 pedidos)
- [x] Módulo `numeros` en permisos (dirección, jefatura, orientación, secretaría, TIC y tutor), `vePerfilAlumnado`, `puedeHacerFotosNumeros`, y tarjeta en el escritorio
- [x] Pantalla: cifras copiables, pestañas con su color, «solo lo básico», nivel etapa/curso/clase, filtro de etapa, Nº o %
- [x] Aviso grande de etapa para tutores (probado: una tutora de 2º ESO B ve las 10 clases de Secundaria y 5 pestañas)
- [x] Copiar tabla: Sheets / Excel (TSV + HTML), Docs / correo (HTML) y WhatsApp como imagen PNG («Compartir» en pantallas táctiles, portapapeles en el ordenador, y si no, la imagen para mantenerla pulsada). Probada la imagen copiada al portapapeles
- [x] Preferencias por persona en una cookie que lee el servidor (sin parpadeo)
- [x] Frase para pegar al tocar una fila; tocar un número lo copia
- [x] `pnpm test` y `pnpm build` en verde; `pnpm lint` sin nada nuevo (los errores que salen son de ficheros de antes)
- [ ] Probado en iPad vertical y en oscuro por David; pegado de verdad en Sheets, Docs y WhatsApp

### Fase 2 · Lo del equipo
- [x] Pestaña Licencias (TIC, secretaría, dirección; campaña no cerrada)
- [x] Pestañas Perfil del alumnado y Datos que faltan
- [x] Selector de material cuando haya más de uno
- [ ] Tocar un número abre Alumnado filtrado (`?filtro=` en Alumnado)
- [ ] Salidas y Puntualidad por clase
- [ ] Botón A4 (PDF: una hoja, una por etapa, una por clase)

### Fase 3 · Fotos e histórico
- [x] `num_fotos` (`numeros-fotos.sql`, aplicado en Neon el 28-sep-2026) y `guardarFoto()`
- [x] Cron del día 1 a las 5:00 UTC en `vercel.json` (`/api/numeros/cron/foto`, `CRON_SECRET`, idempotente) y botón de foto a mano con nota (`POST /api/numeros/fotos`, secretaría/dirección/TIC; probado el 403 de una tutora y el 401 del cron sin secreto)
- [x] Vista Histórico: evolución por etapa, comparar dos fotos por curso, tira de fotos, copiar la serie
- [ ] Ver la primera foto mensual del 1-oct-2026 (necesita el despliegue)
- [ ] Sacar todas las fotos juntas (Excel largo)

### Fase 4 · Análisis
- [ ] «Pedir análisis» a Gemini con los recuentos (sin nombres), con su variable de entorno
- [ ] Informe de varias hojas A4 con números y análisis

### Hecho fuera de fase
- [x] Limpiar las 85 casillas de banco en cursos sin banco (Neon, 28-sep-2026) y arreglar el
      sync de Educamos (`bancoTrasCambioDeCurso`, con tests)
