-- Envíos de Evaluaciones (inmediatos y PROGRAMADOS) y apertura automática.
-- Ficha: docs/16-evaluaciones.md · Aditivo e idempotente, se aplica con SQL.
--
-- Programar NO usa ningún cron: el correo se entrega a Resend con `scheduled_at` y es Resend
-- quien lo dispara a su hora (hasta 30 días vista). Aquí se guarda el envío con los ids que
-- devuelve Resend, que es lo que permite verlo en el panel y cancelarlo.
--
-- `eval_forms.abrir_en`: si el formulario sigue en borrador cuando llega esa hora, se abre
-- solo la primera vez que alguien lo carga (perezoso, tampoco hay cron).

CREATE TABLE IF NOT EXISTS eval_envios (
  id uuid PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES eval_forms(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'programado', -- programado | enviado | cancelado
  programado_para timestamp,                 -- NULL = envío inmediato
  asunto text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  errores integer NOT NULL DEFAULT 0,
  resend_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  solo_pendientes boolean NOT NULL DEFAULT false,
  created_by_email text,
  created_at timestamp NOT NULL DEFAULT now(),
  cancelado_at timestamp
);
CREATE INDEX IF NOT EXISTS eval_envios_form_idx ON eval_envios (form_id);

ALTER TABLE eval_forms ADD COLUMN IF NOT EXISTS abrir_en timestamp;
