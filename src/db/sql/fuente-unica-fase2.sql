-- Fuente única de alumnado · fase 2: adelgazar `lic_students` (docs/06-fuente-unica-alumnado.md).
--
-- ⚠️  DESTRUCTIVO Y CON ORDEN. Borra columnas: el código que las lea deja de funcionar. Aplicar
-- SOLO cuando el despliegue en producción YA sea el de la fase 2 (el que no las lee ni las
-- escribe) o vaya a serlo en el mismo minuto. Por eso NO está en `pendientes.txt`: se apunta ahí
-- en el momento de aplicarlo, nunca antes.
--
-- Lo que se queda en la tabla: id, campaign_id, student_code (etiqueta de exportaciones),
-- edu_student_id, lengua_base (idioma de la clase: es de la campaña, la central no lo tiene),
-- active, manual_completed_*, created_at. Lo demás se lee de `edu_students` en vivo.
--
-- Idempotente: se puede relanzar.

-- 1) Las filas heredadas SIN enlace a la central (bajas del Excel original) no tienen a quién
--    leer: se borran, pero solo las inactivas y sin NADA colgando (pedidos, licencias, envíos).
DELETE FROM lic_students ls
 WHERE ls.edu_student_id IS NULL
   AND NOT ls.active
   AND NOT EXISTS (SELECT 1 FROM lic_orders o WHERE o.student_id = ls.id)
   AND NOT EXISTS (SELECT 1 FROM lic_licencias l WHERE l.student_id = ls.id)
   AND NOT EXISTS (SELECT 1 FROM lic_envios e WHERE e.student_id = ls.id);

-- 2) La identidad es obligatoria. Si todavía queda alguna fila sin enlace (activa, o con algo
--    colgando) esto FALLA a propósito y no se borra ninguna columna: hay que mirarla a mano.
ALTER TABLE lic_students ALTER COLUMN edu_student_id SET NOT NULL;

-- 3) Las columnas que eran copia de la central.
DROP INDEX IF EXISTS lic_students_search_idx;
ALTER TABLE lic_students DROP COLUMN IF EXISTS apellidos;
ALTER TABLE lic_students DROP COLUMN IF EXISTS apellido1;
ALTER TABLE lic_students DROP COLUMN IF EXISTS apellido2;
ALTER TABLE lic_students DROP COLUMN IF EXISTS nombre;
ALTER TABLE lic_students DROP COLUMN IF EXISTS birth_year;
ALTER TABLE lic_students DROP COLUMN IF EXISTS curso;
ALTER TABLE lic_students DROP COLUMN IF EXISTS letra;
ALTER TABLE lic_students DROP COLUMN IF EXISTS email;
ALTER TABLE lic_students DROP COLUMN IF EXISTS banco_libros;
ALTER TABLE lic_students DROP COLUMN IF EXISTS educamos_id;
