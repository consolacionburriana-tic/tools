-- Profesorado · etapas en multiselección (ficha: docs/21-alumnado.md)
-- Fecha: 2026-09-28 · equivalente a `pnpm db:push` para edu_teachers.etapas.
--
-- Puramente ADITIVO: una columna nueva, sin rellenar (la etapa única de siempre se sigue
-- leyendo aparte). Idempotente.

ALTER TABLE "edu_teachers" ADD COLUMN IF NOT EXISTS "etapas" jsonb;
