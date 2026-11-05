-- Oratorios, Godly Play y Talleres · el correo de Google al profe, encendido por defecto
-- (ficha: docs/26-oratorios.md → «Qué le llega al profe y cuándo»)
-- Fecha: 2026-11-05
--
-- David (5-nov-2026): quiere que salga la invitación de Google al confirmar, porque con ella el
-- profe confirma con un clic. `ora_preferencias.aviso_google` pasa a `true` por defecto (la tabla
-- estaba vacía: no se pisa ninguna elección de nadie).
--
-- Aditivo e idempotente. Se aplica con `pnpm db:sql --pendientes`.

ALTER TABLE "ora_preferencias" ALTER COLUMN "aviso_google" SET DEFAULT true;
