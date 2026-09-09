-- Una plantilla del cuaderno puede valer para VARIAS etapas.
-- Ficha: docs/18-cuaderno-tutor.md · Aditivo e idempotente, se aplica con SQL.
--
-- Antes había una etapa única (`cuad_plantillas.etapa`, null = todas). La misma hoja sirve
-- a menudo para primaria y secundaria, y duplicar la plantilla en Docs solo para eso no
-- tiene sentido: ahora la columna es una lista (`etapas`), y vacía/null = todas.
--
-- La columna vieja se queda ahí de momento (los cambios de schema son aditivos): el código
-- la lee como respaldo en `etapasDePlantilla()` para las filas que nadie ha vuelto a
-- guardar. Cuando David dé el ok se borra con la última línea, que va comentada a propósito.

ALTER TABLE cuad_plantillas ADD COLUMN IF NOT EXISTS etapas jsonb;

-- Backfill: la etapa única pasa a ser una lista de una etapa. Solo las filas sin `etapas`.
UPDATE cuad_plantillas
   SET etapas = jsonb_build_array(etapa)
 WHERE etapas IS NULL AND etapa IS NOT NULL;

-- Cuando David dé el ok (y todas las plantillas se hayan vuelto a guardar):
-- ALTER TABLE cuad_plantillas DROP COLUMN etapa;
