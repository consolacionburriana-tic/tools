-- Nombres a mano del cuaderno de tutor. Ficha: docs/18-cuaderno-tutor.md
-- Aditivo e idempotente. Se aplica con SQL, no con `pnpm db:push` (ver 04-convenciones).

CREATE TABLE IF NOT EXISTS cuad_personas (
  id uuid PRIMARY KEY,
  ambito text NOT NULL,
  persona_id uuid NOT NULL,
  pila text,
  completo text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cuad_personas_uq ON cuad_personas (ambito, persona_id);
