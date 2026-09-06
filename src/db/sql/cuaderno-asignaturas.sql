-- Asignaturas por curso del cuaderno de tutor. Ficha: docs/18-cuaderno-tutor.md
-- Aditivo e idempotente. Se aplica con SQL, no con `pnpm db:push` (ver 04-convenciones).

CREATE TABLE IF NOT EXISTS cuad_asignaturas (
  id uuid PRIMARY KEY,
  academic_year text NOT NULL,
  curso text NOT NULL,
  nombre text NOT NULL,
  nombre_corto text,
  orden integer NOT NULL DEFAULT 1,
  hor_materia_id uuid,
  origen text NOT NULL DEFAULT 'manual',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cuad_asignaturas_hor_materia_id_hor_materias_id_fk
    FOREIGN KEY (hor_materia_id) REFERENCES hor_materias (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS cuad_asignaturas_curso_idx ON cuad_asignaturas (academic_year, curso, orden);
