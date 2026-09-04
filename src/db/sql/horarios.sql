-- Horarios · tablas de la pieza transversal (ficha: docs/07-horarios.md)
-- Fecha: 2026-09-03 · equivalente a `pnpm db:push` para el bloque `hor_*`.
--
-- Puramente ADITIVO: crea 13 tablas nuevas y no toca ninguna existente (solo las
-- referencia: edu_teachers y edu_students). Idempotente: se puede ejecutar dos veces.
--
-- Nombres de constraint e índice iguales a los que genera Drizzle, para que un
-- `db:push` posterior no vea diferencias y no proponga cambios.
--
-- Los `id` NO llevan DEFAULT a propósito: el UUID lo pone la app
-- (`crypto.randomUUID()` en el schema). Si insertas filas a mano por SQL, pasa el id
-- tú (`gen_random_uuid()`).
--
-- Al final va la semilla del catálogo de actividades (los tipos de hora), que es lo
-- único que el módulo necesita para arrancar. Rejillas y materias se crean desde las
-- pantallas o se importan.

BEGIN;

-- ─── Capa 1 · la rejilla ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hor_periodos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "academic_year" text NOT NULL,
  "nombre" text NOT NULL,
  "fecha_inicio" date NOT NULL,
  "fecha_fin" date NOT NULL,
  "prioridad" integer DEFAULT 0 NOT NULL,
  "es_ordinario" boolean DEFAULT false NOT NULL,
  "notas" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hor_periodos_year_idx" ON "hor_periodos" ("academic_year");
CREATE INDEX IF NOT EXISTS "hor_periodos_fechas_idx" ON "hor_periodos" ("fecha_inicio", "fecha_fin");

CREATE TABLE IF NOT EXISTS "hor_rejillas" (
  "id" uuid PRIMARY KEY NOT NULL,
  "periodo_id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "notas" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hor_rejillas_periodo_idx" ON "hor_rejillas" ("periodo_id");

CREATE TABLE IF NOT EXISTS "hor_rejilla_ambitos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "rejilla_id" uuid NOT NULL,
  "etapa" text,
  "curso" text,
  "letra" text
);
CREATE INDEX IF NOT EXISTS "hor_rejilla_ambitos_rejilla_idx" ON "hor_rejilla_ambitos" ("rejilla_id");
CREATE UNIQUE INDEX IF NOT EXISTS "hor_rejilla_ambitos_uq" ON "hor_rejilla_ambitos" ("rejilla_id", "etapa", "curso", "letra");

CREATE TABLE IF NOT EXISTS "hor_tramos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "rejilla_id" uuid NOT NULL,
  "dia_semana" integer NOT NULL,
  "orden" integer NOT NULL,
  "etiqueta" text,
  "hora_inicio" text NOT NULL,
  "hora_fin" text NOT NULL,
  "tipo" text DEFAULT 'sesion' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "hor_tramos_uq" ON "hor_tramos" ("rejilla_id", "dia_semana", "orden");
CREATE INDEX IF NOT EXISTS "hor_tramos_rejilla_dia_idx" ON "hor_tramos" ("rejilla_id", "dia_semana");

-- ─── Capa 2 · la asignación docente ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hor_actividades" (
  "id" uuid PRIMARY KEY NOT NULL,
  "codigo" text NOT NULL,
  "nombre" text NOT NULL,
  "lectiva" boolean DEFAULT true NOT NULL,
  "cubre_sustitucion" boolean DEFAULT false NOT NULL,
  "requiere_grupo" boolean DEFAULT false NOT NULL,
  "color" text,
  "orden" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "hor_actividades_codigo_unique" UNIQUE("codigo")
);

CREATE TABLE IF NOT EXISTS "hor_materias" (
  "id" uuid PRIMARY KEY NOT NULL,
  "nombre" text NOT NULL,
  "abreviatura" text,
  "etapa" text,
  "orden" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "hor_asignaciones" (
  "id" uuid PRIMARY KEY NOT NULL,
  "periodo_id" uuid NOT NULL,
  "academic_year" text NOT NULL,
  "actividad_id" uuid NOT NULL,
  "materia_id" uuid,
  "etiqueta" text,
  "lectiva" boolean,
  "aula" text,
  "notas" text,
  "origen" text DEFAULT 'manual' NOT NULL,
  "import_run_id" uuid,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hor_asignaciones_periodo_idx" ON "hor_asignaciones" ("periodo_id");
CREATE INDEX IF NOT EXISTS "hor_asignaciones_year_idx" ON "hor_asignaciones" ("academic_year");

CREATE TABLE IF NOT EXISTS "hor_asignacion_grupos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asignacion_id" uuid NOT NULL,
  "curso" text NOT NULL,
  "letra" text,
  "subgrupo" text
);
CREATE INDEX IF NOT EXISTS "hor_asignacion_grupos_asig_idx" ON "hor_asignacion_grupos" ("asignacion_id");
CREATE INDEX IF NOT EXISTS "hor_asignacion_grupos_clase_idx" ON "hor_asignacion_grupos" ("curso", "letra");

CREATE TABLE IF NOT EXISTS "hor_asignacion_profes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asignacion_id" uuid NOT NULL,
  "edu_teacher_id" uuid NOT NULL,
  "rol" text DEFAULT 'titular' NOT NULL,
  "principal" boolean DEFAULT false NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "hor_asignacion_profes_uq" ON "hor_asignacion_profes" ("asignacion_id", "edu_teacher_id");
CREATE INDEX IF NOT EXISTS "hor_asignacion_profes_profe_idx" ON "hor_asignacion_profes" ("edu_teacher_id");

-- ─── Capa 3 · la colocación ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hor_sesiones" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asignacion_id" uuid NOT NULL,
  "tramo_id" uuid NOT NULL,
  "dia_semana" integer NOT NULL,
  "orden" integer NOT NULL,
  "semana" text,
  "aula" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "hor_sesiones_uq" ON "hor_sesiones" ("asignacion_id", "tramo_id");
CREATE INDEX IF NOT EXISTS "hor_sesiones_tramo_idx" ON "hor_sesiones" ("tramo_id");

-- ─── Apoyos PT/AL, alias de importación y bitácora ───────────────────────────
CREATE TABLE IF NOT EXISTS "hor_apoyos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asignacion_id" uuid NOT NULL,
  "edu_student_id" uuid NOT NULL,
  "modalidad" text DEFAULT 'fuera' NOT NULL,
  "sale_de_asignacion_id" uuid,
  "fecha_inicio" date,
  "fecha_fin" date,
  "notas" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hor_apoyos_asig_idx" ON "hor_apoyos" ("asignacion_id");
CREATE INDEX IF NOT EXISTS "hor_apoyos_alumno_idx" ON "hor_apoyos" ("edu_student_id");

CREATE TABLE IF NOT EXISTS "hor_alias" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tipo" text NOT NULL,
  "codigo_externo" text NOT NULL,
  "edu_teacher_id" uuid,
  "materia_id" uuid,
  "curso" text,
  "letra" text,
  "aula" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "hor_alias_uq" ON "hor_alias" ("tipo", "codigo_externo");

CREATE TABLE IF NOT EXISTS "hor_import_runs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "periodo_id" uuid,
  "tipo" text DEFAULT 'horarios' NOT NULL,
  "filename" text,
  "formato" text,
  "quien_email" text,
  "resumen" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hor_import_runs_created_idx" ON "hor_import_runs" ("created_at");

-- ─── Claves ajenas (idempotentes) ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_rejillas_periodo_id_hor_periodos_id_fk') THEN
    ALTER TABLE "hor_rejillas" ADD CONSTRAINT "hor_rejillas_periodo_id_hor_periodos_id_fk"
      FOREIGN KEY ("periodo_id") REFERENCES "hor_periodos"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_rejilla_ambitos_rejilla_id_hor_rejillas_id_fk') THEN
    ALTER TABLE "hor_rejilla_ambitos" ADD CONSTRAINT "hor_rejilla_ambitos_rejilla_id_hor_rejillas_id_fk"
      FOREIGN KEY ("rejilla_id") REFERENCES "hor_rejillas"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_tramos_rejilla_id_hor_rejillas_id_fk') THEN
    ALTER TABLE "hor_tramos" ADD CONSTRAINT "hor_tramos_rejilla_id_hor_rejillas_id_fk"
      FOREIGN KEY ("rejilla_id") REFERENCES "hor_rejillas"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_asignaciones_periodo_id_hor_periodos_id_fk') THEN
    ALTER TABLE "hor_asignaciones" ADD CONSTRAINT "hor_asignaciones_periodo_id_hor_periodos_id_fk"
      FOREIGN KEY ("periodo_id") REFERENCES "hor_periodos"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_asignaciones_actividad_id_hor_actividades_id_fk') THEN
    ALTER TABLE "hor_asignaciones" ADD CONSTRAINT "hor_asignaciones_actividad_id_hor_actividades_id_fk"
      FOREIGN KEY ("actividad_id") REFERENCES "hor_actividades"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_asignaciones_materia_id_hor_materias_id_fk') THEN
    ALTER TABLE "hor_asignaciones" ADD CONSTRAINT "hor_asignaciones_materia_id_hor_materias_id_fk"
      FOREIGN KEY ("materia_id") REFERENCES "hor_materias"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_asignacion_grupos_asignacion_id_hor_asignaciones_id_fk') THEN
    ALTER TABLE "hor_asignacion_grupos" ADD CONSTRAINT "hor_asignacion_grupos_asignacion_id_hor_asignaciones_id_fk"
      FOREIGN KEY ("asignacion_id") REFERENCES "hor_asignaciones"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_asignacion_profes_asignacion_id_hor_asignaciones_id_fk') THEN
    ALTER TABLE "hor_asignacion_profes" ADD CONSTRAINT "hor_asignacion_profes_asignacion_id_hor_asignaciones_id_fk"
      FOREIGN KEY ("asignacion_id") REFERENCES "hor_asignaciones"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_asignacion_profes_edu_teacher_id_edu_teachers_id_fk') THEN
    ALTER TABLE "hor_asignacion_profes" ADD CONSTRAINT "hor_asignacion_profes_edu_teacher_id_edu_teachers_id_fk"
      FOREIGN KEY ("edu_teacher_id") REFERENCES "edu_teachers"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_sesiones_asignacion_id_hor_asignaciones_id_fk') THEN
    ALTER TABLE "hor_sesiones" ADD CONSTRAINT "hor_sesiones_asignacion_id_hor_asignaciones_id_fk"
      FOREIGN KEY ("asignacion_id") REFERENCES "hor_asignaciones"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_sesiones_tramo_id_hor_tramos_id_fk') THEN
    ALTER TABLE "hor_sesiones" ADD CONSTRAINT "hor_sesiones_tramo_id_hor_tramos_id_fk"
      FOREIGN KEY ("tramo_id") REFERENCES "hor_tramos"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_apoyos_asignacion_id_hor_asignaciones_id_fk') THEN
    ALTER TABLE "hor_apoyos" ADD CONSTRAINT "hor_apoyos_asignacion_id_hor_asignaciones_id_fk"
      FOREIGN KEY ("asignacion_id") REFERENCES "hor_asignaciones"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_apoyos_edu_student_id_edu_students_id_fk') THEN
    ALTER TABLE "hor_apoyos" ADD CONSTRAINT "hor_apoyos_edu_student_id_edu_students_id_fk"
      FOREIGN KEY ("edu_student_id") REFERENCES "edu_students"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_apoyos_sale_de_asignacion_id_hor_asignaciones_id_fk') THEN
    ALTER TABLE "hor_apoyos" ADD CONSTRAINT "hor_apoyos_sale_de_asignacion_id_hor_asignaciones_id_fk"
      FOREIGN KEY ("sale_de_asignacion_id") REFERENCES "hor_asignaciones"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_alias_edu_teacher_id_edu_teachers_id_fk') THEN
    ALTER TABLE "hor_alias" ADD CONSTRAINT "hor_alias_edu_teacher_id_edu_teachers_id_fk"
      FOREIGN KEY ("edu_teacher_id") REFERENCES "edu_teachers"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_alias_materia_id_hor_materias_id_fk') THEN
    ALTER TABLE "hor_alias" ADD CONSTRAINT "hor_alias_materia_id_hor_materias_id_fk"
      FOREIGN KEY ("materia_id") REFERENCES "hor_materias"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hor_import_runs_periodo_id_hor_periodos_id_fk') THEN
    ALTER TABLE "hor_import_runs" ADD CONSTRAINT "hor_import_runs_periodo_id_hor_periodos_id_fk"
      FOREIGN KEY ("periodo_id") REFERENCES "hor_periodos"("id");
  END IF;
END $$;

-- ─── Semilla: catálogo de actividades (los tipos de hora) ────────────────────
-- `lectiva` = cuenta como hora lectiva del profe (se puede pisar por asignación).
-- `cubre_sustitucion` = es la hora DESDE la que se cubre a quien falta (la guardia).
INSERT INTO "hor_actividades" ("id", "codigo", "nombre", "lectiva", "cubre_sustitucion", "requiere_grupo", "orden")
VALUES
  (gen_random_uuid(), 'clase',            'Clase',                  true,  false, true,  10),
  (gen_random_uuid(), 'tutoria',          'Tutoría con el grupo',   true,  false, true,  20),
  (gen_random_uuid(), 'apoyo_pt',         'Apoyo PT',               true,  false, false, 30),
  (gen_random_uuid(), 'apoyo_al',         'Audición y lenguaje',    true,  false, false, 40),
  (gen_random_uuid(), 'guardia',          'Guardia',                true,  true,  false, 50),
  (gen_random_uuid(), 'departamento',     'Departamento',           false, false, false, 60),
  (gen_random_uuid(), 'coordinacion',     'Coordinación',           false, false, false, 70),
  (gen_random_uuid(), 'reunion',          'Reunión',                false, false, false, 80),
  (gen_random_uuid(), 'atencion_padres',  'Atención a familias',    false, false, false, 90),
  (gen_random_uuid(), 'atencion_alumnos', 'Atención a alumnado',    false, false, false, 100),
  (gen_random_uuid(), 'oratorio',         'Oratorio',               true,  false, false, 110),
  (gen_random_uuid(), 'libre_disposicion','Libre disposición',      false, false, false, 120)
ON CONFLICT ("codigo") DO NOTHING;

COMMIT;

-- Comprobación rápida tras ejecutarlo:
--   SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'hor\_%';  -- 13
--   SELECT count(*) FROM hor_actividades;                                          -- 12
