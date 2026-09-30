-- Calendarios del dominio · tablas nuevas (ficha: docs/25-calendarios.md)
-- Fecha: 2026-09-30 · equivalente a `pnpm db:push` para cal_calendarios y cal_suscripciones.
--
-- Puramente ADITIVO: crea dos tablas nuevas y no toca ninguna existente. Idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS "cal_calendarios" (
  "id" text PRIMARY KEY NOT NULL,
  "nombre" text,
  "descripcion" text,
  "es_classroom" boolean DEFAULT false NOT NULL,
  "course_id" text,
  "course_nombre" text,
  "course_seccion" text,
  "course_estado" text,
  "course_creado_at" timestamp,
  "course_owner_email" text,
  "course_visto_at" timestamp,
  "eventos" integer,
  "eventos_futuros" integer,
  "primer_evento_at" timestamp,
  "ultimo_evento_at" timestamp,
  "eventos_contados_at" timestamp,
  "eventos_error" text,
  "visto_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "borrado_at" timestamp,
  "borrado_por" text,
  "borrado_como" text,
  "borrado_error" text
);
CREATE INDEX IF NOT EXISTS "cal_calendarios_borrado_idx" ON "cal_calendarios" ("borrado_at");
CREATE INDEX IF NOT EXISTS "cal_calendarios_course_idx" ON "cal_calendarios" ("course_id");

CREATE TABLE IF NOT EXISTS "cal_suscripciones" (
  "calendar_id" text NOT NULL,
  "email" text NOT NULL,
  "rol" text NOT NULL,
  "visto_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "cal_suscripciones_pk" ON "cal_suscripciones" ("calendar_id", "email");
CREATE INDEX IF NOT EXISTS "cal_suscripciones_email_idx" ON "cal_suscripciones" ("email");

COMMIT;
