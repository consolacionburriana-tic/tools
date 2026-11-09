-- Añade el Aula de Creatividad como sala especial consultable desde el navegador de horarios.
INSERT INTO "hor_espacios" ("id", "codigo", "nombre", "tipo", "active")
VALUES (gen_random_uuid(), 'CREA', 'Aula de Creatividad', 'aula', true)
ON CONFLICT ("codigo") DO UPDATE
SET "nombre" = EXCLUDED."nombre",
    "tipo" = EXCLUDED."tipo",
    "active" = true,
    "updated_at" = now();
