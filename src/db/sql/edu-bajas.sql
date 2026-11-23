-- Bajas del profesorado (docs/32, «Bajas», 23-nov-2026): quién está de baja, desde cuándo, con
-- qué alta prevista o real y por qué. Se gestionan en Sustituciones › Bajas.
-- Aditivo e idempotente, se aplica con `pnpm db:sql edu-bajas`.
--
-- Una baja está VIGENTE un día si `desde <= día` y no hay alta real o el día es anterior a ella
-- (el alta es el primer día de vuelta). El alta PREVISTA no la cierra: solo avisa de que hay que
-- confirmarla o ampliarla. Mientras dura, la persona no recibe sustituciones. Si tiene sustituto,
-- es una Cobertura por baja (`edu_sustituciones.baja_id`) y el sustituto hereda su horario.
-- El motivo es un dato de salud: solo se ve dentro del módulo.

CREATE TABLE IF NOT EXISTS edu_bajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profe_id uuid NOT NULL REFERENCES edu_teachers(id),
  desde date NOT NULL,
  alta_prevista date,
  alta_real date,
  motivo text NOT NULL,
  ampliable boolean NOT NULL DEFAULT false,
  nota text,
  created_by_email text,
  updated_by_email text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edu_bajas_profe_idx ON edu_bajas (profe_id);

-- La cobertura (quién sustituye) cuelga de su baja: sus fechas las pone la baja.
ALTER TABLE edu_sustituciones ADD COLUMN IF NOT EXISTS baja_id uuid REFERENCES edu_bajas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS edu_sustituciones_baja_idx ON edu_sustituciones (baja_id);
