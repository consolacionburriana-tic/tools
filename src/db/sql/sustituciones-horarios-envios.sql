-- Horarios editables de sustitución, segunda persona y avisos programados.
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_hora_inicio text;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_hora_fin text;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_2_id uuid REFERENCES edu_teachers(id);
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_2_nombre text;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_2_email text;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_2_hora_inicio text;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS sustituto_2_hora_fin text;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS confirmacion_2_token uuid;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS confirmacion_2_estado text NOT NULL DEFAULT 'pendiente';
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS confirmacion_2_at timestamp;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS aviso_programado_para timestamp;
UPDATE sust_sesiones SET sustituto_hora_inicio = hora_inicio, sustituto_hora_fin = hora_fin WHERE sustituto_id IS NOT NULL AND sustituto_hora_inicio IS NULL;
CREATE INDEX IF NOT EXISTS sust_sesiones_aviso_programado_idx ON sust_sesiones (aviso_estado, aviso_programado_para);
CREATE TABLE IF NOT EXISTS sust_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ausencia_id uuid NOT NULL REFERENCES sust_ausencias(id),
  sesiones_ids text[] NOT NULL DEFAULT '{}',
  destinatario text NOT NULL,
  tipo text NOT NULL,
  asunto text NOT NULL,
  html text NOT NULL,
  reply_to text,
  programado_para timestamp NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  error text,
  enviado_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sust_envios_pendientes_idx ON sust_envios (estado, programado_para);
