# BBDD central Educamos (alumnos + tutores) · plan y checklist

Educamos es la fuente de verdad administrativa de alumnado y de tutores legales. Esta pieza crea
la **BBDD central en Neon** (`edu_*`) que todos los módulos consumen, alimentada por **exports
de Educamos que se resincronizan a mano** desde un panel: subes el excel, la app compara, te
enseña los conflictos, decides, y listo. Es el **hito 1 del roadmap** (ver `plataforma.md`).

---

## Estado: plan técnico listo ✅ (mapeo fijado con export real) · implementación sin empezar ⬜

Hoy cada módulo importa su propio listado: Licencias desde la hoja de cálculo que David
mantiene en Google Sheets (`/gestion/sincronizar`, cuenta de servicio ya configurada) y
Registro ABC con alta manual. El código interno de alumno ya viaja en Licencias.

## Decisiones cerradas

- **Sync manual por export, no API.** David exporta desde Educamos (o desde su Google Sheets),
  lo sube al panel y la app resuelve. Nada automático contra la API de Educamos.
- **Formatos soportados: `.xls`, `.xlsx` y `.csv`** (el CSV real es UTF-8 con BOM, separado por
  comas). Detección de columnas **por nombre de cabecera, nunca por posición**.
- **El código interno de alumno (`AAXXXYYY`) es la clave humana**: `AA` = año de nacimiento en
  2 cifras, `XXX` = 3 letras del primer apellido, `YYY` = 3 letras del segundo (ej. `14PONROS`,
  `12EDOSER`). Si la columna A del fichero lo trae, se usa para casar; si es el export crudo de
  Educamos sin él, también se acepta (ver cascada de matching).
- **El sync nunca borra**: upsert; quien desaparece del export se puede marcar `active=false`
  (opt-in en la vista previa).
- **Conflicto de curso**: ahora mismo Educamos tiene el curso "antiguo" y el Sheets de David el
  bueno. Habrá un selector **"Respetar curso de: [BBDD actual | Excel subido]"**, por defecto
  **BBDD actual** (en septiembre estarán equilibrados y dará igual).
- **Más datos que menos**: se guardan tipados los campos que los módulos usan o usarán (NIA el
  primero), y el resto del export se conserva en un `extra jsonb` por alumno/tutor para tenerlo
  disponible sin migrar schema.
- **Excepción deliberada: datos bancarios NO.** El bloque PAGADOR1-3 del export trae IBAN,
  nº de cuenta y firmas de ordenante. No se importan (ni tipados ni en `extra`): ningún módulo
  los necesita y son el dato más peligroso del fichero. Si algún día hay módulo de pagos, se
  revisará esta decisión a propósito.
- **`banco_libros` vive en `edu_students`** (default `true`, la mayoría son). Gestión ágil desde
  el listado de alumnado: filtro por clase + toggles con bulk. Lo consumen Banco de libros y
  (a futuro) Licencias.
- **Dónde vive**: módulo transversal `/gestion/educamos`, para perfiles `tic`/`supertic`
  (dirección/secretaría en lectura si se quiere; matriz en `01-auth-roles.md`).
- **Los exports jamás se commitean**: patrones `*educamos*.{csv,xls,xlsx}` en `.gitignore`.
  Se suben por el panel y se procesan en memoria; no se guardan en el repo ni en Blob.

## El export real (fijado con `ejemploeducamos.csv`, ~200 columnas)

Bloques del fichero y qué se hace con cada uno:

| Bloque | Columnas clave | Destino |
|---|---|---|
| Identidad alumno | `ID Alumno` (código interno si está), `ID PERSONA` (GUID Educamos), `NIA`, `DNI ALUMNO`, `MATRÍCULA ALUMNO` | `edu_students` tipado |
| Filiación | `NOMBRE/APELLIDO1/APELLIDO2 ALUMNO`, `SEXO`, `FECHA NACIMIENTO ALUMNO` (DD/MM/YYYY) | `edu_students` tipado |
| Escolarización | `CLASE` (p. ej. `2ESOB` → curso `2ESO` + letra `B`), `CÓDIGO CLASE`, `TUTOR PERSONAL`, `MODELO LINGÜÍSTICO`, `DÉFICIT` | `edu_students` tipado |
| Contacto alumno | `EMAIL ALUMNO`, `EMAILGOOGLE ALUMNO`, `MÓVIL1/2`, `TEL EMERGENCIA` | `edu_students` tipado |
| Familia | `ID FAMILIA` (GUID) | `edu_students` tipado |
| Tutor 1 y Tutor 2 | `IDPERSONA TUTORn` (GUID, clave de dedupe), nombre/apellidos, `PARENTESCO`, `RECIBE INFORMACIÓN`, `GUARDA Y CUSTODIA`, `DNI`, dirección completa, `EMAIL`, teléfonos | `edu_guardians` + `edu_student_guardians` |
| Pagadores 1-3 | nombre, DNI, dirección, **IBAN/cuenta/firmas** | **NO se importa** |
| Resto (nacimiento, nacionalidad, fam. numerosa, procedencia, O365…) | ~40 columnas | `extra jsonb` |

> El fichero puede venir también desde el Google Sheets de David con la columna A = código
> interno y quizá menos columnas: por eso el parser mapea por cabecera y tolera ausencias —
> cada campo que falte simplemente no se toca en el upsert.

## Plan técnico

### Schema (`edu_*`, en `src/db/schema.ts`)

```ts
edu_students (
  id uuid pk,
  codigo text unique,                  // 14PONROS — clave humana, la de Licencias
  educamos_persona_id text unique,     // GUID 'ID PERSONA' del export
  nia text, dni text, matricula text,
  nombre text, apellido1 text, apellido2 text,
  sexo text, fecha_nacimiento date,
  curso text, letra text,              // derivados de CLASE ('2ESOB' → '2ESO','B'; PDC = letra)
  clase_codigo text,                   // CÓDIGO CLASE
  tutor_personal text,                 // nombre del tutor/a de clase
  modelo_linguistico text, deficit text,
  email text, email_google text,
  movil1 text, movil2 text, tel_emergencia text,
  familia_id text,                     // GUID ID FAMILIA
  banco_libros boolean default true,   // gestión ágil con bulk desde el panel
  active boolean default true,
  extra jsonb,                         // resto del export (SIN bloque pagadores)
  created_at, updated_at, last_synced_at
)

edu_guardians (
  id uuid pk,
  educamos_persona_id text unique,     // GUID 'IDPERSONA TUTORn' — clave de dedupe
  nombre text, apellido1 text, apellido2 text,
  dni text, sexo text,
  email text, email_google text,
  tel_casa text, tel_personal text, movil_trabajo text,
  direccion text, cp text, localidad text, provincia text,
  extra jsonb,
  created_at, updated_at
)

edu_student_guardians (
  student_id -> edu_students, guardian_id -> edu_guardians,
  orden integer,                       // 1 = TUTOR1, 2 = TUTOR2
  parentesco text,                     // 'PADRE' | 'MADRE' | ...
  recibe_informacion boolean, guarda_custodia boolean,
  unique(student_id, guardian_id)
)

edu_sync_runs (
  id uuid pk,
  filename text, formato text,         // 'csv' | 'xls' | 'xlsx'
  resumen jsonb,                       // { altas, cambios, desactivados, conflictos_resueltos, errores[] }
  opciones jsonb,                      // { respetarCursoDe: 'bbdd'|'excel', ... }
  created_at
)
```

### Parser y matching (`src/lib/educamos.ts`)

- **Parseo** con SheetJS (`xlsx`), que lee los tres formatos con el mismo código. Cabeceras
  normalizadas (mayúsculas, sin acentos) → mapa cabecera→campo en un único objeto exportado.
- **Detección del código interno**: si los valores de la columna A casan con
  `/^\d{2}[A-ZÀ-Ü]{3}[A-ZÀ-Ü]{3}$/` se usa como `codigo`. Si no, se ignora esa vía.
- **Cascada de matching** por fila (en orden, primera que case gana):
  1. `codigo` (columna A si es código interno)
  2. `educamos_persona_id` (GUID `ID PERSONA`)
  3. `nia`
  4. `dni`
  5. `apellido1 + apellido2 + fecha_nacimiento` (último recurso, exige match exacto)
  6. Sin match → **alta nueva**. Si no traía código interno, se **genera**
     (`AA` + 3 letras apellido1 + 3 letras apellido2, mayúsculas sin acentos; si colisiona,
     se marca para revisión manual en la vista previa, no se inventa sufijo en silencio).
- **Tutores**: dedupe por su GUID; sin GUID (export recortado), dedupe por `dni` y si no por
  `email`. La relación (parentesco, recibe info, custodia) se upsertea en la tabla puente.

### Flujo de sincronización (pantalla `/gestion/educamos/sincronizar`)

1. **Subir fichero** (dropzone, `.csv/.xls/.xlsx`). Se procesa en memoria; no se persiste el
   fichero en ningún sitio.
2. **Opciones**: selector "Respetar curso de: **BBDD actual** (defecto) | Excel subido".
3. **Vista previa** (no escribe nada), en cuatro cubos:
   - **Altas** (N) — lista con el código generado/detectado.
   - **Cambios** (N) — diff campo a campo por alumno. Los campos de contacto/datos ganan por
     defecto del excel (Educamos va más fresco); el curso obedece al selector; los conflictos
     "gordos" (nombre, apellidos o fecha de nacimiento distintos = probable mismatch) se marcan
     en rojo y piden elección explícita alumno a alumno (radio BBDD/Excel).
   - **Desaparecidos** (N) — están en Neon activos pero no en el fichero → checkbox "desactivar"
     (desmarcado por defecto si el fichero parece parcial, p. ej. trae solo un curso).
   - **Sin cambios** (N) — colapsado.
4. **Aplicar**: upsert transaccional + fila en `edu_sync_runs` con el resumen y las opciones.
5. Pantalla de resultado con el resumen (y siempre disponible en el historial de syncs).

> Un fichero parcial (una clase, un curso) es un caso normal, no un error: solo se compara
> contra lo que trae, y "desaparecidos" se limita a los alumnos activos del mismo ámbito
> (mismos cursos presentes en el fichero).

### Pantallas del módulo (`/gestion/educamos`)

- **Alumnado**: tabla con búsqueda y filtros (curso, letra, banco libros sí/no, activos),
  columna `banco_libros` con toggle rápido + **bulk por selección/clase** ("marcar todos
  1ESO A como banco: sí"). Ficha de alumno con sus tutores y su `extra`.
- **Sincronizar**: el wizard de arriba.
- **Historial**: lista de `edu_sync_runs` con sus resúmenes.

### Capa de acceso común

`src/lib/educamos.ts` exporta también `getStudents({curso?, letra?, bancoLibros?, active?})`,
`getStudent(idOrCodigo)`, `getGuardians(studentId)`. Los módulos consumen de aquí, nunca
consultan `edu_*` a pelo desde sus rutas.

### Adopción por los módulos (hito 3)

- **Licencias**: `lic_students` sigue siendo snapshot por campaña, pero se puebla con un botón
  "traer de la BBDD central" cruzando por `codigo` (retirar import Excel, dejarlo de fallback).
- **Registro ABC**: alta de alumnos con buscador sobre `edu_students`.
- **Salidas / Banco de libros / Evaluaciones**: nacen leyendo de `edu_*`.

## Fases

### Fase 0 · Schema y parser
- [ ] Tablas `edu_*` en `src/db/schema.ts` + `pnpm db:push`
- [ ] Parser SheetJS con mapa de cabeceras + normalización, probado contra **fixtures con
      datos inventados** que imiten la estructura real documentada arriba (el export real está
      borrado y prohibido en git; los fixtures NO deben llamarse `*educamos*` o el `.gitignore`
      los bloqueará — usar p. ej. `src/db/data/fixture-sync-alumnado.csv`): uno "completo"
      (~200 columnas) y uno recortado con columna A = código interno
- [ ] Prueba final con un export real que David sube por el wizard (nunca al repo)
- [ ] Cascada de matching + generación de código interno con detección de colisiones
- [ ] `getStudents` / `getGuardians` tipados

### Fase 1 · Wizard de sincronización
- [ ] Subida de fichero + parseo en memoria (`.csv/.xls/.xlsx`)
- [ ] Vista previa con los 4 cubos + selector "respetar curso de" + resolución de conflictos gordos
- [ ] Aplicar: upsert transaccional (alumnos + tutores + relaciones) + `edu_sync_runs`
- [ ] Manejo de fichero parcial (desaparecidos acotados a los cursos presentes)

### Fase 2 · Pantallas de gestión
- [ ] Listado de alumnado con filtros + toggle/bulk de `banco_libros`
- [ ] Ficha de alumno (datos + tutores + extra)
- [ ] Historial de syncs
- [ ] Protegido con `requireModule('educamos')` cuando auth esté (mientras, tras el login
      simple de `/gestion`)

### Fase 3 · Adopción (= hito 3 del roadmap, checklist en cada ficha)
- [ ] Licencias pobla su campaña desde `edu_students`
- [ ] Registro ABC busca sobre `edu_students`
