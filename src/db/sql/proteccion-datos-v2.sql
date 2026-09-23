-- Protección de datos v2 + venta de materiales (ficha: docs/21-alumnado.md, fase 3)
-- Fecha: 2026-09-23
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`. Lo que QUITA (la columna `pd_firmada`) va aparte, en
-- `proteccion-datos-quita-firmada.sql`, para poder aplicarlo solo cuando el código que ya no
-- la lee esté desplegado.

BEGIN;

-- ── 1. Desestimación del correo del alumno ──────────────────────────────────
-- false = la familia NO desestima (lo normal, en verde) · true = desestima (en rojo).
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_desestima_correo" boolean DEFAULT false NOT NULL;

-- ── 2. Venta de materiales ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mat_materiales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "academic_year" text NOT NULL,
  "nombre" text NOT NULL,
  "importe" numeric(8, 2),
  "notas" text,
  "destinos" jsonb NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mat_estados" (
  "material_id" uuid NOT NULL REFERENCES "mat_materiales"("id") ON DELETE CASCADE,
  "edu_student_id" uuid NOT NULL REFERENCES "edu_students"("id"),
  "estado" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "mat_estados_material_alumno_idx" ON "mat_estados" ("material_id", "edu_student_id");

COMMIT;
