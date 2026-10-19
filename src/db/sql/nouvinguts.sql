-- Nouvinguts · tablas nuevas (ficha: docs/28-nouvinguts.md)
-- Fecha: 2026-10-19 · equivalente a `pnpm db:push` para las tablas nou_*.
--
-- Puramente ADITIVO: crea tablas nuevas y no toca ninguna existente. Idempotente.
-- Los `id` no llevan DEFAULT: los pone la app (`crypto.randomUUID()` en el schema).

BEGIN;

CREATE TABLE IF NOT EXISTS "nou_alumnos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "edu_student_id" uuid REFERENCES "edu_students"("id"),
  "nombre" text,
  "apellidos" text,
  "curso" text,
  "fecha_matricula" date NOT NULL,
  "origen" text NOT NULL,
  "estado" text DEFAULT 'abierto' NOT NULL,
  "aviso_vinculo" text,
  "cerrado_at" timestamp,
  "cerrado_por" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "nou_alumnos_edu_uq" ON "nou_alumnos" ("edu_student_id");
CREATE INDEX IF NOT EXISTS "nou_alumnos_estado_idx" ON "nou_alumnos" ("estado");

CREATE TABLE IF NOT EXISTS "nou_marcas" (
  "nouvingut_id" uuid NOT NULL REFERENCES "nou_alumnos"("id") ON DELETE CASCADE,
  "paso" text NOT NULL,
  "valor" text DEFAULT 'hecho' NOT NULL,
  "por" text,
  "por_nombre" text,
  "at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "nou_marcas_uq" ON "nou_marcas" ("nouvingut_id", "paso");

CREATE TABLE IF NOT EXISTS "nou_notas" (
  "id" uuid PRIMARY KEY NOT NULL,
  "nouvingut_id" uuid NOT NULL REFERENCES "nou_alumnos"("id") ON DELETE CASCADE,
  "paso" text,
  "texto" text NOT NULL,
  "autor_email" text,
  "autor_nombre" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "nou_notas_nouvingut_idx" ON "nou_notas" ("nouvingut_id");

CREATE TABLE IF NOT EXISTS "nou_pasos" (
  "clave" text PRIMARY KEY NOT NULL,
  "orden" integer NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "responsable" text NOT NULL,
  "desde_curso" text,
  "updated_by" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

COMMIT;
