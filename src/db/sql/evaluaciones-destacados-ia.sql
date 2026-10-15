-- Evaluaciones: comentarios destacados y análisis con IA (Claude), y ajustes del colegio.
-- Fichas: docs/16-evaluaciones.md y docs/09-parametros-del-centro.md · Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS eval_destacados (
  answer_id uuid PRIMARY KEY REFERENCES eval_answers(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES eval_forms(id) ON DELETE CASCADE,
  created_by_email text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eval_destacados_form_idx ON eval_destacados (form_id);

CREATE TABLE IF NOT EXISTS eval_insights (
  id uuid PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES eval_forms(id) ON DELETE CASCADE,
  filtro text NOT NULL DEFAULT '',
  modelo text NOT NULL,
  contenido jsonb NOT NULL,
  respuestas integer NOT NULL,
  tokens_entrada integer,
  tokens_salida integer,
  created_by_email text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eval_insights_form_idx ON eval_insights (form_id);

CREATE TABLE IF NOT EXISTS cfg_ajustes (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL,
  updated_by_email text,
  updated_at timestamp NOT NULL DEFAULT now()
);
