-- Separación de informes por etapa, opción de avisar al ausente y confirmación del sustituto.
ALTER TABLE sust_ausencias ADD COLUMN IF NOT EXISTS etapa text NOT NULL DEFAULT 'EP';
ALTER TABLE sust_ausencias ADD COLUMN IF NOT EXISTS avisar_ausente boolean NOT NULL DEFAULT true;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS confirmacion_token uuid;
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS confirmacion_estado text NOT NULL DEFAULT 'pendiente';
ALTER TABLE sust_sesiones ADD COLUMN IF NOT EXISTS confirmacion_at timestamp;
UPDATE sust_ausencias a
SET etapa = COALESCE(
  CASE WHEN t.etapa IN ('EI', 'EP', 'ESO') THEN t.etapa END,
  CASE WHEN t.etapas ? 'EI' THEN 'EI' WHEN t.etapas ? 'EP' THEN 'EP' WHEN t.etapas ? 'ESO' THEN 'ESO' END,
  'EP'
)
FROM edu_teachers t
WHERE t.id = a.profe_id
  AND a.etapa IS DISTINCT FROM COALESCE(
    CASE WHEN t.etapa IN ('EI', 'EP', 'ESO') THEN t.etapa END,
    CASE WHEN t.etapas ? 'EI' THEN 'EI' WHEN t.etapas ? 'EP' THEN 'EP' WHEN t.etapas ? 'ESO' THEN 'ESO' END,
    'EP'
  );
CREATE INDEX IF NOT EXISTS sust_ausencias_etapa_fechas_idx ON sust_ausencias (etapa, desde, hasta);
CREATE INDEX IF NOT EXISTS sust_sesiones_confirmacion_token_idx ON sust_sesiones (confirmacion_token);
