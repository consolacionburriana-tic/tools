-- Sustituciones · Salidas (docs/32, decisión 25, 23-nov-2026): un grupo se va un día (entero o unas
-- horas). Sus profes quedan libres esas horas y los acompañantes faltan (ausencias en borrador,
-- colgadas de la salida con `sust_ausencias.salida_id`). Idempotente.
CREATE TABLE IF NOT EXISTS sust_salidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL,
  fecha date NOT NULL,
  hora_inicio text,
  hora_fin text,
  grupos jsonb NOT NULL DEFAULT '[]'::jsonb,
  acompanantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  descripcion text NOT NULL,
  estado text NOT NULL DEFAULT 'activa',
  creada_por_email text NOT NULL,
  anulada_por_email text,
  anulada_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sust_salidas_fecha_idx ON sust_salidas (fecha);
ALTER TABLE sust_ausencias ADD COLUMN IF NOT EXISTS salida_id uuid REFERENCES sust_salidas(id);
CREATE INDEX IF NOT EXISTS sust_ausencias_salida_idx ON sust_ausencias (salida_id);
