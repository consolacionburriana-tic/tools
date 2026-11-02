-- «Mi horario»: exportar a Google Calendar el horario de a quien se sustituye.
-- Ficha: docs/20-mi-horario.md y docs/02-integracion-educamos.md (Sustituciones).
-- Aditivo e idempotente, se aplica con `pnpm db:sql mihorario-exportar-titular`.
--
-- null = la persona exportó SU horario (lo de siempre, todas las filas que ya hay). Con valor:
-- exportó el horario de ese profe. Así el «deshacer» y el «volver a exportar» de uno no tocan
-- lo del otro.

ALTER TABLE mih_exportaciones ADD COLUMN IF NOT EXISTS de_profe_id uuid REFERENCES edu_teachers(id);
