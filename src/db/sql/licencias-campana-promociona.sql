-- Licencias · campaña que se abre antes de pasar el curso en la central (fuente única, 5-nov-2026).
--
-- La campaña del curso siguiente se abre en junio/julio, cuando `edu_students.curso` todavía es
-- el de este año: un alumno de 2º ESO va a pedir libros de 3º. `promociona = true` le dice a
-- Licencias que lea cada alumno un curso por delante (5º EP→6º EP, 6º EP→1º ESO … 3º ESO→4º ESO;
-- 4º ESO sale). Cuando la central ya está pasada de curso, se deja en `false`.
--
-- Aditivo e idempotente. No cambia nada de lo que ya existe (`false` = como hasta ahora).
ALTER TABLE lic_campaigns ADD COLUMN IF NOT EXISTS promociona boolean NOT NULL DEFAULT false;
