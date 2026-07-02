# Salidas y pagos · plan y checklist

Módulo de excursiones/salidas escolares. La gestión de la salida en sí (autorización, permisos)
ya se hace en Educamos; lo que aporta este módulo es el circuito de **inscripción restringida
por grupo** y, sobre todo, el **justificante de pago**. Es el **hito 4 del roadmap**: primer
módulo que nace ya sobre `edu_students` y el login por roles.

---

## Estado: plan técnico listo ✅ · implementación sin empezar ⬜

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
- Público (`/salidas/[tripId]`): la familia se identifica con el patrón de Licencias
  (curso + año nacimiento + apellidos, restringido a las clases de la salida), confirma
  inscripción o marca "no va", y sube el justificante. Email de confirmación (Resend).
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
- [ ] Blob store creado y token disponible (pasitos de arriba — David)
- [ ] Schema `sal_*` + `pnpm db:push`
- [ ] Helper `src/lib/blob.ts`

### Fase 1 · Alta de salidas (gestión)
- [ ] Crear/editar salida (nombre, descripción, fecha, importe, clases, estado)
- [ ] Listado con filtro por rol (profe/tutor → solo suyas; resto → todas)

### Fase 2 · Formulario público (familias)
- [ ] Identificación del alumno restringida a las clases de la salida
- [ ] Confirmar inscripción / marcar "no va"
- [ ] Subir justificante (Blob) con validaciones
- [ ] Email de confirmación a la familia (Resend)

### Fase 3 · Panel de seguimiento
- [ ] Detalle de salida: apuntados / pendientes / no van, con estado de justificante
- [ ] Validar/rechazar justificante (visor del archivo)
- [ ] Correos masivos a pendientes + export CSV
