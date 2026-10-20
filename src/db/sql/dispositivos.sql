-- Dispositivos 1:1 · tablas nuevas (ficha: docs/29-dispositivos.md)
-- Fecha: 2026-10-20 · equivalente a `pnpm db:push` para las tablas dis_*.
--
-- Puramente ADITIVO: crea tablas nuevas y no toca ninguna existente. Idempotente.
-- Los `id` no llevan DEFAULT: los pone la app (`crypto.randomUUID()` en el schema).

BEGIN;

CREATE TABLE IF NOT EXISTS "dis_modelos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tipo" text DEFAULT 'ipad' NOT NULL,
  "nombre" text NOT NULL,
  "capacidad_gb" integer,
  "notas" text,
  "activo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dis_aparatos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "uso" text NOT NULL,
  "codigo" text NOT NULL,
  "tipo" text DEFAULT 'ipad' NOT NULL,
  "modelo_id" uuid REFERENCES "dis_modelos"("id"),
  "numero_serie" text,
  "estado" text DEFAULT 'activo' NOT NULL,
  "edu_student_id" uuid REFERENCES "edu_students"("id"),
  "edu_teacher_id" uuid REFERENCES "edu_teachers"("id"),
  "asignado_at" timestamp,
  "notas" text,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "dis_aparatos_codigo_uq" ON "dis_aparatos" ("codigo");
CREATE INDEX IF NOT EXISTS "dis_aparatos_alumno_idx" ON "dis_aparatos" ("edu_student_id");
CREATE INDEX IF NOT EXISTS "dis_aparatos_profe_idx" ON "dis_aparatos" ("edu_teacher_id");

CREATE TABLE IF NOT EXISTS "dis_alumnos" (
  "edu_student_id" uuid PRIMARY KEY NOT NULL REFERENCES "edu_students"("id"),
  "modalidad" text NOT NULL,
  "tipo" text DEFAULT 'ipad' NOT NULL,
  "curso_compra" text,
  "a_casa" boolean,
  "firmado_at" date,
  "hermano_id" uuid REFERENCES "edu_students"("id"),
  "modelo_id" uuid REFERENCES "dis_modelos"("id"),
  "numero_serie" text,
  "notas" text,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dis_historial" (
  "id" uuid PRIMARY KEY NOT NULL,
  "edu_student_id" uuid,
  "edu_teacher_id" uuid,
  "aparato_id" uuid,
  "texto" text NOT NULL,
  "por" text,
  "por_nombre" text,
  "at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "dis_historial_alumno_idx" ON "dis_historial" ("edu_student_id");
CREATE INDEX IF NOT EXISTS "dis_historial_aparato_idx" ON "dis_historial" ("aparato_id");

-- El modelo que dijo David de ejemplo («9 generación 64 GB»). El resto, desde «Modelos».
INSERT INTO "dis_modelos" ("id", "tipo", "nombre", "capacidad_gb")
SELECT '6f1c2a3e-9d1b-4c5e-8a7f-0b2d3e4f5a61', 'ipad', 'iPad (9.ª generación)', 64
WHERE NOT EXISTS (SELECT 1 FROM "dis_modelos");

COMMIT;
