-- Sustituciones · Salidas importadas del módulo Salidas y pagos (docs/32, decisión 25, 23-nov-2026):
-- de qué salida viene cada una, para no ofrecerla otra vez. Idempotente.
ALTER TABLE sust_salidas ADD COLUMN IF NOT EXISTS sal_trip_id uuid REFERENCES sal_trips(id);
CREATE INDEX IF NOT EXISTS sust_salidas_sal_trip_idx ON sust_salidas (sal_trip_id);
