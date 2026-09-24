-- Tareas de la plataforma · tabla nueva (ficha: docs/23-tareas.md)
-- Fecha: 2026-09-24 · equivalente a `pnpm db:push` para tar_tareas.
--
-- Puramente ADITIVO: crea una tabla nueva y no toca ninguna existente. Idempotente.
-- El `id` no lleva DEFAULT: lo pone la app (`crypto.randomUUID()` en el schema).

BEGIN;

CREATE TABLE IF NOT EXISTS "tar_tareas" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "modulo" text,
  "descripcion" text,
  "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "estado" text DEFAULT 'pendiente' NOT NULL,
  "ruta" text,
  "created_by" text,
  "created_by_nombre" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "hecho_at" timestamp
);
CREATE INDEX IF NOT EXISTS "tar_tareas_estado_idx" ON "tar_tareas" ("estado");
CREATE INDEX IF NOT EXISTS "tar_tareas_created_by_idx" ON "tar_tareas" ("created_by");

COMMIT;
