-- Licencias del profesorado (Fase 5b de docs/11-licencias-v2.md).
-- Aditivo e idempotente, se aplica con `pnpm db:sql --pendientes`.
--
-- Se usan MUY poco (unas pocas por curso), así que no hay censo ni sincronización como en
-- `lic_licencias`: una fila es una anotación — un código que ha llegado para un profe. Se pega,
-- se le pone dueño y, si se quiere, se le manda por correo desde /gestion/licencias/envios.
--
-- `edu_teacher_id` NULL = código pegado al que aún no se le ha puesto profe. No se borra nada
-- del profe si se da de baja (no hay ON DELETE): en `edu_teachers` las bajas son `active=false`.

CREATE TABLE IF NOT EXISTS lic_licencias_profes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lic_campaigns(id) ON DELETE CASCADE,
  edu_teacher_id uuid REFERENCES edu_teachers(id),
  libro text,                          -- texto libre: «Inglés 3ºESO · guía docente»
  codigo text NOT NULL,
  nota text,
  enviado_at timestamp,
  enviado_a text,                      -- dirección exacta a la que se mandó
  created_por_email text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- El mismo código no se anota dos veces en la misma campaña.
CREATE UNIQUE INDEX IF NOT EXISTS lic_licencias_profes_codigo_uq
  ON lic_licencias_profes (campaign_id, codigo);
CREATE INDEX IF NOT EXISTS lic_licencias_profes_teacher_idx
  ON lic_licencias_profes (edu_teacher_id);
