# Registro ABC · plan y checklist

Módulo de registro de conductas disruptivas de alumnado con NEE. Fue el primer módulo del
repo (antes de que existiera este formato de documentación), así que esta ficha documenta a
posteriori lo ya construido y deja abierto lo que falta.

---

## Estado: funcionalmente completo para su alcance actual ✅

- **Formulario** (`/registro-abc`): pensado para rellenarse desde iPad en menos de 90 segundos.
  Auto-guardado de borrador en `localStorage` (debounced 500ms), botón guardar sticky con
  safe-area-inset, animaciones con `motion/react`, haptics en iOS Safari ≥17.4 (PWA) y Android
  Chrome, dark mode automático.
- **Panel** (`/gestion/abc`, migrado desde `/admin` el 2026-07-10): listado de registros con
  filtros, gráficos agregados y configuración del alumnado (destacados + emails de aviso).
  `/admin` redirige. Protegido con el módulo `abc` de la matriz de roles.

## Decisiones cerradas

- **Prefijo de tablas:** `abc_*` (`abc_students`, `abc_behavior_reports`) en `src/db/schema.ts`.
- **Notificación:** cada alumno tiene hasta 20 emails de aviso (`email_recipients`) que reciben
  notificación cuando se guarda un registro suyo.
- **Dónde vive:** formulario en `src/app/(public)/registro-abc` (detrás del login del claustro),
  panel en `src/app/gestion/abc`.
- **Profesor por sesión (2026-07-10):** fuera el selector de profe; el registro guarda
  `edu_teacher_id` resuelto del login. La tabla `teachers` vieja queda SOLO como lectura
  histórica de registros antiguos (no se gestiona; los profes viven en `edu_teachers`).
- **Alumnado (2026-07-10, revisado 2026-08-31):** `abc_students` es la tabla de config del
  módulo, enlazada a `edu_students` por **NIA** (`nia` + `edu_student_id`, ambos únicos). Se dan
  de alta **a mano en el panel**, con un buscador simple (nombre/apellidos/NIA, mínimo 3
  caracteres) que enseña nombre completo + clase para que David reconozca al alumno antes de
  confirmarlo — el nombre solo aparece aquí, en la alta; el resto del módulo nunca lo escribe.
  El módulo es para el puñado de alumnos con muchas necesidades, no para todo el cole.
- **Sin buscador en el formulario (2026-08-31):** el selector de alumno son las filas activas
  de `abc_students`, todas a la vista, de un toque. Se probó un buscador sobre los 700 alumnos
  de la BBDD central y David lo descartó: los genera él en el panel, así que la lista corta ES
  el selector. `active` decide quién sale; `destacado` queda como columna legada sin uso.
- **Alumno por defecto (2026-08-31):** `por_defecto` (como mucho uno; marcar a uno desmarca al
  anterior, en `setPorDefecto()`) viene ya elegido al abrir el formulario. Si no hay ninguno
  marcado y solo hay un alumno activo, se elige ese.
- **Anonimato por siglas (2026-08-31):** en `abc_students` **no se guardan nombres**: solo NIA
  y `siglas` de **dos iniciales** ("R.H." — nombre y primer apellido), sacadas de `edu_students`
  al crear la fila. Todo lo que se pinta en pantalla (formulario, panel, gráficos, detalle) son
  siglas + clase, y ya. El nombre completo solo aparece en el **cuerpo** del correo de aviso
  (el asunto lleva siglas), porque va solo a las personas configuradas para ese alumno —
  decidido así a propósito con David. Las columnas `full_name`/`display_name`/`class_name`
  quedan como legado sin escribir.
- **Quién puede registrar (2026-08-31):** cualquier persona del claustro con sesión — se probó
  a limitarlo a secundaria y David lo descartó: el ABC lo puede necesitar cualquier profe. El
  panel de gestión sigue siendo del módulo `abc` (orientación, dirección, TIC).
- **Destinatarios de los avisos (2026-08-31):** se eligen **personas**, no se teclean correos:
  sugerencias de un toque para orientación y para el tutor/a de la clase del alumno (de
  `edu_tutorias` del curso académico actual), buscador del resto del claustro, y un correo
  suelto solo como último recurso (familias, externos). Lo guardado sigue siendo la lista de
  correos de `email_recipients`; las etiquetas se resuelven al vuelo.
- **Sin exponer desde la portada pública junto a Licencias** (ver retoques en `licencias-v2.md`):
  la portada de `/` solo enlaza a Licencias + administración, no expone directamente el ABC.

## Fase 0 · Cimientos — ✅
- [x] Esquema `abc_*` en `src/db/schema.ts`
- [x] CRUD de alumnos y profesores desde el panel

## Fase 1 · Formulario de registro — ✅
- [x] Formulario completo (contexto, comportamientos, antecedentes, consecuencias, redirección,
      valoración de efectividad, personas presentes)
- [x] Auto-guardado de borrador + recuperación
- [x] UX iPad: haptics, safe-area, animaciones
- [x] Email de notificación a los destinatarios configurados del alumno

## Fase 2 · Panel de administración — ✅
- [x] Listado de alumnos y profesores
- [x] Listado de registros con detalle (`/gestion/abc/registros/[id]`) y borrado
- [x] Gráficos agregados

## Fase 3 · Migración a auth + BBDD central — ✅ (2026-07-10)
- [x] Login obligatorio en formulario y panel; permisos por módulo `abc`
- [x] Profesor resuelto por sesión (edu_teacher_id); backfill de registros antiguos por email
- [x] Alumnado destacado configurable + buscador sobre `edu_students` (config autocreada)

## Fase 4 · Vínculo por NIA, siglas y acceso de secundaria — ✅ (2026-08-31)
- [x] `abc_students.nia` + `siglas` (índices únicos por NIA y por `edu_student_id`)
- [x] Migración de los registros existentes: enlazados por NIA y nombre borrado del módulo
      (`pnpm db:migrate:abc-nia`, idempotente)
- [x] Alta de alumnos en el panel **solo por NIA** (nunca tecleando nombres)
- [x] Siglas de dos iniciales en todas las pantallas del módulo (formulario, panel, informe, detalle)
- [x] Formulario sin buscador: solo el alumnado activo del módulo, con alumno por defecto
- [x] Destinatarios de aviso por persona (orientación + tutor/a sugeridos, buscador del claustro)
- [ ] (Idea, sin decidir) sugerencias de redirección con IA — ver `docs/00-desarrollos-futuros.md`