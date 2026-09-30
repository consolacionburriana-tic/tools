-- Calendarios del dominio · clases de Classroom (ficha: docs/25-calendarios.md)
-- Fecha: 2026-09-30 · equivalente a `pnpm db:push` para cal_clases.
--
-- Puramente ADITIVO: crea una tabla nueva y no toca ninguna existente. Idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS "cal_clases" (
  "id" text PRIMARY KEY NOT NULL,
  "nombre" text,
  "seccion" text,
  "estado" text,
  "creada_at" timestamp,
  "actualizada_at" timestamp,
  "owner_email" text,
  "calendar_id" text,
  "enlace" text,
  "visto_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "borrado_at" timestamp,
  "borrado_por" text,
  "borrado_error" text
);
CREATE INDEX IF NOT EXISTS "cal_clases_borrado_idx" ON "cal_clases" ("borrado_at");

COMMIT;
