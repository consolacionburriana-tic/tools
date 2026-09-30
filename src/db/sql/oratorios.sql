-- Oratorios y Godly Play (ficha: docs/25-oratorios.md)
-- Fecha: 2026-09-30
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`. Siembra los dos tipos que pidió David con sus calendarios.

BEGIN;

CREATE TABLE IF NOT EXISTS "ora_tipos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" text NOT NULL UNIQUE,
  "nombre" text NOT NULL,
  "nombre_correo" text NOT NULL,
  "emoji" text DEFAULT '🙏' NOT NULL,
  "calendario_id" text,
  "frecuencia" text DEFAULT 'mes' NOT NULL,
  "cantidad" integer DEFAULT 1 NOT NULL,
  "etapas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "clases" jsonb,
  "texto_correo" text,
  "aviso_dias" integer DEFAULT 7 NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ora_ajustes" (
  "academic_year" text PRIMARY KEY,
  "trimestres" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "acceso_comun" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" text
);

CREATE TABLE IF NOT EXISTS "ora_disponibilidad" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "responsable_email" text NOT NULL,
  "dia_semana" integer NOT NULL,
  "hora_inicio" text NOT NULL,
  "hora_fin" text NOT NULL,
  "nivel" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ora_disponibilidad_uq" ON "ora_disponibilidad" ("responsable_email", "dia_semana", "hora_inicio");

CREATE TABLE IF NOT EXISTS "ora_sesiones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo_id" uuid NOT NULL REFERENCES "ora_tipos"("id"),
  "academic_year" text NOT NULL,
  "curso" text NOT NULL,
  "letra" text,
  "numero" integer NOT NULL,
  "fecha" date NOT NULL,
  "hora_inicio" text NOT NULL,
  "hora_fin" text NOT NULL,
  "responsable_email" text NOT NULL,
  "responsable_nombre" text,
  "profe_id" uuid REFERENCES "edu_teachers"("id"),
  "profe_nombre" text,
  "materia" text,
  "profes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "estado" text DEFAULT 'borrador' NOT NULL,
  "aviso_estado" text DEFAULT 'no' NOT NULL,
  "aviso_tipo" text DEFAULT 'aviso' NOT NULL,
  "aviso_programado_para" date,
  "aviso_enviado_at" timestamp,
  "aviso_manual" boolean DEFAULT false NOT NULL,
  "aviso_error" text,
  "google_event_id" text,
  "google_calendar_id" text,
  "calendario_error" text,
  "notas" text,
  "historial" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
-- Por si la tabla ya existía de una versión anterior de este fichero (30-sep-2026).
ALTER TABLE "ora_sesiones" ADD COLUMN IF NOT EXISTS "profes" jsonb DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS "ora_sesiones_year_idx" ON "ora_sesiones" ("academic_year", "tipo_id");
CREATE INDEX IF NOT EXISTS "ora_sesiones_fecha_idx" ON "ora_sesiones" ("fecha");
CREATE INDEX IF NOT EXISTS "ora_sesiones_profe_idx" ON "ora_sesiones" ("profe_id");
CREATE INDEX IF NOT EXISTS "ora_sesiones_aviso_idx" ON "ora_sesiones" ("aviso_estado", "aviso_programado_para");

INSERT INTO "ora_tipos" ("codigo", "nombre", "nombre_correo", "emoji", "calendario_id", "frecuencia", "cantidad", "etapas", "texto_correo", "aviso_dias", "orden")
VALUES
  ('oratorio', 'Oratorio', 'oratorio', '🙏',
   'c_207a8e2010964dbd3809ca0d21ccf6642a549786af1f0c0ba27808d8ad8969ec@group.calendar.google.com',
   'mes', 1, '["ESO"]'::jsonb,
   'Será primero la mitad de la clase y luego la otra mitad. Los dividimos como prefieras, por grupos de trabajo o por orden de lista.',
   7, 0),
  ('godly', 'Godly Play', 'Godly Play', '🧸',
   'c_91636c40a49fa1fbcda6f3913828739f6c4d0fa2ffdb0c8447e6e8f65b113baa@group.calendar.google.com',
   'trimestre', 1, '["EI","EP"]'::jsonb, NULL, 7, 1)
ON CONFLICT ("codigo") DO NOTHING;

COMMIT;
