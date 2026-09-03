-- Puntualidad · tablas del módulo (ficha: docs/17-puntualidad.md)
-- Fecha: 2026-09-02 · equivalente a `pnpm db:push` para el bloque `pun_*` / `con_*`.
--
-- Puramente ADITIVO: crea 6 tablas nuevas y no toca ninguna existente (solo las
-- referencia: edu_students y edu_teachers). Idempotente: se puede ejecutar dos veces.
--
-- Nombres de constraint e índice iguales a los que genera Drizzle, para que un
-- `db:push` posterior no vea diferencias y no proponga cambios.
--
-- Los `id` NO llevan DEFAULT a propósito: el UUID lo pone la app
-- (`crypto.randomUUID()` en el schema). Si insertas filas a mano por SQL, pasa el id
-- tú (`gen_random_uuid()`).

BEGIN;

-- ─── Asignaturas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pun_subjects" (
  "id" uuid PRIMARY KEY NOT NULL,
  "nombre" text NOT NULL,
  "abreviatura" text,
  "edu_teacher_id" uuid,
  "orden" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ─── Retrasos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pun_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "edu_student_id" uuid NOT NULL,
  "curso" text,
  "letra" text,
  "fecha" date NOT NULL,
  "hora" text NOT NULL,
  "hora_limite" text NOT NULL,
  "minutos_retraso" integer NOT NULL,
  "subject_id" uuid,
  "justificado" boolean DEFAULT false NOT NULL,
  "justificacion_tipo" text,
  "justificacion_nota" text,
  "sube_a_clase" boolean DEFAULT false NOT NULL,
  "observaciones" text,
  "edu_teacher_id" uuid,
  "registrado_por_email" text,
  "academic_year" text NOT NULL,
  "aviso_profe_enviado_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ─── Consecuencias (prefijo propio: pueden separarse como módulo) ────────────
CREATE TABLE IF NOT EXISTS "con_consequence_types" (
  "id" uuid PRIMARY KEY NOT NULL,
  "clave" text NOT NULL,
  "nombre" text NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "con_consequence_types_clave_unique" UNIQUE("clave")
);

CREATE TABLE IF NOT EXISTS "con_consequences" (
  "id" uuid PRIMARY KEY NOT NULL,
  "edu_student_id" uuid NOT NULL,
  "tipo_clave" text DEFAULT 'sin_patio' NOT NULL,
  "origen" text DEFAULT 'puntualidad' NOT NULL,
  "fecha" date,
  "motivo" text,
  "notas" text,
  "cumplida" boolean DEFAULT false NOT NULL,
  "cumplida_at" timestamp,
  "avisada_educamos" boolean DEFAULT false NOT NULL,
  "avisada_educamos_at" timestamp,
  "token" text,
  "token_expira_at" timestamp,
  "aviso_enviado_at" timestamp,
  "aviso_destinatarios" jsonb,
  "creada_por_email" text,
  "fijada_por_email" text,
  "academic_year" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "con_consequences_token_unique" UNIQUE("token")
);

-- Puente: qué retrasos motivaron cada consecuencia. Un retraso vinculado deja de
-- contar para el ciclo siguiente (así "se reinicia el contador" sin contadores).
CREATE TABLE IF NOT EXISTS "con_consequence_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "consequence_id" uuid NOT NULL,
  "pun_record_id" uuid NOT NULL
);

-- ─── Bitácora del resumen semanal ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pun_digest_runs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "semana" text NOT NULL,
  "enviados" integer DEFAULT 0 NOT NULL,
  "destinatarios" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pun_digest_runs_semana_unique" UNIQUE("semana")
);

-- ─── Claves ajenas ───────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "pun_subjects" ADD CONSTRAINT "pun_subjects_edu_teacher_id_edu_teachers_id_fk"
    FOREIGN KEY ("edu_teacher_id") REFERENCES "public"."edu_teachers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pun_records" ADD CONSTRAINT "pun_records_edu_student_id_edu_students_id_fk"
    FOREIGN KEY ("edu_student_id") REFERENCES "public"."edu_students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pun_records" ADD CONSTRAINT "pun_records_subject_id_pun_subjects_id_fk"
    FOREIGN KEY ("subject_id") REFERENCES "public"."pun_subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pun_records" ADD CONSTRAINT "pun_records_edu_teacher_id_edu_teachers_id_fk"
    FOREIGN KEY ("edu_teacher_id") REFERENCES "public"."edu_teachers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "con_consequences" ADD CONSTRAINT "con_consequences_edu_student_id_edu_students_id_fk"
    FOREIGN KEY ("edu_student_id") REFERENCES "public"."edu_students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "con_consequence_records" ADD CONSTRAINT "con_consequence_records_consequence_id_con_consequences_id_fk"
    FOREIGN KEY ("consequence_id") REFERENCES "public"."con_consequences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "con_consequence_records" ADD CONSTRAINT "con_consequence_records_pun_record_id_pun_records_id_fk"
    FOREIGN KEY ("pun_record_id") REFERENCES "public"."pun_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "pun_records_alumno_fecha_idx" ON "pun_records" USING btree ("edu_student_id","fecha");
CREATE INDEX IF NOT EXISTS "pun_records_fecha_idx" ON "pun_records" USING btree ("fecha");
CREATE INDEX IF NOT EXISTS "pun_records_year_idx" ON "pun_records" USING btree ("academic_year");
CREATE INDEX IF NOT EXISTS "con_consequences_alumno_idx" ON "con_consequences" USING btree ("edu_student_id");
CREATE INDEX IF NOT EXISTS "con_consequences_fecha_idx" ON "con_consequences" USING btree ("fecha");
CREATE UNIQUE INDEX IF NOT EXISTS "con_consequence_records_uq" ON "con_consequence_records" USING btree ("consequence_id","pun_record_id");
CREATE INDEX IF NOT EXISTS "con_consequence_records_record_idx" ON "con_consequence_records" USING btree ("pun_record_id");

-- ─── Semillas ────────────────────────────────────────────────────────────────
-- Tipo de consecuencia por defecto. (La app también lo siembra al abrir el panel.)
INSERT INTO "con_consequence_types" ("id", "clave", "nombre", "orden")
VALUES (gen_random_uuid(), 'sin_patio', 'Se queda sin patio', 0)
ON CONFLICT ("clave") DO NOTHING;

-- Asignaturas de EJEMPLO de secundaria, para que el formulario no salga vacío. Se
-- cambian desde /gestion/puntualidad/asignaturas. Solo se insertan si la tabla está
-- vacía, igual que hace `ensureSubjects()`: así no pisan las que ya haya.
INSERT INTO "pun_subjects" ("id", "nombre", "orden")
SELECT gen_random_uuid(), nombre, (orden - 1) * 10
FROM (
  VALUES
    ('Castellano', 1), ('Valenciano', 2), ('Inglés', 3), ('Matemáticas', 4),
    ('Geografía e Historia', 5), ('Biología y Geología', 6), ('Física y Química', 7),
    ('Tecnología', 8), ('Educación Física', 9), ('Música', 10), ('Plástica', 11),
    ('Religión', 12), ('Tutoría', 13)
) AS ejemplo(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM "pun_subjects");

COMMIT;

-- ─── Comprobación (opcional, ejecútalo después) ──────────────────────────────
-- Debe devolver las 6 tablas, y 1 tipo de consecuencia + 13 asignaturas.
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('pun_subjects','pun_records','pun_digest_runs',
--                       'con_consequences','con_consequence_types','con_consequence_records')
--  ORDER BY table_name;
-- SELECT (SELECT count(*) FROM con_consequence_types) AS tipos,
--        (SELECT count(*) FROM pun_subjects) AS asignaturas;
