-- Envío de Evaluaciones EN SEGUNDO PLANO: cola por destinatario y progreso en vivo.
-- Ficha: docs/16-evaluaciones.md · Aditivo e idempotente, se aplica con `pnpm db:sql --pendientes`.
--
-- Se puede aplicar ANTES de desplegar el código nuevo: el código antiguo ignora las columnas
-- nuevas. Al revés (código nuevo sin esto aplicado) el panel de envíos no carga.

ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS previstos integer NOT NULL DEFAULT 0;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS cuerpo text;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS titulo text;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS reply_to text;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS aviso text;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS ultima_actividad_at timestamp;
ALTER TABLE eval_envios ADD COLUMN IF NOT EXISTS terminado_at timestamp;

CREATE TABLE IF NOT EXISTS eval_envio_destinos (
  id uuid PRIMARY KEY,
  envio_id uuid NOT NULL REFERENCES eval_envios(id) ON DELETE CASCADE,
  email text NOT NULL,
  nombre text NOT NULL DEFAULT '',
  curso text,
  enlace text NOT NULL,
  token_invitacion text,
  estado text NOT NULL DEFAULT 'pendiente', -- pendiente | haciendo | enviado | error | cancelado
  error text,
  claimed_at timestamp
);
CREATE INDEX IF NOT EXISTS eval_envio_destinos_envio_idx ON eval_envio_destinos (envio_id, estado);
