-- Libro de cambios: auditoría de lo que se marca en Alumnado (ficha: docs/31-auditoria.md)
-- Fecha: 2026-11-03
--
-- Aditivo e idempotente. Se aplica con `pnpm db:sql --pendientes`.
-- Sin claves foráneas a propósito: el registro sobrevive a lo que le pase al alumno.

BEGIN;

CREATE TABLE IF NOT EXISTS "aud_cambios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "at" timestamp DEFAULT now() NOT NULL,
  "lote" uuid NOT NULL,
  "por" text,
  "origen" text DEFAULT 'usuario' NOT NULL,
  "edu_student_id" uuid NOT NULL,
  "alumno" text NOT NULL,
  "clase" text DEFAULT '' NOT NULL,
  "campo" text NOT NULL,
  "antes" text,
  "despues" text
);
CREATE INDEX IF NOT EXISTS "aud_cambios_at_idx" ON "aud_cambios" ("at");
CREATE INDEX IF NOT EXISTS "aud_cambios_lote_idx" ON "aud_cambios" ("lote");
CREATE INDEX IF NOT EXISTS "aud_cambios_alumno_idx" ON "aud_cambios" ("edu_student_id", "at");

COMMIT;
