# Alumnado · la ficha de cada alumno

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (navegador y ficha completos y
probados contra datos reales; falta lo que salga de usarlo un par de semanas)

Pantalla de consulta de `/gestion/alumnado`: eliges una clase (o buscas), tocas a un alumno y
tienes **todo lo que la plataforma sabe de él** en una sola vista, con lo importante arriba y
todo lo copiable a un toque.

No es un CRUD. Es **solo lectura y transversal**: no crea tablas ni duplica campos, lee `edu_*`
como identidad y va a preguntar a cada módulo por lo suyo. Editar sigue estando donde estaba
(el banco de libros en su panel, la puntualidad en el suyo), y eso es a propósito: duplicar
datos mutables es exactamente la deuda que documenta
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

6. **Un tutor ve solo sus tutorías.** Mismo criterio y mismo helper (`clasesDeTutor`) que
   Puntualidad, para no tener dos reglas distintas de «quién ve a qué alumno» conviviendo en la
   app. Dirección, jefatura, orientación, secretaría y TIC ven el centro entero. El alcance se
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

---

## Lo que se enseña, y de dónde sale

Inventariado contra los **639 alumnos activos** de Neon (10-sep-2026), no contra el schema:

| En la ficha | De dónde | Cobertura real |
|---|---|---|
| Nombre, apellidos, sexo, nacimiento | `edu_students` (+ `nombresDe` de `personas.ts`) | 639 / 635 con fecha |
| Clase, nº de lista | `edu_students` + `cuad_numeracion` | 352 con número congelado |
| Tutores de la clase y tutor personal | `edu_tutorias` + `edu_tutor_personal` | 28 clases, 101 con tutor personal |
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
| AMPA | `edu_students.ampa` | 15 |
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
src/app/gestion/alumnado/                  # layout (guard de módulo) + página + loading
src/components/alumnado/alumnado-panel.tsx # clases, buscador, lista y orquestación
src/components/alumnado/ficha-alumno.tsx   # la ficha, en el orden de la tabla de arriba
src/components/alumnado/copiable.tsx       # Copiable, Dato y CopiarLista
```

Sin tablas nuevas: **no hay SQL que aplicar**.

### Rendimiento medido (Neon, 639 alumnos)

- `listaAlumnado()`: ~400-500 ms en caliente. Son **dos** viajes a Neon, no seis: la campaña de
  licencias se pide primero (la necesita `estadoPedidos`) y el resto va en un `Promise.all`. La
  primera versión, en cadena, tardaba 2 s.
- `fichaAlumno()`: ~550 ms, 13 consultas en paralelo.
- Buscar y cambiar de clase: 0 peticiones.

### Permisos

Módulo nuevo `alumnado` en `src/lib/permissions.ts`. Lo trae el rol de dirección, jefatura,
orientación, secretaría, TIC y **tutor** (que ve solo lo suyo). `profe` no lo trae: se le puede
dar a mano desde `/gestion/usuarios` como cualquier otro módulo.

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
- [x] Probado el alcance de verdad: un tutor ve sus 23 y la API le da 404 con un alumno de otra clase
- [ ] Exportar a Google Sheets la tutoría entera desde aquí (reutilizando `lista-clase.ts`)
- [ ] Foto del alumno, si algún día se saca de Educamos
- [ ] Lo que salga de usarlo dos semanas

### Pendiente en otros módulos (salió de aquí)
- [ ] **Sync de Educamos**: mapear `TEL EMERGENCIA ALUMNO` a `edu_students.tel_emergencia` y la
      dirección a `edu_guardians.direccion`, en vez de dejarlas solo en `extra`
      (ficha [`02`](./02-integracion-educamos.md))
