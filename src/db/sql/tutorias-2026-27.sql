-- Tutorías: copiar las de 2025-26 al curso 2026-27 tal cual (2026-09-03)
--
-- Decisión de David: NO promocionar (el botón de `/gestion/profes` sube al tutor con su
-- grupo: 1ESO→2ESO). Aquí se **clona** la asignación: cada tutor se queda en la MISMA
-- clase, con el alumnado nuevo que llegue a ese nivel.
--
-- Las filas de 2025-26 NO se tocan: quedan como histórico.
--
-- Idempotente: se puede ejecutar dos veces sin duplicar. Se comprueba con NOT EXISTS y
-- `IS NOT DISTINCT FROM` para la letra, porque el índice único `edu_tutorias_uq` no
-- deduplica cuando `letra` es NULL (en Postgres dos NULL no son iguales) — y en infantil
-- hay clases sin letra.

INSERT INTO edu_tutorias (id, curso, letra, edu_teacher_id, academic_year)
SELECT gen_random_uuid(), t.curso, t.letra, t.edu_teacher_id, '2026-27'
FROM edu_tutorias t
WHERE t.academic_year = '2025-26'
  AND NOT EXISTS (
    SELECT 1
    FROM edu_tutorias x
    WHERE x.academic_year = '2026-27'
      AND x.curso = t.curso
      AND x.letra IS NOT DISTINCT FROM t.letra
      AND x.edu_teacher_id = t.edu_teacher_id
  );

-- Comprobación: deben salir las mismas filas en los dos cursos, y las de ESO/PDC con
-- correo son las que hacen falta para los avisos de Puntualidad.
SELECT
  academic_year,
  count(*) AS tutorias,
  count(*) FILTER (WHERE curso ILIKE '%ESO%' OR curso ILIKE '%PDC%') AS de_secundaria
FROM edu_tutorias
GROUP BY academic_year
ORDER BY academic_year;
