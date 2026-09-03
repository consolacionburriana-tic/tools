-- Tutor personal del alumnado y confirmación del reparto por clase (2026-09-03)
--
-- Las dos tablas que sostienen el reparto de alumnos entre los dos (o tres) tutores de una
-- clase, en `/gestion/profes`. Equivale a lo que haría `pnpm db:push` con el schema de
-- `src/db/schema.ts`; se aplicó así porque la sesión no tenía `DATABASE_URL`.
--
-- Es aditivo: no toca ninguna tabla existente. Ya está APLICADO en Neon.
--
--   psql "$DATABASE_URL" -f src/db/sql/tutor-personal.sql

-- Un alumno tiene como mucho un tutor personal por curso académico. Sin fila = sin asignar,
-- que es como se queda siempre el alumnado que llega a mitad de curso (nunca se autoasigna).
-- `id` sin default a propósito: lo genera Drizzle en el código, como el resto del schema.
CREATE TABLE IF NOT EXISTS edu_tutor_personal (
  id uuid PRIMARY KEY,
  edu_student_id uuid NOT NULL REFERENCES edu_students(id) ON DELETE CASCADE,
  edu_teacher_id uuid NOT NULL REFERENCES edu_teachers(id),
  academic_year text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_tutor_personal_uq
  ON edu_tutor_personal (edu_student_id, academic_year);

-- "El reparto de esta clase ya está revisado para este curso". Sin fila = la pantalla avisa.
-- `letra` va NOT NULL con '' (y no nullable como en edu_tutorias) porque un índice único con
-- NULL no deduplica, y aquí se hace upsert sobre él: sin esto, cada confirmación de una clase
-- sin letra (infantil) crearía una fila nueva.
CREATE TABLE IF NOT EXISTS edu_reparto_confirmado (
  id uuid PRIMARY KEY,
  curso text NOT NULL,
  letra text DEFAULT '' NOT NULL,
  academic_year text NOT NULL,
  confirmado_at timestamp DEFAULT now() NOT NULL,
  confirmado_por text
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_reparto_confirmado_uq
  ON edu_reparto_confirmado (curso, letra, academic_year);
