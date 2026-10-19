-- Oratorios, Godly Play y Talleres · el tipo «Taller de Pensamiento Computacional»
-- (ficha: docs/26-oratorios.md)
-- Fecha: 2026-10-19
--
-- Lo apuntó Jose Miguel Batalla el 13-oct-2026: una sesión al mes por clase, en la hora de otro
-- profe, y aviso por correo a ese profe. Es exactamente lo que ya hacen Oratorio y Godly Play, así
-- que no hay tabla nueva: es una fila más de `ora_tipos`. Solo Primaria por ahora; las etapas, el
-- objetivo, el calendario y el texto del correo se retocan en Ajustes sin tocar código.
--
-- `calendario_id` se queda a NULL a propósito: alguien tiene que crear el calendario compartido y
-- pegar su id en Ajustes (hasta entonces, confirmar funciona y deja el error del calendario a la
-- vista, con reintentar).
--
-- Aditivo e idempotente: se puede lanzar dos veces sin romper nada. Se aplica con
-- `pnpm db:sql --pendientes`.

INSERT INTO "ora_tipos" ("codigo", "nombre", "nombre_correo", "emoji", "calendario_id", "frecuencia", "cantidad", "etapas", "texto_correo", "aviso_dias", "orden")
VALUES
  ('taller_pc', 'Taller de Pensamiento Computacional', 'taller de pensamiento computacional', '💻',
   NULL, 'mes', 1, '["EP"]'::jsonb, NULL, 7, 2)
ON CONFLICT ("codigo") DO NOTHING;
