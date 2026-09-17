-- Protección de datos del alumnado · 8 columnas nuevas en `edu_students`
-- (ficha: docs/21-alumnado.md) · Fecha: 2026-09-17
--
-- Puramente ADITIVO e idempotente: solo añade columnas, no toca ni borra ninguna.
--
-- Las cuatro autorizaciones son TRI-ESTADO (`true` autoriza · `false` NO autoriza ·
-- `null` no consta) y por eso van SIN default: poner `false` a las 639 filas diría que
-- todas las familias han dicho que no, y poner `true` diría que todas han dicho que sí.
-- Las dos cosas son mentira, y una de ellas se publica en internet.

BEGIN;

ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_imagen" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_redes" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_ampa" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_ong" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_firmada" boolean DEFAULT false NOT NULL;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_notas" text;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_actualizado_at" timestamp;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_actualizado_por" text;

COMMIT;
