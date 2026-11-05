-- Oratorios, Godly Play y Talleres · Google Calendar: preferencias de cada persona y
-- respuesta del profe al evento
-- (ficha: docs/26-oratorios.md → «Qué le llega al profe y cuándo»)
-- Fecha: 2026-11-05
--
-- Dos casillas por persona, ambas apagadas por defecto:
--   · invitarme: invitarse a sí misma a los eventos que crea (duplicaba el evento);
--   · aviso_google: que Google mande su propio correo al profe además del de la app.
--
-- Y `ora_sesiones.respuesta_profe` / `respuesta_at`: lo que el profe ha contestado al evento
-- (accepted, declined, tentative, needsAction). Se lee de Calendar; el check verde de la
-- pantalla significa «el profe ha dicho que sí».
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`.

CREATE TABLE IF NOT EXISTS "ora_preferencias" (
  "email" text PRIMARY KEY NOT NULL,
  "invitarme" boolean DEFAULT false NOT NULL,
  "aviso_google" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "ora_sesiones" ADD COLUMN IF NOT EXISTS "respuesta_profe" text;
ALTER TABLE "ora_sesiones" ADD COLUMN IF NOT EXISTS "respuesta_at" timestamp;
