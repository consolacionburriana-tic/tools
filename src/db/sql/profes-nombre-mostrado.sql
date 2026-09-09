-- El "given name" del profesorado: el nombre que queremos que salga en todas partes.
-- Fichas: docs/02-integracion-educamos.md y docs/18-cuaderno-tutor.md
-- Aditivo e idempotente, se aplica con SQL.
--
-- Educamos manda «JOSE MANUEL» y a esa persona todo el mundo la llama «Pepe». La heurística
-- de `nombreDePila()` acierta casi siempre, pero cuando no, esto es lo que manda: se escribe
-- a mano una vez en /gestion/profes y sale en el ASM, en el cuaderno, en los correos y en
-- los paneles. El sync de Educamos nunca lo pisa.

ALTER TABLE edu_teachers ADD COLUMN IF NOT EXISTS nombre_mostrado text;
