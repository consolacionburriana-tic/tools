-- Sustituciones del profesorado (docs/32-sustituciones.md, §4.2). Idempotente: se puede volver
-- a lanzar sin miedo (`pnpm db:sql sustituciones`).
--
-- El 13-nov-2026 se aplicó en Neon un primer borrador (`sustituciones-internas.sql`, rama de
-- Jose Miguel) con otra forma: `sust_ausencias` de un solo día (columna `fecha`), sesiones por
-- tramo y `sust_reportes_mensuales`. Nunca llegó a usarse. Este bloque lo retira SOLO si sigue
-- teniendo esa forma y está VACÍO; con una sola fila, no toca nada y el resto falla a la vista.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sust_ausencias' AND column_name = 'fecha') THEN
    IF NOT EXISTS (SELECT 1 FROM sust_sesiones) AND NOT EXISTS (SELECT 1 FROM sust_ausencias) THEN
      DROP TABLE sust_sesiones;
      DROP TABLE sust_ausencias;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sust_reportes_mensuales') THEN
    IF NOT EXISTS (SELECT 1 FROM sust_reportes_mensuales) THEN
      DROP TABLE sust_reportes_mensuales;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sust_ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL,
  desde date NOT NULL,
  hasta date NOT NULL,
  profe_id uuid NOT NULL REFERENCES edu_teachers(id),
  profe_nombre text NOT NULL,
  motivo text NOT NULL,
  nota text,
  indicaciones text,
  estado text NOT NULL DEFAULT 'confirmada',
  creada_por_email text NOT NULL,
  anulada_por_email text,
  anulada_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sust_ausencias_fechas_idx ON sust_ausencias (desde, hasta);
CREATE INDEX IF NOT EXISTS sust_ausencias_profe_idx ON sust_ausencias (profe_id, desde);
CREATE INDEX IF NOT EXISTS sust_ausencias_year_idx ON sust_ausencias (academic_year);

CREATE TABLE IF NOT EXISTS sust_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ausencia_id uuid NOT NULL REFERENCES sust_ausencias(id),
  fecha date NOT NULL,
  hor_sesion_id uuid,
  tramo text,
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  grupos text,
  materia text,
  aula text,
  actividad text,
  hay_que_cubrir boolean NOT NULL,
  sustituto_id uuid REFERENCES edu_teachers(id),
  sustituto_nombre text,
  sustituto_email text,
  nivel text,
  disponibilidad text,
  aviso_estado text NOT NULL DEFAULT 'no',
  aviso_enviado_at timestamp,
  aviso_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sust_sesiones_ausencia_idx ON sust_sesiones (ausencia_id);
CREATE INDEX IF NOT EXISTS sust_sesiones_sustituto_idx ON sust_sesiones (sustituto_id, fecha);
CREATE INDEX IF NOT EXISTS sust_sesiones_fecha_idx ON sust_sesiones (fecha);

CREATE TABLE IF NOT EXISTS sust_disponibilidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profe_id uuid NOT NULL REFERENCES edu_teachers(id),
  academic_year text NOT NULL,
  dia_semana integer NOT NULL,
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  estado text NOT NULL,
  nota text,
  updated_by_email text,
  updated_at timestamp NOT NULL DEFAULT now()
);
-- Por franja entera (inicio Y fin): quien da en dos etapas tiene franjas que empiezan a la misma hora
-- y acaban distinto (09:00-09:45 en EP, 09:00-10:10 en EI). El primer índice (solo inicio) se retira.
DROP INDEX IF EXISTS sust_disponibilidad_uq;
CREATE UNIQUE INDEX IF NOT EXISTS sust_disponibilidad_franja_uq ON sust_disponibilidad (profe_id, academic_year, dia_semana, hora_inicio, hora_fin);

CREATE TABLE IF NOT EXISTS sust_informes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL UNIQUE,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumen jsonb,
  enviado_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Del bloque de Horarios: el cuadro «HORARIO SUSTITUCIONES» del .docx (decisión 21).
CREATE TABLE IF NOT EXISTS hor_cuadro_sustituciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES hor_periodos(id),
  dia_semana integer NOT NULL,
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  edu_teacher_id uuid REFERENCES edu_teachers(id),
  texto text NOT NULL,
  import_run_id uuid,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hor_cuadro_sustituciones_idx ON hor_cuadro_sustituciones (periodo_id, dia_semana);
