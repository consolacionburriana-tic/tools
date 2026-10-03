-- Tableros (kanban por equipos) · tablas nuevas (ficha: docs/27-tableros.md)
-- Fecha: 2026-10-03 · equivalente a `pnpm db:push` para las tablas tab_*.
--
-- Puramente ADITIVO: crea tablas nuevas y no toca ninguna existente. Idempotente.
-- Al final siembra el equipo TIC con sus dos tableros (Desarrollo interno y Mantenimiento de
-- aulas), con ids fijos para que volver a lanzarlo no duplique nada. Los miembros salen de
-- `auth_users` (rol tic/supertic) que además son profes activos: así entran las personas y no
-- los buzones genéricos (tic@, licencias@…), y no hay ningún correo escrito en el repo.

BEGIN;

CREATE TABLE IF NOT EXISTS "tab_equipos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nombre" text NOT NULL,
  "emoji" text DEFAULT '👥' NOT NULL,
  "color" text DEFAULT 'azul' NOT NULL,
  "descripcion" text,
  "archivado" boolean DEFAULT false NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tab_miembros" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "equipo_id" uuid NOT NULL REFERENCES "tab_equipos"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "nombre" text,
  "rol" text DEFAULT 'miembro' NOT NULL,
  "added_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tab_miembros_equipo_email_idx" ON "tab_miembros" ("equipo_id", "email");
CREATE INDEX IF NOT EXISTS "tab_miembros_email_idx" ON "tab_miembros" ("email");

CREATE TABLE IF NOT EXISTS "tab_tableros" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "equipo_id" uuid NOT NULL REFERENCES "tab_equipos"("id") ON DELETE CASCADE,
  "nombre" text NOT NULL,
  "emoji" text DEFAULT '📋' NOT NULL,
  "color" text DEFAULT 'azul' NOT NULL,
  "descripcion" text,
  "etiquetas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "archivado" boolean DEFAULT false NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tab_tableros_equipo_idx" ON "tab_tableros" ("equipo_id");

CREATE TABLE IF NOT EXISTS "tab_columnas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tablero_id" uuid NOT NULL REFERENCES "tab_tableros"("id") ON DELETE CASCADE,
  "nombre" text NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "hecho" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tab_columnas_tablero_idx" ON "tab_columnas" ("tablero_id");

CREATE TABLE IF NOT EXISTS "tab_tarjetas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tablero_id" uuid NOT NULL REFERENCES "tab_tableros"("id") ON DELETE CASCADE,
  "columna_id" uuid NOT NULL REFERENCES "tab_columnas"("id"),
  "titulo" text NOT NULL,
  "descripcion" text,
  "prioridad" text,
  "vence" date,
  "orden" double precision DEFAULT 0 NOT NULL,
  "responsables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "etiquetas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "enlaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "completada_at" timestamp,
  "archivada_at" timestamp,
  "aviso_proximo_para" date,
  "aviso_vencido_para" date,
  "created_by" text,
  "created_by_nombre" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tab_tarjetas_tablero_idx" ON "tab_tarjetas" ("tablero_id");
CREATE INDEX IF NOT EXISTS "tab_tarjetas_columna_idx" ON "tab_tarjetas" ("columna_id");
CREATE INDEX IF NOT EXISTS "tab_tarjetas_vence_idx" ON "tab_tarjetas" ("vence");

CREATE TABLE IF NOT EXISTS "tab_seguimiento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarjeta_id" uuid NOT NULL REFERENCES "tab_tarjetas"("id") ON DELETE CASCADE,
  "tipo" text DEFAULT 'comentario' NOT NULL,
  "texto" text NOT NULL,
  "autor_email" text,
  "autor_nombre" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tab_seguimiento_tarjeta_idx" ON "tab_seguimiento" ("tarjeta_id");

CREATE TABLE IF NOT EXISTS "tab_preferencias" (
  "email" text PRIMARY KEY,
  "correo_asignacion" boolean DEFAULT true NOT NULL,
  "correo_vencimientos" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ── Semilla: equipo TIC con dos tableros ─────────────────────────────────────

INSERT INTO "tab_equipos" ("id", "nombre", "emoji", "color", "descripcion", "created_by")
VALUES ('7ab0e000-0000-4000-8000-000000000001', 'TIC', '💻', 'azul',
        'El equipo TIC: desarrollo de la plataforma y mantenimiento de las aulas.', 'semilla')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "tab_miembros" ("equipo_id", "email", "nombre", "rol", "added_by")
SELECT '7ab0e000-0000-4000-8000-000000000001', u.email,
       COALESCE(t.nombre_mostrado, initcap(t.nombre)) || ' ' || initcap(t.apellido1), 'admin', 'semilla'
FROM "auth_users" u
JOIN LATERAL (
  SELECT * FROM "edu_teachers" et WHERE lower(et.email) = u.email AND et.active ORDER BY et.created_at DESC LIMIT 1
) t ON true
WHERE u.role IN ('tic', 'supertic') AND u.active
ON CONFLICT ("equipo_id", "email") DO NOTHING;

INSERT INTO "tab_tableros" ("id", "equipo_id", "nombre", "emoji", "color", "descripcion", "etiquetas", "orden", "created_by")
VALUES
  ('7ab0e000-0000-4000-8000-000000000011', '7ab0e000-0000-4000-8000-000000000001', 'Desarrollo interno', '🧑‍💻', 'violeta',
   'La plataforma Tools: módulos nuevos, mejoras y fallitos.',
   '[{"id":"fallito","nombre":"Fallito","color":"rojo"},{"id":"mejora","nombre":"Mejora","color":"azul"},{"id":"modulo","nombre":"Módulo nuevo","color":"violeta"},{"id":"espera","nombre":"Esperando a alguien","color":"ambar"}]'::jsonb,
   0, 'semilla'),
  ('7ab0e000-0000-4000-8000-000000000012', '7ab0e000-0000-4000-8000-000000000001', 'Mantenimiento de aulas', '🛠️', 'naranja',
   'Lo que se rompe o hay que preparar en las aulas: iPads, proyectores, red, impresoras…',
   '[{"id":"ipad","nombre":"iPad","color":"azul"},{"id":"proyector","nombre":"Proyector / pantalla","color":"violeta"},{"id":"red","nombre":"Red / Wi-Fi","color":"verde"},{"id":"impresora","nombre":"Impresora","color":"ambar"},{"id":"compra","nombre":"Hay que comprar","color":"rojo"}]'::jsonb,
   1, 'semilla')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "tab_columnas" ("id", "tablero_id", "nombre", "orden", "hecho")
VALUES
  ('7ab0e000-0000-4000-8000-000000000111', '7ab0e000-0000-4000-8000-000000000011', 'Por hacer', 0, false),
  ('7ab0e000-0000-4000-8000-000000000112', '7ab0e000-0000-4000-8000-000000000011', 'En curso', 1, false),
  ('7ab0e000-0000-4000-8000-000000000113', '7ab0e000-0000-4000-8000-000000000011', 'Hecho', 2, true),
  ('7ab0e000-0000-4000-8000-000000000121', '7ab0e000-0000-4000-8000-000000000012', 'Por hacer', 0, false),
  ('7ab0e000-0000-4000-8000-000000000122', '7ab0e000-0000-4000-8000-000000000012', 'En curso', 1, false),
  ('7ab0e000-0000-4000-8000-000000000123', '7ab0e000-0000-4000-8000-000000000012', 'Hecho', 2, true)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
