-- Inventario y aulas · edificios, plantas y tipos de espacio (ficha: docs/33-inventario.md) · 16-nov-2026
--
-- El cole son dos edificios (David): el Colegio, con cuatro plantas (C0-C3), y el Pabellón, con tres
-- (P0-P2). El código de planta lleva delante la letra del edificio para que «P1» no pueda ser de los
-- dos. Las 31 aulas del Excel son todas del Colegio (Infantil, en su planta baja): PB→C0, P1→C1,
-- P2→C2, P3→C3. Se crean los espacios del Pabellón, cada espacio pasa a tener su TIPO (aula de clase,
-- aula específica, espacio común) y los nombres de las salas se igualan con los de Horarios.
--
-- ADITIVO e idempotente: una columna nueva, y la conversión de plantas solo se hace mientras no haya
-- ninguna con código nuevo (si no, volver a lanzarlo convertiría las del Pabellón).

BEGIN;

ALTER TABLE "inv_aulas" ADD COLUMN IF NOT EXISTS "tipo" text DEFAULT 'clase' NOT NULL;

-- ── Plantas del Colegio ──
UPDATE inv_aulas SET piso = CASE piso WHEN 'PB' THEN 'C0' WHEN 'P1' THEN 'C1' WHEN 'P2' THEN 'C2' WHEN 'P3' THEN 'C3' END, updated_at = now()
WHERE piso IN ('PB', 'P1', 'P2', 'P3') AND NOT EXISTS (SELECT 1 FROM inv_aulas WHERE piso LIKE 'C%');

-- ── Antenas: misma planta, y la norma de nombres pasa a ser edificio+planta (C2_15, C0_PASILLO_ASCENSOR) ──
UPDATE inv_antenas SET
  piso = CASE piso WHEN 'PB' THEN 'C0' WHEN 'P1' THEN 'C1' WHEN 'P2' THEN 'C2' WHEN 'P3' THEN 'C3' ELSE piso END,
  nombre_nuevo = CASE
    WHEN nombre_nuevo ~ '^PB_' THEN 'C0_' || substr(nombre_nuevo, 4)
    WHEN nombre_nuevo ~ '^P[123]_' THEN 'C' || substr(nombre_nuevo, 2)
    ELSE nombre_nuevo END,
  ubicacion = CASE WHEN ubicacion = 'Aula de apoyo de la P2' THEN 'Aula de apoyo (Colegio, C2)' ELSE ubicacion END,
  updated_at = now()
WHERE NOT EXISTS (SELECT 1 FROM inv_antenas WHERE piso LIKE 'C%');

-- ── Las salas del Colegio: tipo y el mismo nombre que en Horarios ──
UPDATE inv_aulas SET tipo = 'especifica', nombre = 'Aula de música', updated_at = now() WHERE espacio_codigo = 'MUS';
UPDATE inv_aulas SET tipo = 'especifica', nombre = 'Aula Creativa', updated_at = now() WHERE espacio_codigo = 'CREA';

-- ── El Pabellón ── (las dos salas que ya estaban, sin planta, se colocan)
UPDATE inv_aulas SET tipo = 'especifica', nombre = 'Aula de informática', piso = 'P2', orden = 900, updated_at = now() WHERE espacio_codigo = 'INFO';
UPDATE inv_aulas SET tipo = 'especifica', nombre = 'Taller de tecnología', piso = 'P1', orden = 900, updated_at = now() WHERE espacio_codigo = 'TEC';

INSERT INTO inv_aulas (id, orden, piso, nombre, espacio_codigo, tipo)
SELECT gen_random_uuid(), v.orden, v.piso, v.nombre, v.codigo, v.tipo
FROM (VALUES
  (901, 'P2', 'Aula de plástica', 'PLAST', 'especifica'),
  (902, 'P2', 'Laboratorio', 'LAB', 'especifica'),
  (903, 'P2', 'COM / Godly Play', NULL, 'especifica'),
  (904, 'P2', 'Sala AMPA', NULL, 'comun'),
  (901, 'P1', 'Salón Verde', NULL, 'comun'),
  (902, 'P1', 'Aula Pequeña', NULL, 'especifica'),
  (900, 'P0', 'Pabellón deportivo', 'POLI', 'especifica'),
  (901, 'P0', 'Comedor', NULL, 'comun'),
  (902, 'P0', 'Vestuarios', NULL, 'comun')
) AS v(orden, piso, nombre, codigo, tipo)
WHERE NOT EXISTS (SELECT 1 FROM inv_aulas a WHERE a.nombre = v.nombre);

-- ── Horarios: los mismos nombres (son los de CONFIGURACION.horarios.aulasEso.aulas) ──
UPDATE hor_espacios SET nombre = 'Aula de música', updated_at = now() WHERE codigo = 'MUS' AND nombre <> 'Aula de música';
UPDATE hor_espacios SET nombre = 'Aula Creativa', updated_at = now() WHERE codigo = 'CREA' AND nombre <> 'Aula Creativa';
UPDATE hor_espacios SET nombre = 'Pabellón deportivo', updated_at = now() WHERE codigo = 'POLI' AND nombre <> 'Pabellón deportivo';

COMMIT;
