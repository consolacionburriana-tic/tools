-- Quitar una plantilla del cuaderno tiene que poder quitarse de verdad.
-- Ficha: docs/18-cuaderno-tutor.md · Aditivo e idempotente, se aplica con SQL.
--
-- `cuad_items.plantilla_id` nació sin ON DELETE: la BBDD rechazaba el DELETE de una
-- plantilla que ya hubiera salido en alguna tirada. Se recrea la FK con CASCADE, como ya
-- la tiene `cuad_hojas`.

ALTER TABLE cuad_items DROP CONSTRAINT IF EXISTS cuad_items_plantilla_id_cuad_plantillas_id_fk;
ALTER TABLE cuad_items
  ADD CONSTRAINT cuad_items_plantilla_id_cuad_plantillas_id_fk
  FOREIGN KEY (plantilla_id) REFERENCES cuad_plantillas (id) ON DELETE CASCADE;
