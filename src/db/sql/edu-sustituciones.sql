-- Sustituciones del profesorado: «Ángela Guillamón sustituye a Alejandro Sánchez».
-- Ficha: docs/02-integracion-educamos.md (sección «Sustituciones»).
-- Aditivo e idempotente, se aplica con `pnpm db:sql edu-sustituciones`.
--
-- Mientras una sustitución está vigente (activa y dentro de sus fechas), el sustituto hereda
-- las tutorías del titular. Nace de dos sitios: el export de profes de Educamos (columnas
-- PROF. SUSTITUTO y PROF. TITULAR; origen 'educamos') o a mano en /gestion/profes (origen
-- 'manual'). El sync solo toca las de origen 'educamos' y nunca reactiva una apagada a mano.

CREATE TABLE IF NOT EXISTS edu_sustituciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sustituto_id uuid NOT NULL REFERENCES edu_teachers(id),
  titular_id uuid NOT NULL REFERENCES edu_teachers(id),
  desde date,
  hasta date,
  activa boolean NOT NULL DEFAULT true,
  origen text NOT NULL DEFAULT 'manual',
  nota text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_sustituciones_par_uq ON edu_sustituciones (sustituto_id, titular_id);
CREATE INDEX IF NOT EXISTS edu_sustituciones_titular_idx ON edu_sustituciones (titular_id);
