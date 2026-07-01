# Banco de libros · plan y checklist

Módulo de gestión del banco de libros: qué alumnado participa, si se le ha entregado su lote, si
ha entregado la documentación requerida, y en qué estado físico está cada lote.

> Nota: este módulo es distinto del "banco de libros" que ya aparece en Licencias digitales
> (`lic_students.banco_libros`, que solo indica si un alumno paga o no los libros fuera del
> banco). Este módulo nuevo gestiona el **lote físico** y su seguimiento curso a curso.

---

## Estado: boceto funcional 🟡 (sin plan técnico, sin implementar) — "a pensar muy bien el diseño"

## Objetivo funcional

- Tener registrado con claridad qué alumnado **es o no** del banco de libros.
- Por cada alumno del banco: si se le ha **entregado el lote**, y si se ha recibido la
  **documentación firmada** que corresponde entregar a principio y a final de curso.
- Cada lote tiene un **número** asociado a una clase/curso concreto (p. ej. lote nº15 de 2ºESO A).
  Ese número se reasocia **cada curso** a un alumno distinto (el lote 15 de este año puede ser
  del alumno 15 de esta clase, pero el año que viene puede tocarle a otro alumno de esa misma
  letra). El modelo tiene que reflejar esta reasignación anual sin perder el histórico.
- Cada profesor **revisa el libro** del alumno en cuestión (asociado a su lote) y dejar constancia
  de su estado: si tiene funda o no, y si está en buen/regular/mal estado.

### Flujo principal (orientativo, a validar con las decisiones pendientes)

1. Alta/objetivo por curso: qué alumnos son del banco de libros ese año y qué lote (número +
   clase) les corresponde.
2. Entrega de lote: marcar que un alumno ha recibido su lote.
3. Documentación: marcar recepción de documento firmado (inicio de curso / fin de curso).
4. Revisión de estado: cada profesor, para el alumno/lote de su clase, registra estado del
   libro (bueno/regular/malo) y si tiene funda.

## Decisiones pendientes

Ver la sección "Banco de libros" en [`desarrollos-futuros.md`](./desarrollos-futuros.md): cómo
se reasocia lote→alumno cada curso, qué valores exactos tienen los estados, si la documentación
se recoge digital o en papel, y quién hace la revisión del libro.

## Apartado técnico (orientativo, a concretar tras cerrar decisiones)

- Prefijo de tablas propuesto: `bl_*`.
- Modelo probable: una tabla de **lotes** por curso académico + clase + número (p. ej.
  `bl_lotes(academic_year, curso, letra, numero)`), y una tabla de **asignaciones** que vincula
  un lote de un curso académico concreto a un alumno concreto (`bl_asignaciones(lote_id,
  student_id, academic_year)`) — así el histórico de "qué alumno tuvo qué lote cada año" queda
  intacto en vez de sobrescribirse.
- Estado del lote (funda, condición) probablemente vive en la propia asignación anual, no en el
  lote en sí (el lote es el mismo objeto físico, pero su estado se revisa y registra cada año).
- Reutilizar alumnado desde Educamos si para entonces ya está disponible (`docs/educamos.md`),
  en vez de repetir un import manual más.

## Fases

### Fase 0 · Decisiones y diseño (el propio David lo señala como el punto que más hay que pensar)
- [ ] Cerrar decisiones funcionales (ver arriba)
- [ ] Validar el modelo lote↔alumno↔curso académico con un caso real (p. ej. 2 años de datos)
- [ ] Diseñar schema (`bl_*`)

### Fase 1 · Alta de lotes y asignación anual
- [ ] Alta de lotes por clase/curso
- [ ] Asignación lote→alumno del curso académico en vigor

### Fase 2 · Entrega y documentación
- [ ] Marcar entrega de lote
- [ ] Marcar recepción de documentación firmada (inicio/fin de curso)

### Fase 3 · Revisión de estado por profesor
- [ ] Formulario de revisión (funda sí/no, estado bueno/regular/malo) por alumno/lote
- [ ] Panel con visión agregada por clase/curso