-- Bitácora y latido de las tiradas del cuaderno de tutor. Ficha: docs/18-cuaderno-tutor.md
-- Aditivo e idempotente. Se aplica con SQL, no con `pnpm db:push` (ver 04-convenciones).

ALTER TABLE cuad_tiradas ADD COLUMN IF NOT EXISTS latido_at timestamp;
ALTER TABLE cuad_tiradas ADD COLUMN IF NOT EXISTS pases integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cuad_eventos (
  id uuid PRIMARY KEY,
  tirada_id uuid,
  item_id uuid,
  nivel text NOT NULL DEFAULT 'info',
  fase text NOT NULL,
  mensaje text NOT NULL,
  datos jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cuad_eventos_tirada_id_cuad_tiradas_id_fk
    FOREIGN KEY (tirada_id) REFERENCES cuad_tiradas (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS cuad_eventos_tirada_idx ON cuad_eventos (tirada_id, created_at);
