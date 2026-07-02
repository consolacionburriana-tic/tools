# Banco de libros · plan y checklist

Módulo de gestión del banco de libros: qué alumnado participa, si se le ha entregado su lote, si
ha entregado la documentación requerida, y en qué estado físico está cada lote. Es el **hito 5
del roadmap**.

> Nota: este módulo es distinto del "banco de libros" que ya aparece en Licencias digitales
> (`lic_students.banco_libros`, que solo indica si un alumno paga o no los libros fuera del
> banco). Este módulo nuevo gestiona el **lote físico** y su seguimiento curso a curso.

---

## Estado: plan técnico listo ✅ · implementación sin empezar ⬜

Depende de: BBDD central (`02-integracion-educamos.md`) y auth/roles (`01-auth-roles.md`).
David señaló el diseño del modelo anual como el punto a pensar mejor — está resuelto abajo
(lote físico estable + asignación por curso académico), pero la Fase 0 incluye validarlo con
datos reales antes de construir encima.

## Decisiones cerradas

- **Los registros son POR CURSO ACADÉMICO.** Cada año se guarda qué lote tuvo qué alumno y en
  qué estado quedó todo; el histórico no se sobrescribe jamás.
- **La asignación lote→alumno se hace a mano desde el panel**: "1ºESO A, lote 15 → alumno X"
  (buscando el alumno en la BBDD central `edu_students`).
- **Estado del libro/lote**: `Nuevo` · `Muy bien` · `Bien` · `Regular` · `Mal` · `Mojado`.
- **Se registra además**: `borrado` (sí/no, por defecto **sí**) y `forrado` (sí/no, por
  defecto **sí**).
- **Documentación firmada** (inicio y fin de curso) sigue siendo papel: la app solo marca
  recibido **sí/no**, por clase y con **botones bulk** para marcar muchos de golpe.
- **De primeras, todos los roles con acceso al módulo acceden a todo** (sin restricción por
  tutor/asignatura; se afinará si hace falta).

## Plan técnico

### Schema (`bl_*`)

El objeto físico (lote) es estable; lo que cambia cada año es a quién se asigna y cómo queda.

```ts
bl_lotes (
  id uuid pk,
  curso text, letra text,             // la clase a la que pertenece el lote: '2ESO' 'A'
  numero integer,                     // nº de lote dentro de la clase
  activo boolean default true,
  unique(curso, letra, numero)
)

bl_asignaciones (                     // UNA fila por lote y curso académico
  id uuid pk,
  lote_id -> bl_lotes,
  academic_year text,                 // '2026-27'
  student_id -> edu_students,
  entregado boolean default false,        // lote entregado al alumno
  doc_inicio boolean default false,       // documentación firmada inicio de curso
  doc_fin boolean default false,          // documentación firmada fin de curso
  estado text,                            // 'nuevo'|'muy_bien'|'bien'|'regular'|'mal'|'mojado'
  borrado boolean default true,
  forrado boolean default true,
  notas text,
  revisado_por uuid -> auth_users, revisado_at timestamp,
  created_at, updated_at,
  unique(lote_id, academic_year)
)
```

- El histórico sale gratis: `select * from bl_asignaciones where lote_id = X order by
  academic_year` = la vida del lote. Y por alumno, igual con `student_id`.
- **Quién participa en el banco vive en `edu_students.banco_libros`** (default `true`, con
  toggle+bulk en `/gestion/educamos` — ver `02-integracion-educamos.md`). Este módulo lo
  consume: las pantallas de asignación solo ofrecen alumnado con `banco_libros=true` (con
  filtro para ver también a los que no, por si hay que corregir el flag). Tener asignación en
  el `academic_year` en vigor = participa *efectivamente* este año.
- El curso académico en vigor: constante en `src/lib/constants.ts` o tabla mínima de config —
  decidir al implementar (no bloquea).

### Rutas (todo panel interno, `/gestion/bancolibros`)

- **Vista por clase** (pantalla principal): selector curso+letra → tabla de lotes con alumno
  asignado, checkboxes de entregado/doc_inicio/doc_fin (con **bulk buttons**: "marcar toda la
  clase"), estado, borrado, forrado. Edición inline, pensada para pasar lista rápido con iPad.
- **Asignación anual**: al empezar curso, por clase: lista de lotes + buscador de alumno de esa
  clase (desde `edu_students`) para asignar. Botón "copiar lotes del año pasado" (crea los
  lotes que falten).
- **Ficha de lote**: histórico año a año.
- API: `api/bancolibros/*` protegido con `requireModule('bancolibros')`.

## Fases

### Fase 0 · Validación del modelo y schema
- [ ] Validar el modelo con un caso real (2 años de datos de una clase, aunque sea en papel)
- [ ] Schema `bl_*` + `pnpm db:push`
- [ ] Decidir dónde vive el `academic_year` en vigor (constante vs. config)

### Fase 1 · Lotes y asignación anual
- [ ] Alta de lotes por clase (individual y "crear N lotes de golpe")
- [ ] Asignación lote→alumno con buscador sobre `edu_students` (filtrado por defecto a
      `banco_libros=true` de esa clase)
- [ ] Ficha de lote con histórico

### Fase 2 · Entrega y documentación
- [ ] Vista por clase con checkboxes entregado / doc_inicio / doc_fin
- [ ] Bulk buttons por clase (marcar/desmarcar todos)

### Fase 3 · Revisión de estado
- [ ] Registro de estado (6 valores), borrado y forrado por asignación, con revisor y fecha
- [ ] Vista agregada: resumen por clase/curso (cuántos entregados, estados, pendientes de doc)
- [ ] Export CSV por clase/curso
