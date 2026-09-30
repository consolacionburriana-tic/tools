-- Registro ABC: campo libre «Describe la situación problemática», justo antes del bloque
-- opcional del formulario. Ficha: docs/10-registro-abc.md
-- Aditivo e idempotente, se aplica con SQL.

ALTER TABLE abc_behavior_reports ADD COLUMN IF NOT EXISTS situation_description text;
