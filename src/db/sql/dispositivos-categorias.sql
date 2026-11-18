-- Dispositivos 1:1 · categorías de iPads del cole (ficha: docs/29-dispositivos.md, decisión 12)
-- Fecha: 2026-11-18 · equivalente a `pnpm db:push` para la tabla dis_categorias.
--
-- Los dos lotes de siempre (Sustitución «S», Profesorado «P») pasan de estar fijos en el código
-- a ser filas, y el colegio puede añadir las suyas (TEC de la escuela de idiomas, AL de
-- audición y lenguaje…). La `clave` de las dos primeras es el `uso` que ya llevan los iPads de
-- `dis_aparatos`: no hay que tocar ningún iPad.
--
-- Puramente ADITIVO e idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS "dis_categorias" (
  "clave" text PRIMARY KEY NOT NULL,
  "nombre" text NOT NULL,
  "prefijo" text NOT NULL,
  "titular" text DEFAULT 'profe' NOT NULL,
  "explica" text,
  "orden" integer DEFAULT 0 NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "dis_categorias_prefijo_uq" ON "dis_categorias" (upper("prefijo"));

INSERT INTO "dis_categorias" ("clave", "nombre", "prefijo", "titular", "explica", "orden")
VALUES
  ('sustitucion', 'Sustitución', 'S', 'alumno', 'Los del alumnado: se prestan para todo el curso o se dejan mientras arreglan el de un alumno', 1),
  ('profesorado', 'Profesorado', 'P', 'profe', 'Los del claustro, desde el 3er ciclo de Primaria', 2)
ON CONFLICT ("clave") DO NOTHING;

COMMIT;
