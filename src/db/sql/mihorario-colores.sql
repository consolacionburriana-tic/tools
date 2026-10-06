-- "Mi horario" · color del evento en Google Calendar por materia/actividad (ficha: docs/20-mi-horario.md)
-- Puramente ADITIVO e idempotente: una columna nueva en mih_preferencias.

ALTER TABLE "mih_preferencias" ADD COLUMN IF NOT EXISTS "colores" jsonb DEFAULT '{}' NOT NULL;
