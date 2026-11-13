-- Módulo diario de sustituciones; independiente de edu_sustituciones.
CREATE TABLE IF NOT EXISTS sust_ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  academic_year text NOT NULL,
  motivo text NOT NULL,
  ausente_id uuid NOT NULL REFERENCES edu_teachers(id),
  ausente_nombre text NOT NULL,
  creada_por text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sust_ausencias_fecha_idx ON sust_ausencias(fecha);
CREATE INDEX IF NOT EXISTS sust_ausencias_ausente_idx ON sust_ausencias(ausente_id);
CREATE TABLE IF NOT EXISTS sust_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ausencia_id uuid NOT NULL REFERENCES sust_ausencias(id),
  hor_sesion_id uuid,
  tramo_orden integer NOT NULL,
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  materia text NOT NULL,
  aula text,
  grupo text,
  ausente_id uuid NOT NULL REFERENCES edu_teachers(id),
  ausente_nombre text NOT NULL,
  sustituto_id uuid REFERENCES edu_teachers(id),
  sustituto_nombre text,
  sustituto_email text,
  prioridad text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sust_sesiones_ausencia_idx ON sust_sesiones(ausencia_id);
CREATE INDEX IF NOT EXISTS sust_sesiones_ausente_idx ON sust_sesiones(ausente_id);
CREATE TABLE IF NOT EXISTS sust_reportes_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'pendiente',
  enviados_a jsonb NOT NULL DEFAULT '[]'::jsonb,
  enviado_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
