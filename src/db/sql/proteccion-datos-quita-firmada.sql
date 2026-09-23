-- Quita `edu_students.pd_firmada` (David, 23-sep-2026: «el de firmado se va fuera, en la UI
-- y en la BBDD»). Ficha: docs/21-alumnado.md, fase 3.
--
-- ⚠️ Aplicar SOLO cuando el código que ya no lee la columna esté desplegado en producción:
-- si se aplica antes, la versión anterior (que hace `select pd_firmada`) revienta la
-- pantalla de Alumnado. Nunca llegó a tener datos (0 filas a true el 23-sep-2026).
-- Idempotente.

ALTER TABLE "edu_students" DROP COLUMN IF EXISTS "pd_firmada";
