# BBDD central Educamos (alumnos + tutores) · plan y checklist

Educamos es la fuente de verdad administrativa de alumnado y de tutores legales (a quién
contactar por cada alumno). Esta pieza crea la **BBDD central en Neon** (`edu_*`) que todos los
módulos consumen, alimentada por **exports de Educamos que se resincronizan a mano** desde un
panel. Es el **hito 1 del roadmap** (ver `plataforma.md`): todo lo demás lee alumnado de aquí.

---

## Estado: plan técnico listo ✅ · implementación sin empezar ⬜

Hoy cada módulo importa su propio listado: Licencias desde `.xlsx`/Google Sheet
(`src/db/seed-licencias.ts`, `/gestion/sincronizar`) y Registro ABC con alta manual desde el
panel. El `ID Educamos` ya viaja en los datos de Licencias (`lic_students.educamos_id`).

## Decisiones cerradas

- **Sync manual por export, no API en tiempo real.** David exporta la BBDD desde Educamos
  (Excel/CSV), entra al panel y dice "sincronízame con Educamos": la app compara y actualiza
  Neon. No hay llamadas automáticas a la API de Educamos (si algún día se consigue acceso a la
  API, sustituiría solo la *entrada* del pipeline; el modelo `edu_*` no cambia).
- **Neon es la copia operativa; Educamos sigue siendo la fuente administrativa.** La app nunca
  escribe hacia Educamos (cualquier export hacia Educamos, como el de pagos de Licencias, es un
  CSV que se sube a mano).
- **El sync nunca borra:** upsert por `educamos_id`; quien desaparece del export se marca
  `active=false` (mismo patrón que el sync de alumnos de Licencias, que ya funciona así).
- **Alumnado con curso y letra** (p. ej. `2ESO` + `B`), porque los módulos restringen por
  clase (Salidas y pagos) y agrupan por clase (Banco de libros).

## Plan técnico

### Schema (`edu_*`, en `src/db/schema.ts`)

```ts
edu_students (
  id uuid pk,
  educamos_id text unique not null,   // clave de cruce con Educamos
  nombre text, apellidos text,
  fecha_nacimiento date,              // para identificación de familias (patrón Licencias)
  curso text,                         // '1PRI'..'4ESO' — mismos códigos que lic_students
  letra text,                         // 'A' | 'B' | ... | 'PDC'
  email text,                         // email del alumno si existe
  active boolean default true,
  created_at, updated_at, last_synced_at
)

edu_guardians (
  id uuid pk,
  educamos_id text,                   // si el export lo trae; si no, dedupe por email
  nombre text, apellidos text,
  email text, telefono text,
  created_at, updated_at
)

edu_student_guardians (
  student_id -> edu_students, guardian_id -> edu_guardians,
  relacion text,                      // 'madre' | 'padre' | 'tutor/a' | libre
  unique(student_id, guardian_id)
)

edu_sync_runs (                       // auditoría de cada sincronización
  id uuid pk,
  tipo text,                          // 'alumnos' | 'tutores'
  filename text,
  resumen jsonb,                      // { altas, cambios, desactivados, errores[] }
  created_at
)
```

### Pipeline de sincronización (calcado del sync de Licencias)

1. **Subida**: pantalla `/gestion/educamos` (panel interno) con dropzone para el export
   (`.xlsx`/`.csv`). Parseo en servidor con la misma librería que usa `seed-licencias.ts`.
2. **Vista previa (GET, no escribe nada)**: la app cruza por `educamos_id` y muestra el plan —
   N altas, N cambios (con diff de campos), N desactivaciones. Igual que
   `GET /api/licencias/admin/sync/students`.
3. **Aplicar (POST)**: upsert + desactivación, registro en `edu_sync_runs`, resumen en pantalla.
4. **Mapeo de columnas** del export de Educamos → campos `edu_*` definido en un único sitio
   (`src/lib/educamos.ts`), documentado con un export real de ejemplo en `src/db/data/`
   (anonimizado si se commitea).

### Capa de acceso común

- `src/lib/educamos.ts`: `getStudents({curso?, letra?, active?})`, `getStudent(id)`,
  `getGuardians(studentId)`, más los parsers del export. Los módulos importan de aquí,
  **nunca** consultan `edu_*` directamente desde sus rutas.
- **Promoción de curso**: el export de Educamos de septiembre ya trae el curso nuevo, así que la
  promoción "+1" manual de Licencias desaparece cuando Licencias se enganche aquí (hito 3).

### Adopción por los módulos (después del hito básico)

- **Licencias**: `lic_students` se mantiene como *snapshot por campaña* (los pedidos referencian
  un alumno congelado), pero se puebla desde `edu_students` con un botón "traer alumnado de la
  BBDD central" en vez del import Excel. `lic_students.educamos_id` es la clave de cruce.
- **Registro ABC**: `abc_students` puede seguir siendo un subconjunto curado a mano (solo
  alumnado NEE), pero con buscador que trae los datos desde `edu_students` al dar de alta.
- **Salidas / Banco de libros / Evaluaciones**: nacen leyendo de `edu_*` directamente.

## Inputs pendientes de David

- Un export real de Educamos (alumnado y tutores) para fijar el mapeo de columnas — sin esto la
  Fase 1 no puede cerrarse, aunque sí puede construirse con columnas supuestas y ajustar después.
- Confirmar qué formato exporta Educamos para tutores (¿mismo fichero que alumnos o separado?).

## Fases

### Fase 0 · Schema y capa de acceso
- [ ] Tablas `edu_*` en `src/db/schema.ts` + `pnpm db:push`
- [ ] `src/lib/educamos.ts` con `getStudents` / `getGuardians` y tipos
- [ ] Fixture de export de ejemplo en `src/db/data/` y parser con tests básicos

### Fase 1 · Pantalla de sincronización
- [ ] `/gestion/educamos`: subida de fichero + vista previa (altas/cambios/desactivados)
- [ ] Aplicar sync (upsert, nunca borra) + registro en `edu_sync_runs`
- [ ] Sync de tutores (mismo flujo, segundo tipo de fichero)
- [ ] Validar con un export real de Educamos (input de David)

### Fase 2 · Adopción por módulos (se ejecuta dentro del hito 3 del roadmap)
- [ ] Licencias: poblar `lic_students` de la campaña desde `edu_students` (retirar import Excel,
      dejarlo como fallback documentado)
- [ ] Registro ABC: alta de alumnos con buscador sobre `edu_students`
- [ ] Regla para módulos nuevos: consumir `src/lib/educamos.ts` desde el diseño (ya recogida en
      `plataforma.md`)
