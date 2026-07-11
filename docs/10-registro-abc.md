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
- **Alumnado (2026-07-10):** `abc_students` es la tabla de config del módulo, enlazada a
  `edu_students` (`edu_student_id`) y con flag `destacado` (salen arriba en el formulario);
  cualquier alumno del cole se encuentra con el buscador y su config se autocrea al registrar.
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
- [ ] (Idea, sin decidir) sugerencias de redirección con IA — ver `docs/00-desarrollos-futuros.md`