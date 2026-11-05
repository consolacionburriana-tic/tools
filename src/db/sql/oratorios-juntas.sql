-- Oratorios, Godly Play y Talleres · juntar clases en un mismo momento (ficha: docs/26-oratorios.md)
-- Fecha: 2026-11-05
--
-- David (5-nov-2026): «los PDC los tengo que juntar en la misma hora: 3 PDC + 4 PDC». Una sesión
-- puede llevar otras clases además de la principal (`curso`/`letra`): cuenta para el objetivo de
-- todas, y hay un solo evento de Calendar y un solo aviso. Vacío = una sola clase, como hasta ahora.
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`.

ALTER TABLE "ora_sesiones" ADD COLUMN IF NOT EXISTS "juntas" jsonb DEFAULT '[]'::jsonb NOT NULL;
