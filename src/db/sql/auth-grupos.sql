-- Usuarios y roles · grupos de usuarios (ficha: docs/01-auth-roles.md)
-- Fecha: 2026-11-12 · equivalente a `pnpm db:push` para las tablas auth_grupos*.
--
-- Puramente ADITIVO: crea dos tablas nuevas y no toca ninguna existente. Idempotente.
-- Un grupo (Pastoral, Comunicación…) da módulos a todos sus miembros, encima de su rol.
-- Al final siembra el grupo Pastoral con Números y Evaluaciones, sin miembros (se meten
-- desde /gestion/usuarios), con id fijo para que volver a lanzarlo no duplique nada.

BEGIN;

CREATE TABLE IF NOT EXISTS "auth_grupos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nombre" text NOT NULL,
  "descripcion" text,
  "modulos" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_grupos_nombre_idx" ON "auth_grupos" (lower("nombre"));

CREATE TABLE IF NOT EXISTS "auth_grupo_miembros" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "grupo_id" uuid NOT NULL REFERENCES "auth_grupos"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_grupo_miembros_grupo_email_idx" ON "auth_grupo_miembros" ("grupo_id", "email");
CREATE INDEX IF NOT EXISTS "auth_grupo_miembros_email_idx" ON "auth_grupo_miembros" ("email");

INSERT INTO "auth_grupos" ("id", "nombre", "descripcion", "modulos")
VALUES (
  '6a1f0c2e-0000-4000-8000-0000000a5701',
  'Pastoral',
  'Equipo de Pastoral',
  '["numeros", "evaluaciones"]'::jsonb
)
ON CONFLICT DO NOTHING;

COMMIT;
