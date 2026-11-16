-- Inventario y aulas (ficha: docs/33-inventario.md) · 16-nov-2026
-- Crea las tablas inv_* y vuelca los cuatro Excel de David:
--   · «Clases - Proyectores - TV» (el bueno: número de aula ↔ clase de este curso, y su audiovisual)
--   · «Mesas y Sillas Clases Infantil y Primaria»
--   · «Nombre Antenas Cole» (solo la parte de antenas: la columna «Aula curso 22/23» está obsoleta)
--   · «Inventario material pensamiento computacional» (el catálogo de robótica)
-- Puramente ADITIVO e idempotente: tablas nuevas, y los datos con ON CONFLICT DO NOTHING o
-- WHERE NOT EXISTS, así que volver a lanzarlo no duplica nada ni pisa lo que se haya editado.

BEGIN;

CREATE TABLE IF NOT EXISTS "inv_aulas" (
  "id" uuid PRIMARY KEY NOT NULL,
  "numero" text,
  "orden" integer DEFAULT 0 NOT NULL,
  "piso" text,
  "nombre" text,
  "espacio_codigo" text,
  "notas" text,
  "activa" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inv_aulas_numero_uq" ON "inv_aulas" ("numero");

CREATE TABLE IF NOT EXISTS "inv_ocupacion" (
  "id" uuid PRIMARY KEY NOT NULL,
  "aula_id" uuid NOT NULL REFERENCES "inv_aulas"("id"),
  "academic_year" text NOT NULL,
  "curso" text,
  "letra" text,
  "etiqueta" text,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inv_ocupacion_aula_uq" ON "inv_ocupacion" ("aula_id", "academic_year");
CREATE INDEX IF NOT EXISTS "inv_ocupacion_year_idx" ON "inv_ocupacion" ("academic_year");

CREATE TABLE IF NOT EXISTS "inv_av" (
  "aula_id" uuid PRIMARY KEY NOT NULL REFERENCES "inv_aulas"("id"),
  "pantalla" text,
  "marca" text,
  "audio" text,
  "apple_tv" boolean DEFAULT false NOT NULL,
  "valoracion" integer,
  "accion" text DEFAULT 'correcto' NOT NULL,
  "notas" text,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inv_mobiliario" (
  "aula_id" uuid PRIMARY KEY NOT NULL REFERENCES "inv_aulas"("id"),
  "sillas" integer,
  "mesas" integer,
  "notas" text,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inv_antenas" (
  "id" uuid PRIMARY KEY NOT NULL,
  "nombre_actual" text NOT NULL,
  "nombre_nuevo" text,
  "aula_id" uuid REFERENCES "inv_aulas"("id"),
  "piso" text,
  "ubicacion" text,
  "notas" text,
  "activa" boolean DEFAULT true NOT NULL,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inv_antenas_actual_uq" ON "inv_antenas" ("nombre_actual");

CREATE TABLE IF NOT EXISTS "inv_rob_modelos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "codigo_articulo" text,
  "nombre" text NOT NULL,
  "categoria" text DEFAULT 'otro' NOT NULL,
  "pedidas" integer,
  "prefijo" text,
  "notas" text,
  "orden" integer DEFAULT 0 NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inv_rob_modelos_nombre_uq" ON "inv_rob_modelos" ("nombre");

CREATE TABLE IF NOT EXISTS "inv_rob_kits" (
  "id" uuid PRIMARY KEY NOT NULL,
  "modelo_id" uuid NOT NULL REFERENCES "inv_rob_modelos"("id"),
  "codigo" text NOT NULL,
  "aula_id" uuid REFERENCES "inv_aulas"("id"),
  "estado" text DEFAULT 'ok' NOT NULL,
  "notas" text,
  "recibido_at" date,
  "actualizado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inv_rob_kits_codigo_uq" ON "inv_rob_kits" ("codigo");
CREATE INDEX IF NOT EXISTS "inv_rob_kits_modelo_idx" ON "inv_rob_kits" ("modelo_id");

CREATE TABLE IF NOT EXISTS "inv_rob_recursos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "modelo_id" uuid NOT NULL REFERENCES "inv_rob_modelos"("id"),
  "titulo" text NOT NULL,
  "url" text,
  "notas" text,
  "creado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "inv_rob_recursos_modelo_idx" ON "inv_rob_recursos" ("modelo_id");

CREATE TABLE IF NOT EXISTS "inv_arreglos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "aula_id" uuid REFERENCES "inv_aulas"("id"),
  "kit_id" uuid REFERENCES "inv_rob_kits"("id"),
  "area" text DEFAULT 'otro' NOT NULL,
  "texto" text NOT NULL,
  "prioridad" text DEFAULT 'normal' NOT NULL,
  "hecho_at" timestamp,
  "hecho_por" text,
  "creado_por" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "inv_arreglos_aula_idx" ON "inv_arreglos" ("aula_id");
CREATE INDEX IF NOT EXISTS "inv_arreglos_kit_idx" ON "inv_arreglos" ("kit_id");


-- ── Aulas (el número de la puerta manda) ──
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '1', 1, 'PB', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '2', 2, 'PB', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '3', 3, 'PB', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '4', 4, 'PB', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '5', 5, 'PB', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '6', 6, 'PB', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '7', 7, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '8', 8, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '9', 9, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '10', 10, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '11', 11, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '12', 12, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '13', 13, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '14', 14, 'P1', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '15', 15, 'P2', 'Aula de Música', 'MUS') ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '16', 16, 'P2', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '17-18', 17, 'P2', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '19', 19, 'P2', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '20', 20, 'P2', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '21', 21, 'P2', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '22', 22, 'P2', 'Aula Creativa', 'CREA') ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '23', 23, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '24', 24, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '25', 25, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '26', 26, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '27', 27, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '28', 28, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '29', 29, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '30', 30, 'P3', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO inv_aulas (id, numero, orden, piso, nombre, espacio_codigo) VALUES (gen_random_uuid(), '31', 31, 'P2', NULL, NULL) ON CONFLICT DO NOTHING;
-- Salas sin número de puerta donde suele estar el material de robótica (el piso, por confirmar).
INSERT INTO inv_aulas (id, orden, nombre, espacio_codigo) SELECT gen_random_uuid(), 900, 'Informática', 'INFO' WHERE NOT EXISTS (SELECT 1 FROM inv_aulas WHERE nombre = 'Informática');
INSERT INTO inv_aulas (id, orden, nombre, espacio_codigo) SELECT gen_random_uuid(), 900, 'Taller de tecnología', 'TEC' WHERE NOT EXISTS (SELECT 1 FROM inv_aulas WHERE nombre = 'Taller de tecnología');

-- ── Qué clase hay en cada aula este curso (la columna «Clase 25/26» del Excel, que David da por buena para 2026-27) ──
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3INF', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '1' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3INF', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '2' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4INF', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '3' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4INF', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '4' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '5INF', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '5' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '5INF', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '6' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '2PRI', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '7' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '2PRI', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '8' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '1PRI', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '9' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '1PRI', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '10' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3PRI', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '11' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3PRI', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '12' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4PRI', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '13' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4PRI', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '14' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '6PRI', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '16' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '6PRI', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '17-18' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '5PRI', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '19' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3ºPPDC', 'PDC', 'Excel de aulas' FROM inv_aulas WHERE numero = '20' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '5PRI', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '21' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '2ESO', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '23' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '2ESO', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '24' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4ESO', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '25' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3ESO', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '26' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4ESO', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '27' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '3ESO', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '28' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '1ESO', 'B', 'Excel de aulas' FROM inv_aulas WHERE numero = '29' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '1ESO', 'A', 'Excel de aulas' FROM inv_aulas WHERE numero = '30' ON CONFLICT DO NOTHING;
INSERT INTO inv_ocupacion (id, aula_id, academic_year, curso, letra, actualizado_por) SELECT gen_random_uuid(), id, '2026-27', '4ºPPDC', 'PDC', 'Excel de aulas' FROM inv_aulas WHERE numero = '31' ON CONFLICT DO NOTHING;

-- ── Audiovisual ── (valoración 0 con «Correcto» = sin valorar)
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson', 'altavoz_grande', true, 5, 'correcto', NULL, 'Excel de aulas' FROM inv_aulas WHERE numero = '1' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson', 'altavoz_grande', true, 5, 'correcto', NULL, 'Excel de aulas' FROM inv_aulas WHERE numero = '2' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Acer', 'pantalla', true, 5, 'correcto', NULL, 'Excel de aulas' FROM inv_aulas WHERE numero = '3' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Acer', 'pantalla', true, 4, 'correcto', 'mala conexión para conectar a la corriente del audio, tenían que jugar para que no hiciera ruido.', 'Excel de aulas' FROM inv_aulas WHERE numero = '4' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson', 'altavoz_grande', true, 5, 'correcto', NULL, 'Excel de aulas' FROM inv_aulas WHERE numero = '5' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson', 'pantalla', true, 5, 'correcto', NULL, 'Excel de aulas' FROM inv_aulas WHERE numero = '6' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HKC', 'tv', true, 5, 'correcto', 'se puede quitar proyector (optoma). Se quejan de que el wifi por la mañana no va bien', 'Excel de aulas' FROM inv_aulas WHERE numero = '7' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HITACHI', 'tv', true, 4, 'correcto', 'se puede quita proyector (benq). WIFI MAL', 'Excel de aulas' FROM inv_aulas WHERE numero = '8' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HTC', 'tv', true, 5, 'correcto', 'se puede quitar proyector (optoma). WIFI MAL', 'Excel de aulas' FROM inv_aulas WHERE numero = '9' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HITACHI', 'tv', true, 5, 'correcto', 'Se puede quitar el proyector (optoma). WIFI MAL', 'Excel de aulas' FROM inv_aulas WHERE numero = '10' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HITACHI', 'tv', true, 5, 'correcto', 'Se puede quitar proyector (optoma)', 'Excel de aulas' FROM inv_aulas WHERE numero = '11' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Pato', 'pantalla', true, 0, 'cambiar', 'El proyector no se ve.', 'Excel de aulas' FROM inv_aulas WHERE numero = '12' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Benq', 'altavoces_pequenos', true, 2, 'cambiar', 'No hay mando. El proyector se ve pero la calidad de la imagen es mala (se ha probado a modificar el brillo, contraste, etc y no mejora)', 'Excel de aulas' FROM inv_aulas WHERE numero = '13' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HKC', 'tv', true, NULL, 'correcto', 'Se puede quitar el proyector (optoma).', 'Excel de aulas' FROM inv_aulas WHERE numero = '14' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HKC', 'tv', true, 5, 'retirar', 'Hay un proyector antiguo, pantalla y altavoces, retirarlo. 
Apple TV no conecta bien a internet, retiramos apple tv para encontrar mando y probar bien
Ordenar cables
Colgar el letrero MUSICA de la puerta', 'Excel de aulas' FROM inv_aulas WHERE numero = '15' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Acer', 'altavoz_grande', true, 1, 'cambiar', 'Cambiar proyector no se ve apenas', 'Excel de aulas' FROM inv_aulas WHERE numero = '16' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'LG Pequeño', 'altavoces_pequenos', true, 2, 'cambiar', 'Proyector terrible calidad
Cambiar a TV o proyector mejor
Poner cable de red a Apple TV', 'Excel de aulas' FROM inv_aulas WHERE numero = '17-18' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson EB-X20', 'altavoces_pequenos', true, 4, 'reparar', '⚠️⚠️ Traer pantalla de la ESO o de musica
Solo funciona un altavoz, pero parece que va bien 
Cambiar filtro proyector', 'Excel de aulas' FROM inv_aulas WHERE numero = '19' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HKC 50"', 'tv', true, 5, 'correcto', 'Problema duplicar youtube', 'Excel de aulas' FROM inv_aulas WHERE numero = '20' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson EB-X20', 'altavoces_pequenos', true, 4, 'correcto', 'Cambiar filtro proyector
Cambiar pantalla (no baja más)
Solo funciona un altavoz, por la conexión que es mono', 'Excel de aulas' FROM inv_aulas WHERE numero = '21' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', NULL, 'altavoz_grande', true, 3, 'audio', 'No funciona audio??', 'Excel de aulas' FROM inv_aulas WHERE numero = '22' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Optoma', 'altavoz_grande', true, 1, 'cambiar', 'Cambiar por TV, reaprovechar altavoz, guardar proyector. 
Reordenar caja cables. E
liminar maderas pizarra + cambiar pizarra (no se puede escribir)', 'Excel de aulas' FROM inv_aulas WHERE numero = '23' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'HKC 50"', 'tv', true, 3, 'correcto', 'TV empieza a fallar. Mover al CENTRO', 'Excel de aulas' FROM inv_aulas WHERE numero = '24' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'Hitachi 50"', 'tv', true, 5, 'retirar', 'Reitrar proyector + pantalla plegable antigua + altavoz antiguo. 
Ordenar cables alimentacion', 'Excel de aulas' FROM inv_aulas WHERE numero = '25' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'Toshiba 50"', 'tv', true, 4, 'correcto', 'Valorar mover tv al CENTRO', 'Excel de aulas' FROM inv_aulas WHERE numero = '26' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson EB-S04', 'altavoces_pequenos', true, 5, 'audio', 'Falta cable de audio. 
Traer altavoz grande de la clase 23 ⚠️
COMPRAR FILTRO PROYECTOR URGENTE ⚠️', 'Excel de aulas' FROM inv_aulas WHERE numero = '27' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson EB-S04', 'altavoces_pequenos', true, 4, 'audio', 'COMPRAR FILTRO PROYECTOR URGENTE ⚠️
Un altavoz pequeño no va, valorar altavoces mejores
Poner altavoz de la clase 25 ⚠️ 
Restos de instalacion antigua en lado izquierdo', 'Excel de aulas' FROM inv_aulas WHERE numero = '28' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Acer', 'altavoces_pequenos', true, 3, 'cambiar', 'Proyector muy apagado, valorar cambiarlo por TV
Se nos dice que el audio falla, pero cuando vamos funciona.', 'Excel de aulas' FROM inv_aulas WHERE numero = '29' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'proyector', 'Epson EB-S04', 'altavoz_grande', true, NULL, 'correcto', 'COMPRAR FILTRO PROYECTOR URGENTE ⚠️', 'Excel de aulas' FROM inv_aulas WHERE numero = '30' ON CONFLICT DO NOTHING;
INSERT INTO inv_av (aula_id, pantalla, marca, audio, apple_tv, valoracion, accion, notas, actualizado_por) SELECT id, 'tv', 'Toshiba', 'tv', true, NULL, 'correcto', NULL, 'Excel de aulas' FROM inv_aulas WHERE numero = '31' ON CONFLICT DO NOTHING;

-- ── Mesas y sillas (Infantil y Primaria; la ESO, sin contar) ──
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 21, 7, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '1' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 25, 6, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '2' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 21, 21, '5 sillas pequeñas', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '3' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 25, 25, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '4' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 18, 18, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '5' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 20, 20, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '6' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 23, 23, '1 Mesa y 1 Silla Grande', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '7' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 22, 24, '1 Silla Grande', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '8' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 18, 19, '2 Sillas Grandes', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '9' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 18, 20, '1 Mesa Alta *1 de las mesas tiene el tablero medio suelto', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '10' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 25, 25, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '11' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 24, 25, '1 Silla Pequeña', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '12' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 26, 26, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '13' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 22, 22, 'Pasillo 4 mesas 3 sillas y 1 silla grande', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '14' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 23, 23, '1 mesa baja 2 mesas anchas', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '16' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 22, 23, '1 mesa ancha 1 mesa baja', 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '17-18' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 22, 25, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '19' ON CONFLICT DO NOTHING;
INSERT INTO inv_mobiliario (aula_id, sillas, mesas, notas, actualizado_por) SELECT id, 24, 24, NULL, 'Excel de mesas y sillas' FROM inv_aulas WHERE numero = '21' ON CONFLICT DO NOTHING;

-- ── Antenas (solo columnas C-E del Excel: la parte de puertas/aulas 22/23 está obsoleta) ──
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'PB_INFANTIL_1A', 'PB_PASILLO_ASCENSOR', NULL, 'PB', 'Pasillo 3 Años', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'PB_INFANTIL_2B', 'PB_PASILLO_ESCPEQ', NULL, 'PB', 'Pasillo 4/5 Años', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P1_PRIMARIA_2A_DER', 'P1_PASILLO_ASCENSOR', NULL, 'P1', 'Pasillo 1er Ciclo', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P1_PRIMARIA_3B_IZQ', 'P1_PASILLO_APOYO', NULL, 'P1', 'Pasillo 2º Ciclo', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_PRIMARIA_6B', 'P2_PASILLO_ASCENSOR', NULL, 'P2', 'Pasillo 3er Ciclo Ascensor', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_LABORATORIO', 'P2_PASILLO_APOYO', NULL, 'P2', 'Pasillo 3er Ciclo Laboratorio', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_SECUNDARIA_2C', 'P3_PASILLO_ASCENSOR', NULL, 'P3', 'Pasillo ESO Ascensor', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_SECUNDARIA_1C', 'P3_PASILLO_SPROF', NULL, 'P3', 'Pasillo ESO Sala Profesores', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_BIBLIOTECA', 'P2_15', (SELECT id FROM inv_aulas WHERE numero = '15'), 'P2', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_PRIMARIA_5A', 'P2_16', (SELECT id FROM inv_aulas WHERE numero = '16'), 'P2', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_PRIMARIA_5B', 'P2_17', (SELECT id FROM inv_aulas WHERE numero = '17-18'), 'P2', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_QUINTO_B', 'P2_19', (SELECT id FROM inv_aulas WHERE numero = '19'), 'P2', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_QUINTO_A', 'P2_21', (SELECT id FROM inv_aulas WHERE numero = '21'), 'P2', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P2_APOYO', 'P2_APOYO', NULL, 'P2', 'Aula de apoyo de la P2', 'En el Excel salía en «2º ESO C» (ubicación de cursos pasados).', 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'COMUNIDAD', 'P3_23', (SELECT id FROM inv_aulas WHERE numero = '23'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), '2º ESO A', 'P3_25', (SELECT id FROM inv_aulas WHERE numero = '25'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_26', 'P3_26', (SELECT id FROM inv_aulas WHERE numero = '26'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_1ESOA', 'P3_27', (SELECT id FROM inv_aulas WHERE numero = '27'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_1ESOC', 'P3_28', (SELECT id FROM inv_aulas WHERE numero = '28'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_29', 'P3_29', (SELECT id FROM inv_aulas WHERE numero = '29'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'P3_1ESOB', 'P3_30', (SELECT id FROM inv_aulas WHERE numero = '30'), 'P3', NULL, NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'CAPILLA', 'CAPILLA', NULL, NULL, 'Capilla', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'PB_SALA_PROFESORES', 'PB_SALA_PROFESORES', NULL, 'PB', 'Sala Profesores', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'PUERTA_TITULAR', 'PB_PORTERIA', NULL, 'PB', 'Puerta WC', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;
INSERT INTO inv_antenas (id, nombre_actual, nombre_nuevo, aula_id, piso, ubicacion, notas, actualizado_por) VALUES (gen_random_uuid(), 'PB_HABITACIONES', 'P1_HABITACIONES', NULL, 'P1', 'Habitaciones', NULL, 'Excel de antenas') ON CONFLICT DO NOTHING;

-- ── Robótica: el catálogo del pedido (cantidad vacía = no pedido) ──
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '165510', 'Lego Coding Express', 'robot', 4, NULL, NULL, 1) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227430', 'Tale-Bot Pro (pack de aula de 6)', 'robot', 2, NULL, NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '173057', 'Robot Kubo Coding', 'robot', 15, NULL, NULL, 3) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '172666', 'Tapetes GS 3 años', 'tapete', 2, NULL, NULL, 4) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '172669', 'Tapetes GS 4 años', 'tapete', 2, NULL, NULL, 5) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '172672', 'Tapetes GS 5 años', 'tapete', 2, NULL, NULL, 6) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '179480', 'Tapetes GS 1ºEP', 'tapete', 1, NULL, NULL, 7) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '179483', 'Tapetes GS 2ºEP', 'tapete', 1, NULL, NULL, 8) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '180729', 'KUBO Coding+ Set', 'accesorio', 2, NULL, NULL, 9) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '180730', 'KUBO Coding++ Set', 'accesorio', 1, NULL, NULL, 10) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '190518', 'KUBO Coding Math Set', 'accesorio', 2, NULL, NULL, 11) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227432', 'Codey Rocky', 'robot', 15, NULL, NULL, 12) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '169961', 'Lego Spike Prime', 'robot', 15, 'L', NULL, 13) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227434', 'Boson Starter Kit', 'electronica', NULL, NULL, NULL, 14) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227440', 'HuskyLens', 'electronica', NULL, NULL, NULL, 15) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227441', 'Inventor Kit Nezha', 'robot', 10, NULL, NULL, 16) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227442', 'Arduino + sensores + actuadores (Kit de robótica)', 'electronica', NULL, NULL, NULL, 17) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227533', 'Cortadora Láser xTool M1 10W Basic', 'fabricacion', NULL, NULL, NULL, 18) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '232199', 'Purificador xTool M1', 'fabricacion', NULL, NULL, NULL, 19) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '229673', 'Impressora 3D Bambu Lab A1 Combo EN KIT', 'fabricacion', NULL, NULL, NULL, 20) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '229675', 'Impressora 3D Bambu Lab P1S Combo', 'fabricacion', NULL, NULL, NULL, 21) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '229676', 'Impresora 3D Bambu Lab P2S combo', 'fabricacion', 2, NULL, NULL, 22) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230070', 'bee-bot robot', 'robot', NULL, NULL, NULL, 23) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230071', 'kit componentes micro bit', 'electronica', 7, NULL, NULL, 24) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230366', 'Mueble Robótica Abacus MMR', 'mobiliario', NULL, NULL, NULL, 25) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230647', 'TAPETE BLANCO BEE BOT', 'tapete', NULL, NULL, NULL, 26) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230648', 'TAPETE NUMEROS BEE BOT', 'tapete', NULL, NULL, NULL, 27) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230649', 'TAPETE LETRAS BEE BOT', 'tapete', NULL, NULL, NULL, 28) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230650', 'TAPETE MAPA MUNDI', 'tapete', NULL, NULL, NULL, 29) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230651', 'SUJETA BOLI BEE BOT', 'accesorio', NULL, NULL, NULL, 30) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230652', 'EMPUJADOR BEE BOT', 'accesorio', NULL, NULL, NULL, 31) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230677', 'Placa Micro:Bit v2.2 - Control(robot)', 'electronica', 20, NULL, NULL, 32) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227395', 'Robot Smart Cutebot PRO para Micro:bit', 'robot', NULL, NULL, NULL, 33) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '227396', 'Makeblock mBot2 con placa CyberPi', 'robot', 7, NULL, NULL, 34) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230753', 'Impresora Creality K2 Combo', 'fabricacion', NULL, NULL, NULL, 35) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230865', 'Let''s Go Code (Prodel)', 'robot', 3, NULL, NULL, 36) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231448', 'xTool S1 Enclosed Diode', 'fabricacion', NULL, NULL, NULL, 37) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231449', 'xTool M2 Color Craft Laser', 'fabricacion', NULL, NULL, NULL, 38) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231596', 'MICRO:MAQUEEN PLUS V2 (BATERIAS AA)', 'robot', 10, NULL, NULL, 39) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231922', 'Cortadora xTool S1 40w Pack ALL IN ONE', 'fabricacion', NULL, NULL, NULL, 40) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233278', 'Arduino® UNO R4 WiFi', 'electronica', NULL, NULL, NULL, 41) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233279', 'Arduino Starter Kit R4', 'electronica', 20, NULL, NULL, 42) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), NULL, 'Arduino replacement pack', 'accesorio', 1, NULL, 'Falta el código de artículo', 43) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), NULL, 'Raspberry Pi 5', 'electronica', 5, NULL, 'Falta el código de artículo', 44) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), NULL, 'KIT SMART HOME FOR ARDUINO CON PLACA KEYESTUDIO PLUS', 'electronica', NULL, NULL, 'Falta el código de artículo', 45) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233338', 'Pantalla LCD 16x2 con módulo i2C', 'accesorio', 1, NULL, NULL, 46) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233339', 'Pantalla OLED 0.96 128x64 con conector I2C', 'accesorio', NULL, NULL, NULL, 47) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233435', 'Armario de metal con tablero perforado (SUPEER)', 'mobiliario', 1, NULL, NULL, 48) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233600', 'Mesa de impresora 3D con almacenamiento de filamentos', 'mobiliario', NULL, NULL, NULL, 49) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230364', 'Rocada mesa de oficina', 'mobiliario', NULL, NULL, NULL, 50) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230629', 'MESA ROBOTICA ABA. 180X120', 'mobiliario', NULL, NULL, NULL, 51) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230630', 'MESA ROBOTICA ALTA 160X80', 'mobiliario', NULL, NULL, NULL, 52) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230631', 'MESA ROBOTICA 160X80', 'mobiliario', NULL, NULL, NULL, 53) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230632', 'CARRO CALLERO ESPACIO', 'mobiliario', NULL, NULL, NULL, 54) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230689', 'CAJITAS ALMACENAR MATERIAL', 'mobiliario', NULL, NULL, NULL, 55) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230890', 'Mesa escolar Space Plus', 'mobiliario', NULL, NULL, NULL, 56) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230891', 'Armario modular Do', 'mobiliario', NULL, NULL, NULL, 57) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230892', 'Armario escolar Lucy', 'mobiliario', NULL, NULL, NULL, 58) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '230893', 'Armario escolar Maud', 'mobiliario', NULL, NULL, NULL, 59) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231565', 'Pupitre escolar Hexa', 'mobiliario', NULL, NULL, NULL, 60) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231566', 'Armario escolar Emmy', 'mobiliario', NULL, NULL, NULL, 61) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '231567', 'Grada modular Mini Move', 'mobiliario', NULL, NULL, NULL, 62) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '232105', 'Armario Escolar Sophie25', 'mobiliario', NULL, NULL, NULL, 63) ON CONFLICT DO NOTHING;
INSERT INTO inv_rob_modelos (id, codigo_articulo, nombre, categoria, pedidas, prefijo, notas, orden) VALUES (gen_random_uuid(), '233002', 'Armario Escolar Sophie', 'mobiliario', NULL, NULL, NULL, 64) ON CONFLICT DO NOTHING;

-- ── Arreglos: las tareas que había escritas en las notas del Excel ──
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Arreglar la conexión del audio a la corriente: hace ruido', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '4' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Arreglar la conexión del audio a la corriente: hace ruido');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar el proyector antiguo (Optoma)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '7' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar el proyector antiguo (Optoma)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'red', 'Wifi: se quejan de que por la mañana no va bien', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '7' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Wifi: se quejan de que por la mañana no va bien');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar el proyector antiguo (BenQ)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '8' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar el proyector antiguo (BenQ)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'red', 'Wifi: va mal', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '8' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Wifi: va mal');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar el proyector antiguo (Optoma)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '9' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar el proyector antiguo (Optoma)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'red', 'Wifi: va mal', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '9' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Wifi: va mal');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar el proyector antiguo (Optoma)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '10' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar el proyector antiguo (Optoma)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'red', 'Wifi: va mal', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '10' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Wifi: va mal');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'mobiliario', 'Una mesa tiene el tablero medio suelto', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '10' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Una mesa tiene el tablero medio suelto');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar el proyector antiguo (Optoma)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '11' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar el proyector antiguo (Optoma)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el proyector: no se ve', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '12' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el proyector: no se ve');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el proyector: se ve con muy mala calidad', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '13' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el proyector: se ve con muy mala calidad');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Falta el mando del proyector', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '13' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Falta el mando del proyector');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar el proyector antiguo (Optoma)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '14' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar el proyector antiguo (Optoma)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Retirar el proyector antiguo, la pantalla y los altavoces', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '15' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Retirar el proyector antiguo, la pantalla y los altavoces');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'red', 'El Apple TV no conecta bien a internet: buscar el mando y probarlo', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '15' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'El Apple TV no conecta bien a internet: buscar el mando y probarlo');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Ordenar los cables', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '15' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Ordenar los cables');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'otro', 'Colgar el letrero MÚSICA en la puerta', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '15' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Colgar el letrero MÚSICA en la puerta');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el proyector: apenas se ve', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '16' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el proyector: apenas se ve');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el proyector (calidad terrible) por una TV o un proyector mejor', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '17-18' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el proyector (calidad terrible) por una TV o un proyector mejor');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'red', 'Poner cable de red al Apple TV', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '17-18' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Poner cable de red al Apple TV');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Traer una pantalla de la ESO o de Música', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '19' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Traer una pantalla de la ESO o de Música');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Solo funciona un altavoz', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '19' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Solo funciona un altavoz');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el filtro del proyector', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '19' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el filtro del proyector');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Problema al duplicar YouTube', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '20' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Problema al duplicar YouTube');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el filtro del proyector', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '21' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el filtro del proyector');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar la pantalla: no baja más', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '21' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar la pantalla: no baja más');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Solo funciona un altavoz (la conexión es mono)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '21' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Solo funciona un altavoz (la conexión es mono)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'No funciona el audio: revisarlo', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '22' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'No funciona el audio: revisarlo');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Cambiar el proyector por una TV (reaprovechar el altavoz y guardar el proyector)', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '23' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Cambiar el proyector por una TV (reaprovechar el altavoz y guardar el proyector)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Reordenar la caja de cables', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '23' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Reordenar la caja de cables');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'mobiliario', 'Quitar las maderas de la pizarra y cambiar la pizarra: no se puede escribir', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '23' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar las maderas de la pizarra y cambiar la pizarra: no se puede escribir');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'La TV empieza a fallar; moverla al centro', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '24' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'La TV empieza a fallar; moverla al centro');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Retirar el proyector, la pantalla plegable y el altavoz antiguos', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '25' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Retirar el proyector, la pantalla plegable y el altavoz antiguos');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Ordenar los cables de alimentación', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '25' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Ordenar los cables de alimentación');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Valorar mover la TV al centro', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '26' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Valorar mover la TV al centro');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Comprar el filtro del proyector', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '27' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Comprar el filtro del proyector');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Traer el altavoz grande de la clase 23', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '27' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Traer el altavoz grande de la clase 23');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Falta el cable de audio', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '27' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Falta el cable de audio');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Comprar el filtro del proyector', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '28' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Comprar el filtro del proyector');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Poner el altavoz de la clase 25', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '28' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Poner el altavoz de la clase 25');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Un altavoz pequeño no va: valorar altavoces mejores', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '28' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Un altavoz pequeño no va: valorar altavoces mejores');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Quitar los restos de la instalación antigua (lado izquierdo)', 'baja', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '28' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Quitar los restos de la instalación antigua (lado izquierdo)');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Proyector muy apagado: valorar cambiarlo por una TV', 'normal', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '29' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Proyector muy apagado: valorar cambiarlo por una TV');
INSERT INTO inv_arreglos (id, aula_id, area, texto, prioridad, creado_por) SELECT gen_random_uuid(), a.id, 'av', 'Comprar el filtro del proyector', 'urgente', 'Excel de aulas' FROM inv_aulas a WHERE a.numero = '30' AND NOT EXISTS (SELECT 1 FROM inv_arreglos x WHERE x.aula_id = a.id AND x.texto = 'Comprar el filtro del proyector');

COMMIT;
