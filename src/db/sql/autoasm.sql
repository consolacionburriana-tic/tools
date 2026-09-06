-- AUTOASM: histórico de entregas y configuración del FTP. Ficha: docs/19-autoasm.md
-- Aditivo e idempotente. Se aplica con SQL, no con `pnpm db:push` (ver 04-convenciones).

CREATE TABLE IF NOT EXISTS asm_entregas (
  id uuid PRIMARY KEY,
  academic_year text NOT NULL,
  modo text NOT NULL DEFAULT 'descargado',   -- 'descargado' | 'ftp' | 'manual'
  estado text NOT NULL DEFAULT 'ok',          -- 'ok' | 'error'
  quien text,
  desde_curso text,
  alumnos integer NOT NULL DEFAULT 0,
  profes integer NOT NULL DEFAULT 0,
  cursos integer NOT NULL DEFAULT 0,
  clases integer NOT NULL DEFAULT 0,
  matriculas integer NOT NULL DEFAULT 0,
  errores integer NOT NULL DEFAULT 0,
  avisos integer NOT NULL DEFAULT 0,
  fichero text,
  destino text,
  detalle text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asm_entregas_year_idx ON asm_entregas (academic_year, created_at);

CREATE TABLE IF NOT EXISTS asm_ftp_config (
  id uuid PRIMARY KEY,
  protocolo text NOT NULL DEFAULT 'ftps',     -- 'ftps' | 'ftp' | 'sftp'
  host text NOT NULL,
  puerto integer,
  usuario text NOT NULL,
  password_cifrada text NOT NULL,             -- AES-256-GCM, ver src/lib/cripto.ts
  ruta text NOT NULL DEFAULT '/',
  notas text,
  actualizado_por text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
