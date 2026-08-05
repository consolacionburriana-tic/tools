# Plan 005: Tests de caracterización del motor Educamos (parse → match → plan) antes de volver a tocar la BBDD central

> **Executor instructions**: Follow this plan step by step, verify each step, honor the
> STOP conditions, and update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/lib/educamos.ts`
> On a mismatch with the excerpts below, re-lee el código antes de escribir asserts.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (solo tests; no toca producción)
- **Depends on**: plans/004-test-baseline-vitest.md (runner)
- **Category**: tests
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

`src/lib/educamos.ts` son ~877 líneas de lógica pura sin un solo test, y su salida
(`computeSyncPlan`) decide qué alumnos de `edu_students` — la BBDD central que consumen
todos los módulos — se crean, se sobreescriben o se desactivan. La entrada es un Excel
subido a mano: columnas mal, ficheros parciales y formatos raros son el caso rutinario,
no el excepcional. `CAMPOS_GORDOS` (nombre, apellidos, fecha de nacimiento) es el
guardarraíl que evita que un match erróneo machaque la identidad de un alumno real; si
deja de saltar, nadie se entera. Estos tests pinnean ese comportamiento antes de
cualquier refactor o cambio de formato de Educamos.

## Current state

- `src/lib/educamos.ts` — todo puro (sin IO; el IO vive en `educamos-server.ts`).
  Funciones objetivo y ubicaciones aproximadas en `fd75980`:
  - `parseFechaES` (~:168) — fechas `dd/mm/yyyy` de Educamos.
  - `parseClase` (~:189) — `"3º ESO A"` → curso+letra.
  - `generarCodigo` / `variantesCodigo` (~:210/:227) — códigos de alta.
  - `matchStudent` (~:553) — casa fila del Excel con alumno existente (NIA → DNI → nombre).
  - `asignarCodigoAlta` (~:599) — resolución de colisiones de código.
  - `computeSyncPlan` (~:719) — buckets `altas` / `cambios` / `sinCambios` /
    `desaparecidos`, flag `pareceParcial`, y `DiffCampo.gordo` vía `CAMPOS_GORDOS`
    (~:697: `nombre`, `apellido1`, `apellido2`, `fechaNacimiento`).
  - `dedupeGuardians` (~:846).
  - `parseEducamosFile` / `parseProfesoresFile` (~:260/:470) — SheetJS sobre Buffer;
    detección de columnas por cabecera normalizada (mayúsculas sin acentos), nunca por
    posición.
- Runner: vitest ya configurado por el plan 004 (`vitest.config.ts`, tests en
  `src/**/*.test.ts`, alias `@/*`).
- Regla de datos innegociable: fixtures INVENTADOS. Nunca recortes de
  `ExportacionDatosAlumnos.xls` reales (esos ficheros viven fuera de git en `refs/`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `pnpm test` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- `src/lib/__tests__/educamos.test.ts` (crear)
- `src/lib/__tests__/fixtures/educamos-fixtures.ts` (crear — filas inventadas en memoria; si `parseEducamosFile` exige Buffer real, generar el CSV inline con strings)

**Out of scope**:
- `src/lib/educamos.ts` y `src/lib/educamos-server.ts` — NO modificar producción. Si un
  comportamiento parece un bug, se pinnea y se reporta (ver STOP).

## Git workflow

- Branch: `test/educamos-caracterizacion`; mensaje `test(educamos): caracterización de parse/match/computeSyncPlan`.

## Steps

### Step 1: Leer el módulo entero

Lee `src/lib/educamos.ts` completo y anota las firmas exactas de las funciones de
"Current state" (los números de línea son orientativos). Identifica los tipos de fila
(`EducamosRow` o equivalente) para construir fixtures tipados.

**Verify**: puedes escribir un fixture que typechecke: `pnpm typecheck` → exit 0.

### Step 2: Tests de parseo puro

- `parseFechaES`: `"05/03/2015"` → fecha correcta; `"5/3/2015"`, `""`, `"2015-03-05"`, basura → lo que haga hoy (pinnear).
- `parseClase`: `"3º ESO A"`, `"1º PRIMARIA B"`, `"4º ESO PDC"`, string vacío.
- `generarCodigo`/`variantesCodigo`: forma del código y variantes ante colisión.

**Verify**: `pnpm test` → pasa.

### Step 3: Tests de `matchStudent`

Con un array de alumnos existentes inventados (uno con NIA, uno con DNI, uno solo con
nombre): hit por NIA; hit por DNI cuando el NIA no está; miss limpio con nombre
parecido-pero-distinto; y qué pasa con dos candidatos igual de buenos (pinnear).

**Verify**: `pnpm test` → pasa.

### Step 4: Tests de `computeSyncPlan`

Escenarios (todos con datos inventados, ~6-10 filas):

1. Fichero completo sin cambios → todo `sinCambios`, `pareceParcial` false.
2. Fila nueva → 1 alta; alumno ausente → 1 desaparecido.
3. Cambio en campo normal (email) → `cambios` sin `gordo`.
4. Cambio en `apellido1` → el diff marca `gordo: true` (el assert MÁS importante del plan).
5. Fichero de un solo curso sobre BBDD multi-curso → `pareceParcial` true.

**Verify**: `pnpm test` → pasa; el caso 4 falla si se comenta `CAMPOS_GORDOS` (prueba de fuego opcional en local, sin commitear).

### Step 5: `dedupeGuardians`

Dos tutores mismo email distinto orden → dedupe; emails vacíos → pinnear comportamiento.

**Verify**: `pnpm test` → suite completa en verde.

## Test plan

Este plan es el test plan: ≥20 asserts nuevos. Modelo estructural: las suites de
`src/lib/__tests__/familias.test.ts` del plan 004.

## Done criteria

- [ ] `pnpm test` exit 0 incluyendo `educamos.test.ts` con ≥20 casos
- [ ] Cero cambios en ficheros de producción (`git status` solo muestra tests/fixtures)
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si `matchStudent` o `computeSyncPlan` no son importables sin arrastrar IO (p. ej. importan `db`) → STOP y reporta (el refactor para aislarlo es otro plan).
- Si un test revela un comportamiento claramente peligroso (p. ej. `CAMPOS_GORDOS` no salta en un caso obvio) → pinnea el comportamiento actual, marca el test con un comentario `// BUG?` y repórtalo en el resumen; NO arregles producción aquí.

## Maintenance notes

- Estos tests son el prerequisito del refactor DEBT-03 (unificar el patrón preview→apply) y de cualquier cambio de formato del export de Educamos.
- Revisor: comprobar que ningún fixture contiene datos con pinta real (nombres reales, NIAs de 7 dígitos plausibles copiados, etc.).
