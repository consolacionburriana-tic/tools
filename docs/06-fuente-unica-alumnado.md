# Una sola fuente de verdad del alumnado · plan

> 🔴 **PRIORIDAD MÁXIMA a partir del 1 de noviembre de 2026.** Decisión de David (2026-09-03).
> Es lo PRIMERO que hay que hacer en cuanto se retome el desarrollo, antes que cualquier otra
> casilla de cualquier otro hito. Si eres un agente y estás leyendo esto en una sesión de
> desarrollo después de esa fecha: **párate y avísale a David antes de ponerte con otra cosa.**

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

Cuatro incidentes distintos, una sola causa: **duplicar datos mutables**.

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

### Fase 1 · Leer en vivo (sin tocar el schema todavía)

Cambio de bajo riesgo y reversible: los sitios que hoy leen los campos duplicados de
`lic_students` pasan a hacer `innerJoin(eduStudents)` y leer de ahí. Los campos duplicados siguen
existiendo en la tabla, simplemente dejan de leerse.

- [ ] `identifyStudentsByFamily()` (`licencias-server.ts:61`) — `curso` desde `edu_students`.
- [ ] `getStudentById()` (`:106`) — devolver el alumno con sus datos vivos.
- [ ] `getCatalog()` (`:111`) — **`student.bancoLibros` desde `edu_students`**. Este es el que
      causó el bug de las Porcar.
- [ ] Los listados y exportaciones: `:167`, `:275`, `:315`, `:369`, `:410`, `:604`, `:1076` y
      `licencias-exports.ts:58`.
- [ ] Recordar `cursoBaseEso()` en el join: los PDC vienen como `3ºPPDC` de la central.
- [ ] Tests de que un cambio en `edu_students` se ve en Licencias **sin sincronizar nada**.

### Fase 2 · Adelgazar la tabla

- [ ] Borrar de `lic_students` las columnas duplicadas: `apellidos`, `apellido1`, `apellido2`,
      `nombre`, `birth_year`, `curso`, `letra`, `email`, `banco_libros`, `lengua_base`,
      `educamos_id`. Se queda: `id`, `campaign_id`, `edu_student_id`, `student_code` (etiqueta
      para exportaciones), `active`, `created_at`.
- [ ] `edu_student_id` pasa a `NOT NULL` (las filas heredadas sin enlace ya están desactivadas).
- [ ] Quitar el parche `propagarBancoACampania()` de `bancolibros-server.ts`: deja de hacer falta.
- [ ] Quitar el aviso `getAlumnosFueraDeCampania()` del panel del banco si el alta pasa a ser
      automática (fase 3); si no, se queda.
- [ ] `pnpm db:push`.

### Fase 3 · Que no haya que acordarse de sincronizar

El sync deja de mover datos y pasa a responder solo una pregunta: *¿quién entra en la campaña?*
Eso ya se puede automatizar sin miedo, porque no pisa nada.

- [ ] Tras aplicar un import de Educamos (`aplicarSync`), dar de alta en la campaña vigente a los
      alumnos nuevos que estén en cursos con Licencias. **Altas sí, bajas no** automáticas: una
      baja debe seguir siendo una decisión con vista previa.
- [ ] Enseñar en el resultado del import cuántos entraron en la campaña.
- [ ] La pantalla de sincronizar se queda para el repaso manual y las bajas.

### Fase 4 · Rematar

- [ ] `docs/11-licencias-v2.md`: actualizar el modelo de datos.
- [ ] `docs/12-bancolibros.md`: la "Fase 5" pasa a ser histórico; el parche ya no existe.
- [ ] Borrar de `docs/pequeños-arreglos.md` lo que este trabajo deje resuelto.

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
