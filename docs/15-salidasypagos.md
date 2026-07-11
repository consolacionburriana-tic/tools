# Salidas y pagos · plan y checklist

Módulo de excursiones/salidas escolares. La gestión de la salida en sí (autorización, permisos)
ya se hace en Educamos; lo que aporta este módulo es el circuito de **inscripción restringida
por grupo** y, sobre todo, el **justificante de pago**. Es el **hito 4 del roadmap**: primer
módulo que nace ya sobre `edu_students` y el login por roles.

---

## Estado: implementado ✅ (2026-07-11) — pendiente activar Blob (David) y correos masivos a pendientes

Depende de: BBDD central (`02-integracion-educamos.md`) y auth/roles (`01-auth-roles.md`).

## Decisiones cerradas

- **Cualquier profesor puede crear una salida.** `profe`/`tutor` solo ven **sus** salidas; el
  resto de roles con acceso al módulo (dirección, jefe, secretaría, tic…) ven las de todos.
- **La salida se restringe por clase** usando `curso` + `letra` de `edu_students` (se pueden
  marcar varias clases: p. ej. todo 2ºESO = 2ESO A + 2ESO B + PDC).
- **El justificante se sube como archivo** (foto/PDF) y un gestor puede marcarlo como
  **revisado/validado**.
- **Un alumno puede "no ir" a la salida**: se marca y deja de contar como pendiente (no se le
  reclama justificante, obvio).
- **Sin recordatorios automáticos**, pero sí **envío manual de correos masivos** a las familias
  que faltan ("oye, me falta tu justificante") — mismo patrón que `/gestion/correos` de
  Licencias.
- Idea aparcada (no bloquea, ver `00-desarrollos-futuros.md`): plataforma de **pago online**
  en vez de justificante subido.
- **Responsables por salida** (2026-07-11): a cada salida se le marcan profes responsables
  (`sal_trip_managers`) que reciben por Resend un aviso minimalista con cada justificante:
  mini-report (progreso, entregados/pendientes/validados/no van) y un footer con un dato
  curioso rotatorio para alegrar la gestión.
- **Modelo preparado para la API de Educamos**: `sal_trips.educamos_actividad_id` + `extra`
  jsonb y `sal_signups.educamos_autorizado`/`educamos_synced_at`, por si en el futuro la
  salida y sus autorizaciones se consultan directamente de Educamos.

## Plan técnico

### Schema (`sal_*`)

```ts
sal_trips (
  id uuid pk,
  nombre text, descripcion text,
  fecha date,
  importe numeric,
  clases jsonb,                       // [{curso:'2ESO', letra:'A'}, ...] — a qué clases va dirigida
  estado text default 'abierta',      // 'abierta' | 'cerrada'
  created_by uuid -> auth_users,      // para el filtro "solo veo mis salidas"
  created_at, updated_at
)

sal_signups (
  id uuid pk,
  trip_id -> sal_trips,
  student_id -> edu_students,
  estado text not null,               // 'apuntado' | 'no_va'   (sin fila = pendiente)
  justificante_url text,              // Vercel Blob
  justificante_estado text,           // null | 'subido' | 'validado' | 'rechazado'
  email_contacto text,                // email de la familia que confirmó
  created_at, updated_at,
  unique(trip_id, student_id)
)
```

"Quién falta" = alumnado de las clases de la salida (desde `edu_students`) sin fila en
`sal_signups`, más los `'apuntado'` sin justificante validado. Los `'no_va'` se excluyen.

### Subida de archivos: Vercel Blob (primera vez en el repo)

- Helper compartido `src/lib/blob.ts` (put/delete + URL firmada); acceso **privado**, se sirve
  vía ruta API que comprueba permisos. Env var `BLOB_READ_WRITE_TOKEN` (Vercel → Storage → Blob).
- Límite razonable (p. ej. 10 MB, jpg/png/pdf/heic) validado en servidor.

### Rutas

- Gestión (`/gestion/salidas`): listado (filtrado por rol), crear/editar salida, detalle con
  tres listas (apuntados / pendientes / no van) + validar justificantes + correos masivos a
  pendientes + export CSV.
- Público (`/salidas`, sin tripId en la URL): la familia se identifica con la lib común
  (DNI del tutor / NIA / token futuro), ve las salidas abiertas de su hijo/a con el estado
  del justificante (si solo hay una se selecciona sola), sube el justificante o marca
  "no va". Email de confirmación (Resend) si deja su correo.
- API: `api/salidas/{identify,signup,upload}` (público con token de salida) ·
  `api/salidas/admin/*` (protegido con `requireModule('salidas')`).

### Reutilización

- Identificación de familia: extraer a helper común lo ya hecho en `api/licencias/identify`.
- Correos masivos: mismo patrón que `/gestion/correos` (Resend batch, variables `{nombre}…`).
- Listado "quién falta" + CSV: patrón de `/gestion/faltan` y `licencias-exports.ts`.

## Fases

### Pasitos para David · activar Vercel Blob (una vez, ~3 min)

1. En [vercel.com](https://vercel.com), abre el proyecto `tools` → pestaña **Storage**.
2. **Create Database → Blob**, nombre p. ej. `tools-blob`, y conéctalo al proyecto.
3. Al conectarlo, Vercel añade solo la env var `BLOB_READ_WRITE_TOKEN` al proyecto. Para
   desarrollo local: cópiala a tu `.env.local` (o `vercel env pull` si tienes la CLI).

### Fase 0 · Cimientos
- [ ] Blob store creado y token disponible (pasitos de arriba — David); el código ya está y da error guiado si falta
- [x] Schema `sal_*` + `pnpm db:push` (con campos previstos para la API de Educamos)
- [x] Helper `src/lib/blob.ts` (privado, 10MB, jpg/png/heic/pdf)

### Fase 1 · Alta de salidas (gestión)
- [x] Crear/editar salida (nombre, descripción, fecha, importe, clases reales de edu_students, responsables, abrir/cerrar)
- [x] Listado con filtro por rol (profe/tutor → solo suyas o de las que son responsables; resto → todas) + barra de progreso

### Fase 2 · Formulario público (familias)
- [x] Identificación por DNI/NIA (lib común de familias); las salidas ya vienen filtradas por la clase del alumno
- [x] Marcar "no va" (la inscripción se da por hecha al subir el justificante)
- [x] Subir justificante (Blob privado) con validaciones de tipo y tamaño
- [x] Email de confirmación a la familia (Resend, opcional) + alerta con report a los responsables

### Fase 3 · Panel de seguimiento
- [x] Detalle de salida: pendientes / entregados / validados / no van, con estado de justificante
- [x] Validar/rechazar justificante (visor del archivo servido por API con permisos)
- [ ] Correos masivos a pendientes + export CSV (patrón /gestion/correos — pendiente)
