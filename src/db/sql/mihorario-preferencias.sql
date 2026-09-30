-- "Mi horario" · abreviatura editable y rango del curso (ficha: docs/20-mi-horario.md)
-- Puramente ADITIVO e idempotente: dos columnas nuevas en mih_preferencias.

ALTER TABLE "mih_preferencias" ADD COLUMN IF NOT EXISTS "abreviaturas" jsonb DEFAULT '{}' NOT NULL;
ALTER TABLE "mih_preferencias" ADD COLUMN IF NOT EXISTS "rango_curso" text DEFAULT 'sep-jun' NOT NULL;
