-- Evaluación conjunta: los formularios de alumnado, profesorado y familias de la MISMA
-- evaluación, creados a la vez, comparten `grupo_id`. Ficha: docs/16-evaluaciones.md
-- Aditivo e idempotente, se aplica con SQL.
--
-- Cada formulario sigue siendo independiente (sus preguntas, su enlace, su anonimato, su
-- estado): el grupo solo sirve para enseñarlos juntos, saltar de un sector a otro en el
-- editor y agruparlos en el listado. NULL = formulario suelto, como hasta ahora.

ALTER TABLE eval_forms ADD COLUMN IF NOT EXISTS grupo_id uuid;
CREATE INDEX IF NOT EXISTS eval_forms_grupo_idx ON eval_forms (grupo_id);
