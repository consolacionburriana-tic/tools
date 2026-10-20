-- Correos y grupos · tablas nuevas (ficha: docs/29-cuentas.md)
-- Fecha: 2026-10-20 · equivalente a `pnpm db:push` para las tablas cue_*.
--
-- Puramente ADITIVO: crea tablas nuevas y no toca ninguna existente. Idempotente.
-- Los `id` no llevan DEFAULT: los pone la app (`crypto.randomUUID()` en el schema).

BEGIN;

CREATE TABLE IF NOT EXISTS "cue_usuarios" (
  "google_id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "alias" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "nombre" text,
  "apellidos" text,
  "uo" text NOT NULL,
  "suspendida" boolean DEFAULT false NOT NULL,
  "archivada" boolean DEFAULT false NOT NULL,
  "admin" boolean DEFAULT false NOT NULL,
  "creada_at" timestamp,
  "ultimo_acceso_at" timestamp,
  "visto_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cue_usuarios_email_idx" ON "cue_usuarios" ("email");

CREATE TABLE IF NOT EXISTS "cue_unidades" (
  "ruta" text PRIMARY KEY NOT NULL,
  "google_id" text,
  "nombre" text NOT NULL,
  "descripcion" text,
  "origen" text DEFAULT 'google' NOT NULL,
  "visto_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cue_grupos" (
  "email" text PRIMARY KEY NOT NULL,
  "google_id" text,
  "nombre" text,
  "descripcion" text,
  "miembros" integer,
  "gestionado" boolean DEFAULT false NOT NULL,
  "reglas" jsonb,
  "ultima_sync_at" timestamp,
  "ultima_sync_por" text,
  "ultima_sync" jsonb,
  "visto_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" text
);

CREATE TABLE IF NOT EXISTS "cue_marcas" (
  "google_id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "tipo" text NOT NULL,
  "nota" text,
  "por" text,
  "at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cue_registro" (
  "id" uuid PRIMARY KEY NOT NULL,
  "at" timestamp DEFAULT now() NOT NULL,
  "por" text,
  "accion" text NOT NULL,
  "objetivo" text NOT NULL,
  "detalle" text,
  "ok" boolean DEFAULT true NOT NULL,
  "error" text
);
CREATE INDEX IF NOT EXISTS "cue_registro_at_idx" ON "cue_registro" ("at");

COMMIT;
