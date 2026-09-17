-- Protección de datos del alumnado · columnas nuevas en `edu_students`
-- (ficha: docs/21-alumnado.md) · 2026-09-17, simplificado el mismo día
--
-- Dos casillas, no una lista larga (decisión de David):
--   · pd_imagen → ¿puede salir en fotos? Arranca en SÍ para todo el alumnado activo.
--   · pd_prodat → el documento Prodat. Arranca SIN CONTESTAR (null) y sin default.
--
-- Aditivo e idempotente: se puede lanzar dos veces. Se aplica con `pnpm db:sql --pendientes`
-- o pegándolo entero en la consola SQL de Neon.

BEGIN;

-- ── 1. Las columnas ──────────────────────────────────────────────────────────
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_imagen" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_prodat" boolean;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_notas" text;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_actualizado_at" timestamp;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "pd_actualizado_por" text;

-- ── 2. Punto de partida de las fotos: todos a «sí» ───────────────────────────
-- El `IS NULL` es lo que hace esto seguro de repetir: solo toca a quien aún no consta, así
-- que relanzar el fichero NO pisa ningún «no» ya marcado en la app.
UPDATE "edu_students" SET "pd_imagen" = true WHERE "active" AND "pd_imagen" IS NULL;

-- Y el alumnado que entre a partir de ahora (altas del sync de Educamos) arranca igual.
-- `pd_prodat` se queda SIN default a propósito: es un papel que vuelve o no vuelve, y
-- hasta que vuelve lo honesto es «sin contestar».
ALTER TABLE "edu_students" ALTER COLUMN "pd_imagen" SET DEFAULT true;

COMMIT;

-- ── Si llegaste a aplicar la primera versión de este fichero ─────────────────
-- Creaba además `pd_redes`, `pd_ampa`, `pd_ong` y `pd_firmada`. Ya no se usan: puedes
-- dejarlas (no molestan, la app no las lee) o quitarlas con esto, que NO se ejecuta solo:
--
--   ALTER TABLE "edu_students" DROP COLUMN IF EXISTS "pd_redes";
--   ALTER TABLE "edu_students" DROP COLUMN IF EXISTS "pd_ampa";
--   ALTER TABLE "edu_students" DROP COLUMN IF EXISTS "pd_ong";
--   ALTER TABLE "edu_students" DROP COLUMN IF EXISTS "pd_firmada";
