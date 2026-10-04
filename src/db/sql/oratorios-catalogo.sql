-- Oratorios y Godly Play · el abanico de SESIONES (ficha: docs/26-oratorios.md)
-- Fecha: 2026-10-04
--
-- La «sesión» es LO QUE SE HACE en el momento (no confundir con `ora_sesiones`, que son los
-- momentos planificados): cada tipo tiene un abanico de 10-15, y la regla es que ningún alumno
-- vea la misma dos veces en su vida escolar.
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`.

BEGIN;

CREATE TABLE IF NOT EXISTS "ora_catalogo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo_id" uuid NOT NULL REFERENCES "ora_tipos"("id"),
  "nombre" text NOT NULL,
  "enlace" text,
  -- Curso en que se hizo ('2024-25'). NULL = todavía no se ha hecho. Las de cursos anteriores
  -- cuentan como vistas por esos niveles aunque no estén planificadas en la app.
  "academic_year" text,
  -- Niveles a los que va ('1ESO'…); NULL = todos los del tipo («la primera vez» es solo de 1º).
  "cursos" jsonb,
  "orden" integer DEFAULT 0 NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ora_catalogo_tipo_idx" ON "ora_catalogo" ("tipo_id");

-- Qué sesión del abanico se hace en cada momento planificado (NULL = no se ha elegido).
ALTER TABLE "ora_sesiones" ADD COLUMN IF NOT EXISTS "catalogo_id" uuid REFERENCES "ora_catalogo"("id");
CREATE INDEX IF NOT EXISTS "ora_sesiones_catalogo_idx" ON "ora_sesiones" ("catalogo_id");

-- La revisión de «no se repite en la vida escolar del alumno», por tipo y activada por defecto.
ALTER TABLE "ora_tipos" ADD COLUMN IF NOT EXISTS "sin_repetir" boolean DEFAULT true NOT NULL;

COMMIT;
