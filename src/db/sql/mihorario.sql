-- "Mi horario" · tablas nuevas (ficha: docs/20-mi-horario.md)
-- Fecha: 2026-09-06 · equivalente a `pnpm db:push` para hor_festivos + mih_*.
--
-- Puramente ADITIVO: crea 3 tablas nuevas y no toca ninguna existente (solo referencia
-- edu_teachers y hor_periodos). Idempotente: se puede ejecutar dos veces.
--
-- Los `id` NO llevan DEFAULT a propósito: el UUID lo pone la app
-- (`crypto.randomUUID()` en el schema). Si insertas filas a mano por SQL, pasa el id
-- tú (`gen_random_uuid()`).

BEGIN;

-- ─── Calendario de festivos del centro (compartido) ──────────────────────────
CREATE TABLE IF NOT EXISTS "hor_festivos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "academic_year" text NOT NULL,
  "nombre" text NOT NULL,
  "fecha_inicio" date NOT NULL,
  "fecha_fin" date NOT NULL,
  "tipo" text DEFAULT 'festivo' NOT NULL,
  "notas" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hor_festivos_year_idx" ON "hor_festivos" ("academic_year");
CREATE INDEX IF NOT EXISTS "hor_festivos_fechas_idx" ON "hor_festivos" ("fecha_inicio", "fecha_fin");

-- ─── Mi horario (prefijo mih_) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mih_preferencias" (
  "id" uuid PRIMARY KEY NOT NULL,
  "edu_teacher_id" uuid NOT NULL,
  "plantilla_titulo" text DEFAULT '{emoji} {abrev} · {clase}' NOT NULL,
  "plantilla_descripcion" text,
  "emojis" jsonb DEFAULT '{}' NOT NULL,
  "calendario_google_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "mih_preferencias_edu_teacher_id_unique" UNIQUE("edu_teacher_id")
);

CREATE TABLE IF NOT EXISTS "mih_exportaciones" (
  "id" uuid PRIMARY KEY NOT NULL,
  "edu_teacher_id" uuid NOT NULL,
  "periodo_id" uuid NOT NULL,
  "calendario_google_id" text NOT NULL,
  "eventos_creados" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mih_exportaciones_profe_idx" ON "mih_exportaciones" ("edu_teacher_id", "periodo_id");

-- ─── Claves ajenas (idempotentes) ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mih_preferencias_edu_teacher_id_edu_teachers_id_fk') THEN
    ALTER TABLE "mih_preferencias" ADD CONSTRAINT "mih_preferencias_edu_teacher_id_edu_teachers_id_fk"
      FOREIGN KEY ("edu_teacher_id") REFERENCES "edu_teachers"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mih_exportaciones_edu_teacher_id_edu_teachers_id_fk') THEN
    ALTER TABLE "mih_exportaciones" ADD CONSTRAINT "mih_exportaciones_edu_teacher_id_edu_teachers_id_fk"
      FOREIGN KEY ("edu_teacher_id") REFERENCES "edu_teachers"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mih_exportaciones_periodo_id_hor_periodos_id_fk') THEN
    ALTER TABLE "mih_exportaciones" ADD CONSTRAINT "mih_exportaciones_periodo_id_hor_periodos_id_fk"
      FOREIGN KEY ("periodo_id") REFERENCES "hor_periodos"("id");
  END IF;
END $$;

COMMIT;

-- Comprobación rápida tras ejecutarlo:
--   SELECT count(*) FROM information_schema.tables WHERE table_name IN
--     ('hor_festivos','mih_preferencias','mih_exportaciones');  -- 3
