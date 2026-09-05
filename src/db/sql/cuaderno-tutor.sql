-- Tablas del módulo Cuaderno de tutor (`cuad_*`). Ficha: docs/18-cuaderno-tutor.md
--
-- ⚠️ POR QUÉ ESTO ES UN .sql Y NO UN `pnpm db:push`:
-- el 2026-09-04 la BBDD de producción tenía 14 tablas `hor_*` (módulo de horarios) que NO
-- están en `src/db/schema.ts` ni en `main`. `drizzle-kit push` compara el schema con la BBDD
-- y habría querido BORRARLAS. Hasta que esas tablas estén en el schema, los cambios de este
-- repo se aplican con SQL aditivo como este, no con push. Ver `docs/00-desarrollos-futuros.md`.
--
-- Es idempotente: se puede volver a lanzar sin miedo.
-- Nombres de constraints e índices calcados de los que genera Drizzle, para que el día que
-- se pueda volver a usar `push` no vea ninguna diferencia.

CREATE TABLE IF NOT EXISTS cuad_plantillas (
  id uuid PRIMARY KEY,
  nombre text NOT NULL,
  google_doc_id text NOT NULL,
  repeticion text NOT NULL DEFAULT 'alumno',
  etapa text,
  orden integer NOT NULL DEFAULT 1,
  salto_de_pagina boolean NOT NULL DEFAULT true,
  genera_pdf boolean NOT NULL DEFAULT true,
  activa boolean NOT NULL DEFAULT true,
  etiquetas jsonb,
  tiene_filas boolean NOT NULL DEFAULT false,
  analizada_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuad_alias (
  id uuid PRIMARY KEY,
  etiqueta text NOT NULL,
  campo text NOT NULL,
  creado_por text,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cuad_alias_etiqueta_unique UNIQUE (etiqueta)
);

CREATE TABLE IF NOT EXISTS cuad_ajustes (
  id text PRIMARY KEY DEFAULT 'global',
  carpeta_base_id text,
  carpeta_base_url text,
  nombre_centro text NOT NULL DEFAULT 'Colegio Consolación Burriana',
  permiso_tutores text NOT NULL DEFAULT 'writer',
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuad_tiradas (
  id uuid PRIMARY KEY,
  academic_year text NOT NULL,
  numero integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'pendiente',
  opciones jsonb,
  carpeta_curso_id text,
  carpeta_curso_url text,
  lanzada_por text,
  error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  finished_at timestamp
);
CREATE INDEX IF NOT EXISTS cuad_tiradas_estado_idx ON cuad_tiradas (estado);

CREATE TABLE IF NOT EXISTS cuad_items (
  id uuid PRIMARY KEY,
  tirada_id uuid NOT NULL,
  plantilla_id uuid NOT NULL,
  curso text NOT NULL,
  letra text NOT NULL DEFAULT '',
  edu_teacher_id uuid,
  indice_tutor integer NOT NULL DEFAULT 1,
  alumno_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente',
  doc_id text,
  doc_url text,
  pdf_id text,
  pdf_url text,
  carpeta_id text,
  carpeta_url text,
  intentos integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cuad_items_tirada_id_cuad_tiradas_id_fk FOREIGN KEY (tirada_id) REFERENCES cuad_tiradas (id) ON DELETE CASCADE,
  CONSTRAINT cuad_items_plantilla_id_cuad_plantillas_id_fk FOREIGN KEY (plantilla_id) REFERENCES cuad_plantillas (id),
  CONSTRAINT cuad_items_edu_teacher_id_edu_teachers_id_fk FOREIGN KEY (edu_teacher_id) REFERENCES edu_teachers (id)
);
CREATE INDEX IF NOT EXISTS cuad_items_tirada_estado_idx ON cuad_items (tirada_id, estado);
CREATE INDEX IF NOT EXISTS cuad_items_estado_idx ON cuad_items (estado);

CREATE TABLE IF NOT EXISTS cuad_numeracion (
  id uuid PRIMARY KEY,
  edu_student_id uuid NOT NULL,
  academic_year text NOT NULL,
  curso text NOT NULL,
  letra text NOT NULL DEFAULT '',
  numero integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cuad_numeracion_edu_student_id_edu_students_id_fk FOREIGN KEY (edu_student_id) REFERENCES edu_students (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS cuad_numeracion_uq ON cuad_numeracion (edu_student_id, academic_year);
CREATE INDEX IF NOT EXISTS cuad_numeracion_clase_idx ON cuad_numeracion (academic_year, curso, letra);

CREATE TABLE IF NOT EXISTS cuad_hojas (
  id uuid PRIMARY KEY,
  edu_student_id uuid NOT NULL,
  plantilla_id uuid NOT NULL,
  academic_year text NOT NULL,
  tirada_id uuid,
  item_id uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cuad_hojas_edu_student_id_edu_students_id_fk FOREIGN KEY (edu_student_id) REFERENCES edu_students (id) ON DELETE CASCADE,
  CONSTRAINT cuad_hojas_plantilla_id_cuad_plantillas_id_fk FOREIGN KEY (plantilla_id) REFERENCES cuad_plantillas (id) ON DELETE CASCADE,
  CONSTRAINT cuad_hojas_tirada_id_cuad_tiradas_id_fk FOREIGN KEY (tirada_id) REFERENCES cuad_tiradas (id) ON DELETE SET NULL,
  CONSTRAINT cuad_hojas_item_id_cuad_items_id_fk FOREIGN KEY (item_id) REFERENCES cuad_items (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cuad_hojas_uq ON cuad_hojas (edu_student_id, plantilla_id, academic_year);
