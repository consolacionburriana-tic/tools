# Banco de libros · plan y checklist

Módulo de gestión del banco de libros: qué alumnado participa, qué **lote numerado** tiene
asignado cada año, y en qué estado queda **cada libro** del lote (el "Registro de valoración
de los libros" que hoy se rellena en un Word por asignatura y clase). Es el **hito 5 del
roadmap**.

> Nota: distinto del flag de Licencias (`lic_students.banco_libros`, que solo indica si un
> alumno paga o no los libros). Este módulo gestiona el **lote físico** y su seguimiento.

---

## Estado: implementado ✅ (2026-09-01) — AMPA, resumen agregado y libros manuales añadidos

Depende de: BBDD central (✅) · auth/roles (✅) · catálogo de libros de Licencias (✅,
`lic_books.banco_libros` marca qué libros son del banco).

## Decisiones cerradas

- **Quién participa vive en `edu_students.banco_libros`** (default `true`). Se gestiona desde
  este módulo: listado por clase con toggle sí/no y bulk (David: "quiero tener claramente
  listados quiénes son del banco y quiénes no y poder cambiar con facilidad").
- **El lote es un número dentro de una clase** (ej. lotes de 1ºESO A, del 1 al 30) y **se
  asigna por curso académico**: cada año se guarda qué lote tuvo qué alumno. El histórico no
  se sobrescribe jamás. El "Nº CLASE" del Word es exactamente este número de lote.
- **La valoración es POR LIBRO, no por lote entero** (2026-07-11, fijado con el Word real
  `LENGUA_1_ESO_A.docx`): para cada libro del banco de un curso (de `lic_books` con
  `banco_libros=true`) y cada clase, se pasa lista alumno a alumno con:
  - `estado`: `Nuevo` · `MB` · `B` · `R` · `M` · `Mojado`
  - `borrado` sí/no (por defecto **sí**) · `forrado` sí/no (por defecto **sí**)
  - notas libres opcionales
- **Todos los roles con acceso al módulo ven y rellenan todo** (cualquier profe puede pasar
  lista de cualquier libro; sin restricción por asignatura, de primeras).
- **Documentación firmada** (inicio/fin de curso) y **entrega del lote**: checkboxes por
  alumno con bulk por clase. Sigue siendo papel; la app solo marca recibido.
- **Curso académico en vigor**: calculado (sep-ago) en `src/lib/constants.ts`
  (`academicYearActual()` → '2025-26'), sin config en BBDD.
- **AMPA** (2026-09-01, David): `edu_students.ampa` (boolean, default `false`) — igual patrón que
  `banco_libros` pero sin lote ni valoración, solo pertenencia. Pestaña propia "AMPA" en el panel
  (toggle sí/no + bulk "todos sí/no"), separada de "Alumnado" porque se reconcilia contra un PDF
  distinto del banco de libros.
- **Marcar participantes (banco y AMPA) es de dirección/TIC, no de tutores** (2026-09-01, David;
  confirmado el mismo día como definitivo: no hace falta abrirlo a jefatura ni a tutores). El
  resto del módulo (lotes, checks de entrega/doc, pasar lista de valoración)
  sigue abierto a cualquier rol con acceso a `bancolibros` — sin cambios ahí. Implementado en
  `puedeGestionarParticipantesBanco()` (`src/lib/permissions.ts`), con guard en las rutas
  `admin/banco` y `admin/ampa` y UI de solo lectura (switch deshabilitado, pestaña AMPA oculta)
  para quien no cumple.
- **Resumen agregado** (por clase, sumado por curso, estilo "Por curso" de Licencias): `<details>`
  plegable encima de los chips de clase — cerrado enseña los totales de un vistazo (X/Y en
  banco, Z AMPA), abierto despliega la tabla por clase con subtotal por curso. Los chips de clase
  también llevan la insignia banco/total para verlo sin entrar. Se recalcula en local al marcar
  (sin refetch) y viene precargado desde el servidor en la carga de página.
- **Libros configurables a mano por curso** (2026-09-01, David: "en principio a mano, porque una
  asignatura puede ser varios libros"): tabla propia `bl_libros_curso`, independiente de
  `lic_books`/Licencias a propósito — evita tocar el catálogo real de la campaña de Licencias
  (público, con precios) desde este módulo. Los libros manuales aparecen mezclados con los del
  catálogo de Licencias en la pestaña Libros, con `bookCod` sintético `manual:<id>` (no choca
  nunca con un COD real), así que la valoración/pasar-lista/ficha funcionan igual para ambos.
  Gestión (añadir / activar / desactivar) reservada a dirección/TIC, dentro de un `<details>` en
  la propia pestaña Libros.

## Flujos (mínimos clicks, iPad-first)

Pantalla principal `/gestion/bancolibros`: **chips de clase** (las reales de `edu_students`)
→ al elegir clase, dos pestañas:

1. **Alumnado** — una fila por alumno de la clase:
   - Toggle grande **banco sí/no** (escribe `edu_students.banco_libros`).
   - **Nº de lote** del año en curso: input numérico pequeño + botón "auto" (siguiente número
     libre de la clase). Asignar un número crea el lote si no existía.
   - Checkboxes `entregado` / `doc inicio` / `doc fin` con **botones bulk** arriba
     ("todos entregado", "todos doc inicio"…).
2. **Libros** — grid con los libros del banco de ese curso (de `lic_books`): cada tarjeta
   enseña el progreso de valoración (X/N alumnos). Tap en un libro → **pasar lista**:
   - Una fila por alumno del banco (con su nº de lote): chips de estado de un toque
     (`Nuevo/MB/B/R/M/Mojado`), toggles `borrado`/`forrado` (ya vienen marcados: solo se toca
     la excepción), notas opcionales.
   - Bulk: "todos MB" / "todos borrado" / "todos forrado" — pasar la lista de una clase
     entera en ~30 segundos si todo está bien.
   - Todo guarda al toque (optimista, sin botón de guardar).

## Plan técnico

### Schema (`bl_*`)

```ts
bl_lotes (
  id uuid pk,
  curso text, letra text,             // clase dueña del lote: '1ESO' 'A'
  numero integer,
  activo boolean default true,
  unique(curso, letra, numero)
)

bl_asignaciones (                     // UNA fila por lote y curso académico
  id uuid pk,
  lote_id -> bl_lotes,
  academic_year text,                 // '2025-26'
  student_id -> edu_students,
  entregado boolean default false,
  doc_inicio boolean default false,
  doc_fin boolean default false,
  notas text,
  created_at, updated_at,
  unique(lote_id, academic_year)
)

bl_libro_registros (                  // valoración de UN libro de UNA asignación (Word digitalizado)
  id uuid pk,
  asignacion_id -> bl_asignaciones,
  book_cod text,                      // COD de lic_books (catálogo con banco_libros=true)
  estado text,                        // 'nuevo'|'mb'|'b'|'r'|'m'|'mojado'
  borrado boolean default true,
  forrado boolean default true,
  notas text,
  revisado_por_email text, revisado_at timestamp,
  unique(asignacion_id, book_cod)
)
```

- Histórico gratis: asignaciones de un lote ordenadas por año = vida del lote; por alumno igual.
- Libros del banco por curso: `lic_books` de la campaña actual con `banco_libros=true` y
  `curso` = curso base de la clase.

### Rutas

- `/gestion/bancolibros` (módulo `bancolibros`): pantalla por clase con las dos pestañas.
- API `api/bancolibros/admin/*`: alumnado de la clase (con lote/checks), toggle banco,
  asignar lote (upsert lote+asignación), checks bulk, libros con progreso, registros de un
  libro + upsert de valoración.

## Fases

### Fase 0 · Schema y cimientos
- [x] Schema `bl_*` + `pnpm db:push` + `academicYearActual()` en constants
- [x] Capa `src/lib/bancolibros-server.ts`

### Fase 1 · Alumnado por clase
- [x] Chips de clase + pestaña Alumnado: toggle banco, nº lote (con "auto" = siguiente libre y detección de conflicto), entregado/doc con bulk

### Fase 2 · Valoración por libro (el Word, digitalizado)
- [x] Pestaña Libros con progreso por libro (X/N valorados)
- [x] Pasar lista: estado one-tap + borrado/forrado + notas, con bulks ('todos MB'…), guardado optimista

### Fase 3 · Extras
- [x] **Ficha imprimible** por libro+clase (`/gestion/bancolibros/ficha`): hoja 1 = tabla de
      valoración (en blanco como plantilla de papel, o con los datos), hoja 2 = miembros del
      banco. Se descarga con Imprimir → Guardar PDF. Con **nº de lista** oficial (orden
      alfabético apellido1 → apellido2 → nombre; PDC es clase aparte).
- [x] ~~Ficha de lote con histórico~~ (David, 2026-07-11: no hace falta)
- [x] Resumen agregado por clase y curso (nº de participantes banco/AMPA, estilo "Por curso" de
      Licencias): `<details>` plegable + insignia en los chips de clase

### Fase 4 · AMPA, permisos y libros manuales (2026-09-01)
- [x] `edu_students.ampa` + pestaña AMPA (toggle sí/no + bulk) en el panel — [~] pendiente
      `pnpm db:push` de David (sin `DATABASE_URL` en esta sesión para aplicarlo)
- [x] Marcar banco/AMPA restringido a dirección/TIC (`puedeGestionarParticipantesBanco`), guard en
      `admin/banco` y `admin/ampa`, UI de solo lectura para el resto de roles
- [x] Tabla `bl_libros_curso` + CRUD (`admin/libros-manual`) para configurar a mano el catálogo de
      libros del banco por curso, combinado con `lic_books` en la pestaña Libros — [~] pendiente
      el mismo `pnpm db:push`
- [x] ~~Revisar si algún rol más necesita marcar participantes~~ (David, 2026-09-01: no, se queda
      solo dirección/TIC)

### Fase 5 · Descuadre con Licencias (2026-09-03) — el bug de "no se actualiza el front"

David reportó dos síntomas que resultaron ser **el mismo problema**: el flag del banco vive en
dos tablas y solo se escribía en una.

- La verdad es `edu_students.banco_libros` (BBDD central), que es lo que escribe este módulo.
- Pero el **formulario público de Licencias** y su panel leen el snapshot de campaña
  `lic_students.banco_libros` (`getCatalog()` en `licencias-server.ts` decide con ese flag qué
  libros ve la familia). El puente entre las dos era el **sync manual de alumnado** de
  `/gestion/licencias/sincronizar`, que nadie ejecutaba después de tocar el banco.

Comprobado en Neon el 2026-09-03: los cambios de David del día 2 **sí estaban guardados** en
`edu_students` (Isabel Porcar `true`, Elena Porcar `false`), y en `lic_students` seguían justo al
revés. 6 alumnos descuadrados en total. Y 13 alumnos activos de cursos con Licencias importados
desde Educamos (entre ellos el NIA 13620087) no tenían fila en `lic_students`, así que su familia
tecleaba el NIA o el NIE del tutor en el formulario y le salía "no encontrado" — el tutor y el
alumno estaban perfectamente en la central.

- [x] `setBanco()` propaga el flag a `lic_students` de la campaña vigente en el mismo acto
      (`propagarBancoACampania()` en `src/lib/bancolibros-server.ts`): el cambio se ve en
      Licencias al instante, sin sync manual.
- [x] Aviso en el panel del banco (solo dirección/TIC) cuando hay alumnado activo de cursos con
      Licencias que no está en la campaña: `getAlumnosFueraDeCampania()` + `<details>` ámbar
      plegable con la lista y enlace directo a `/gestion/licencias/sincronizar`. Así el descuadre
      del alta se ve solo, en vez de descubrirlo porque una familia llama por teléfono.
- [~] **Reparar los datos ya descuadrados**: pendiente de que David ejecute el sync de alumnado
      de Licencias (`/gestion/licencias/sincronizar` → "Alumnado"). Ese sync coge `banco_libros`
      de `edu_students`, así que arregla los 6 descuadres y da de alta los 13 que faltan de una
      pasada. Tiene vista previa antes de escribir.

Y un segundo fallo independiente que agravaba la sensación de "no se guarda": **los guardados
optimistas de los bulks no se revertían si el POST fallaba**. `toggleBanco`/`toggleAmpa` sí
revertían, pero `bulkAmpa`, `bulkCheck`, `setRegistro` y `bulkRegistro` hacían `await post(...)`
sin mirar el resultado: un 403 (rol sin permiso) o un 500 dejaba la pantalla pintada como si
hubiera ido bien, y al recargar volvía todo atrás.

- [x] Los cuatro caminos comprueban el retorno de `post()`: los individuales revierten al valor
      anterior, los bulks **recargan del servidor** (`recargarAlumnado()` / `recargarFilas()` /
      `recargarResumen()`) porque en un bulk el estado previo era distinto para cada alumno.
- [x] Identificación de familias por NIA normalizada en SQL (solo dígitos, sin ceros a la
      izquierda) en `familias-server.ts`, igual que ya se hacía con el documento del tutor. El
      NIA se guarda tal cual viene del Excel, así que una celda numérica o un cero de relleno
      bastaban para que la familia no se encontrara nunca. Hoy los 640 alumnos activos lo tienen
      limpio (comprobado), así que es blindaje, no la causa de este caso.

> **Descartado como causa** (comprobado, para no volver a buscar por ahí): no es caché de Next
> (páginas y rutas GET del módulo ya son `force-dynamic`), no es el service worker (`public/sw.js`
> no cachea HTML ni `/api` a propósito, ver `docs/05-pwa.md`), el UPDATE apunta bien al alumno
> (por `id` uuid validado con Zod) y los índices únicos de `bl_*` **sí están aplicados** en Neon
> (`bl_lotes_clase_numero_uq`, `bl_asignaciones_lote_year_uq`, `bl_libro_registros_uq`), así que
> los `ON CONFLICT` de lotes y valoración funcionan.
