-- Comedor y actividades complementarias en la ficha de alumnado (docs/21-alumnado.md, decisión 17)
-- Fecha: 2026-10-19
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`. Hasta que esté aplicado, la pantalla de Alumnado no carga:
-- el listado ya pide estas dos columnas.
--
-- false = no (lo de partida para todo el mundo); se marcan los síes desde Alumnado.
-- Las complementarias solo existen en Infantil y Primaria: en la ESO la columna se queda a
-- false y la pantalla ni la ofrece.

BEGIN;

ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "comedor" boolean DEFAULT false NOT NULL;
ALTER TABLE "edu_students" ADD COLUMN IF NOT EXISTS "complementarias" boolean DEFAULT false NOT NULL;

COMMIT;
