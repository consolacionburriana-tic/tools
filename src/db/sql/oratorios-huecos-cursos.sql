-- Oratorios, Godly Play y Talleres · para qué cursos es cada hueco (ficha: docs/26-oratorios.md)
-- Fecha: 2026-10-27
--
-- Lo pidió Jose Miguel Batalla (fallitos del 23 y 26-oct-2026): «los lunes de 16:15 son para
-- 1er ciclo siempre». Cada hueco de la disponibilidad puede ir solo para unos niveles ('1PRI',
-- '2PRI'…); NULL = para todos, como hasta ahora. El asistente y el autocompletar solo proponen
-- en ese hueco las clases de esos niveles.
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`.

ALTER TABLE "ora_disponibilidad" ADD COLUMN IF NOT EXISTS "cursos" jsonb;
