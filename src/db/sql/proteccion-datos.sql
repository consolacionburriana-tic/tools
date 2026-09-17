-- Protección de datos del alumnado · 8 columnas nuevas en `edu_students`
-- (ficha: docs/21-alumnado.md) · Fecha: 2026-09-17
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`, o pegándolo entero en la consola SQL de Neon.

BEGIN;

-- ── 1. Las columnas ──────────────────────────────────────────────────────────
-- Los cuatro permisos son tri-estado: true = autoriza · false = NO autoriza ·
-- null = no consta.
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_imagen" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_redes" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_ampa" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_ong" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_firmada" boolean DEFAULT false NOT NULL;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_notas" text;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_actualizado_at" timestamp;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_actualizado_por" text;

-- ── 2. Punto de partida: TODOS a «sí» ────────────────────────────────────────
-- Decisión de David (17-sep-2026): se arranca con los cuatro permisos autorizados y se van
-- marcando los noes según lleguen, en vez de empezar en blanco.
--
-- El `IS NULL` de cada WHERE es lo que hace esto seguro de repetir: solo toca lo que aún no
-- consta, así que un «no» ya marcado en la app NO se vuelve a poner a sí si alguien relanza
-- el fichero. `pd_firmada` se queda en false: esto es el punto de partida de trabajo del
-- colegio, no un papel firmado, y mezclar las dos cosas sería decir que hay 639 firmas que
-- no existen.
UPDATE "edu_students" SET "pd_imagen" = true WHERE "active" AND "pd_imagen" IS NULL;
UPDATE "edu_students" SET "pd_redes"  = true WHERE "active" AND "pd_redes"  IS NULL;
UPDATE "edu_students" SET "pd_ampa"   = true WHERE "active" AND "pd_ampa"   IS NULL;
UPDATE "edu_students" SET "pd_ong"    = true WHERE "active" AND "pd_ong"    IS NULL;

-- Y el alumnado que entre a partir de ahora (altas del sync de Educamos) arranca igual:
ALTER TABLE "edu_students" ALTER COLUMN "pd_imagen" SET DEFAULT true;
ALTER TABLE "edu_students" ALTER COLUMN "pd_redes"  SET DEFAULT true;
ALTER TABLE "edu_students" ALTER COLUMN "pd_ampa"   SET DEFAULT true;
ALTER TABLE "edu_students" ALTER COLUMN "pd_ong"    SET DEFAULT true;

COMMIT;
