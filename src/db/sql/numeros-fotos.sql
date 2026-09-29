-- Números del cole: fotos mensuales para el histórico (ficha: docs/24-numeros.md)
-- Fecha: 2026-09-28
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`.

BEGIN;

CREATE TABLE IF NOT EXISTS "num_fotos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tomada_at" timestamp DEFAULT now() NOT NULL,
  "academic_year" text NOT NULL,
  "origen" text NOT NULL,
  "nota" text,
  "version" integer DEFAULT 1 NOT NULL,
  "datos" jsonb NOT NULL,
  "creada_por" text
);
CREATE INDEX IF NOT EXISTS "num_fotos_tomada_idx" ON "num_fotos" ("tomada_at");

COMMIT;
