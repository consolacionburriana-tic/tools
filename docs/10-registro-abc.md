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
- **Panel admin** (`/admin`): gestión de alumnos y profesores, listado de registros con filtros,
  gráficos agregados.

Pendiente, no por código sino por **decisión/infraestructura**:
- Login — hoy el panel `/admin` no tiene autenticación (ver aviso en el README histórico). Se
  resolverá con el módulo transversal de auth/roles (`docs/01-auth-roles.md`), no de forma
  independiente para este módulo. Es parte del **hito 3 del roadmap** (ver `plataforma.md`).
- Origen del alumnado — hoy `abc_students` se gestiona a mano desde el panel; pasará a nutrirse
  de la BBDD central con un buscador sobre `edu_students` (ver `docs/02-integracion-educamos.md`).

## Decisiones cerradas

- **Prefijo de tablas:** `abc_*` (`abc_students`, `abc_behavior_reports`) en `src/db/schema.ts`.
- **Notificación:** cada alumno tiene hasta 20 emails de aviso (`email_recipients`) que reciben
  notificación cuando se guarda un registro suyo.
- **Dónde vive:** formulario público en `src/app/(public)/registro-abc`, panel en `src/app/admin`.
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
- [x] Listado de registros con detalle (`/admin/registros/[id]`) y borrado
- [x] Gráficos agregados

## Fase 3 · Pendiente (= hito 3 del roadmap, tras auth y BBDD central)
- [ ] Login/permisos del panel (requiere `docs/01-auth-roles.md` implementado)
- [ ] Alta de alumnos con buscador sobre `edu_students` (requiere `docs/02-integracion-educamos.md`)
- [ ] (Idea, sin decidir) sugerencias de redirección con IA — ver `docs/00-desarrollos-futuros.md`