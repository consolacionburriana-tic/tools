-- Evaluaciones → Classroom: historial de lo publicado y tutorías fijadas a mano.
-- Ficha: docs/16-evaluaciones.md · Aditivo e idempotente, se aplica con `pnpm db:sql`.
--
-- eval_classroom_posts: una fila por clase donde se ha publicado la evaluación (tarea o anuncio),
-- con los ids de Classroom. Es lo que evita publicar dos veces y permite retirarlo desde la app.
-- eval_classroom_destinos: la tutoría de Classroom de una clase del cole cuando se ha indicado
-- a mano (la deducción por el nombre no la encontró). `letra` va vacía, no NULL, por la clave única.

CREATE TABLE IF NOT EXISTS eval_classroom_posts (
  id uuid PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES eval_forms(id) ON DELETE CASCADE,
  etiqueta text NOT NULL,
  course_id text NOT NULL,
  course_nombre text,
  tipo text NOT NULL,                 -- tarea | anuncio
  post_id text,
  enlace text,
  titulo text NOT NULL,
  programado_para timestamp,          -- NULL = publicada al momento
  created_by_email text,
  created_at timestamp NOT NULL DEFAULT now(),
  retirado_at timestamp,
  retirado_por text
);
CREATE INDEX IF NOT EXISTS eval_classroom_posts_form_idx ON eval_classroom_posts (form_id);

CREATE TABLE IF NOT EXISTS eval_classroom_destinos (
  id uuid PRIMARY KEY,
  academic_year text NOT NULL,
  curso text NOT NULL,
  letra text NOT NULL DEFAULT '',
  course_id text NOT NULL,
  course_nombre text,
  updated_by_email text,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS eval_classroom_destinos_clase_uq ON eval_classroom_destinos (academic_year, curso, letra);
