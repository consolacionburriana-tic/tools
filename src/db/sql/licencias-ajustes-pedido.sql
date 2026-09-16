-- Retoques a mano de las unidades de un pedido a editorial.
-- Ficha: docs/11-licencias-v2.md (Fase 3 · pedido a editoriales)
-- Aditivo e idempotente, se aplica con SQL.
--
-- El censo del banco de libros da a cada alumno TODOS los libros del banco de su curso, y en
-- 4ºESO eso no es verdad: Biología, Economía, Física y Química y Latín son de itinerario, así
-- que pedir 45 de cada una es pedir de más. La matrícula por materia no está en ninguna tabla
-- (ni en `lic_students` ni en `edu_students`), así que hasta que Educamos la dé, el número se
-- corrige aquí a mano.
--
-- Vale para cualquier fila de los dos informes, no solo para las optativas: es «lo calculado
-- dice X, pero pide Y». Se guarda el porqué en `nota` para que el año que viene se entienda.
-- Borrar la fila devuelve el número calculado.

CREATE TABLE IF NOT EXISTS lic_ajustes_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lic_campaigns(id) ON DELETE CASCADE,
  tipo text NOT NULL,                 -- 'pago' | 'banco'
  curso text NOT NULL,
  cod text NOT NULL,
  unidades integer NOT NULL,
  nota text,
  updated_by_email text,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT lic_ajustes_pedido_uq UNIQUE (campaign_id, tipo, curso, cod)
);
