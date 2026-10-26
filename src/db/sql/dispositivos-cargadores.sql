-- Dispositivos 1:1 · cargadores de los iPads del cole (ficha: docs/29-dispositivos.md)
-- Fecha: 2026-10-26 · equivalente a `pnpm db:push` para la tabla dis_cargadores.
--
-- Puramente ADITIVO: crea una tabla nueva y no toca ninguna existente. Idempotente.
-- El `id` no lleva DEFAULT: lo pone la app (`crypto.randomUUID()` en el schema).

BEGIN;

CREATE TABLE IF NOT EXISTS "dis_cargadores" (
  "id" uuid PRIMARY KEY NOT NULL,
  "aparato_id" uuid NOT NULL REFERENCES "dis_aparatos"("id"),
  "codigo" text NOT NULL,
  "estado" text DEFAULT 'activo' NOT NULL,
  "notas" text,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "dis_cargadores_aparato_uq" ON "dis_cargadores" ("aparato_id");

COMMIT;
