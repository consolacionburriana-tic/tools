-- Schema del PR #10 (AMPA, libros manuales del banco, historial de syncs).
-- Todo ADITIVO: se puede aplicar con el código viejo o el nuevo en producción, en
-- cualquier orden. Equivale a lo que haría `pnpm db:push`; está en SQL para poder
-- pegarlo en la consola de Neon sin tener el repo delante.
--
-- IMPORTANTE (aprendido a base de romper producción el 2026-09-02): esto va SIEMPRE
-- ANTES de desplegar el código que lo usa. Drizzle expande `select()` a la lista
-- explícita de columnas del schema, así que en cuanto el código nuevo pide `ampa` y la
-- columna no existe, Postgres falla y se cae CUALQUIER pantalla que lea edu_students
-- (identificación de familias incluida, o sea los formularios públicos).

-- 1) Pertenencia al AMPA, al lado del flag del banco de libros.
ALTER TABLE edu_students ADD COLUMN IF NOT EXISTS ampa boolean NOT NULL DEFAULT false;

-- 2) Historial de sincronizaciones: qué se sincronizó y quién lo lanzó.
ALTER TABLE edu_sync_runs ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'alumnado';
ALTER TABLE edu_sync_runs ADD COLUMN IF NOT EXISTS quien_email text;
CREATE INDEX IF NOT EXISTS edu_sync_runs_created_idx ON edu_sync_runs (created_at);

-- 3) Libros del banco configurados a mano por curso.
CREATE TABLE IF NOT EXISTS bl_libros_curso (
  id uuid PRIMARY KEY,
  curso text NOT NULL,
  asignatura text,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS bl_libros_curso_curso_idx ON bl_libros_curso (curso);
