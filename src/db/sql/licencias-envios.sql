-- Envío de licencias a los alumnos (Fase 5 de docs/11-licencias-v2.md).
-- Aditivo e idempotente, se aplica con `pnpm db:sql --pendientes`.
--
-- POR QUÉ UNA TABLA NUEVA Y NO `lic_order_items`
-- ----------------------------------------------
-- Las licencias son de dos clases y solo una de ellas nace de un pedido:
--   · de PAGO  → una línea de `lic_order_items`, existe porque la familia la pidió.
--   · del BANCO de libros → NO existe en ninguna tabla. Es un censo calculado
--     (alumno BdL × libros del banco de su curso, resuelto por idioma). Un alumno del banco
--     recibe sus libros aunque no entre nunca en el formulario.
-- Para asignar un código y marcar "enviada" hace falta una FILA por licencia en los dos casos,
-- así que el censo se materializa aquí. `lic_licencias` es la única tabla del envío: una fila
-- es un hueco (alumno sin código), un sobrante (código sin alumno) o una licencia entera.
--
-- Los sobrantes son el caso de "se equivocan los comerciales y mandan 10 de más": se guardan
-- con `student_id` NULL para poder colocarlas más adelante. Postgres no choca varios NULL en
-- un índice único, así que conviven todos los sobrantes que haga falta del mismo libro (el
-- mismo truco que ya usa `bl_libros_curso`).

CREATE TABLE IF NOT EXISTS lic_licencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lic_campaigns(id) ON DELETE CASCADE,
  tipo text NOT NULL,                  -- 'pago' | 'banco' — nunca se mezclan (dos Excel distintos)
  curso text NOT NULL,                 -- curso EFECTIVO; con `cod` forma la identidad del libro
  cod text NOT NULL,
  student_id uuid REFERENCES lic_students(id),   -- NULL = sobrante en el almacén
  order_item_id uuid REFERENCES lic_order_items(id) ON DELETE CASCADE, -- solo las de pago
  codigo text,                         -- código de activación; NULL = pendiente de asignar
  codigo_at timestamp,
  codigo_por_email text,
  estado text NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'enviado' | 'error'
  enviado_at timestamp,
  enviado_a text,                      -- dirección exacta a la que se mandó (trazabilidad)
  envio_id uuid,                        -- agrupa las licencias que salieron en el mismo correo
  error text,
  -- Un hueco que no procede: la optativa que este alumno no cursa. El censo del banco da a
  -- todo el alumnado TODOS los libros del banco de su curso y la matrícula por materia no
  -- está en ninguna tabla (mismo motivo que `lic_ajustes_pedido`). Descartado deja de contar
  -- como "falta" sin borrar nada.
  descartado_at timestamp,
  descartado_motivo text,
  nota text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Una licencia por línea de pedido: el materializador puede correr las veces que haga falta.
CREATE UNIQUE INDEX IF NOT EXISTS lic_licencias_order_item_uq
  ON lic_licencias (order_item_id) WHERE order_item_id IS NOT NULL;

-- Una licencia por alumno y libro en el banco. Los sobrantes (student_id NULL) quedan fuera.
CREATE UNIQUE INDEX IF NOT EXISTS lic_licencias_banco_uq
  ON lic_licencias (campaign_id, student_id, curso, cod)
  WHERE tipo = 'banco' AND student_id IS NOT NULL;

-- Un código no puede estar en dos sitios. Es la red de seguridad del copiar y pegar: si una
-- selección de Excel se repite, el segundo intento falla en vez de mandar el mismo código a
-- dos alumnos. La pantalla ya avisa antes, esto es el último cortafuegos.
CREATE UNIQUE INDEX IF NOT EXISTS lic_licencias_codigo_uq
  ON lic_licencias (campaign_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS lic_licencias_campaign_idx ON lic_licencias (campaign_id, tipo, curso, cod);
CREATE INDEX IF NOT EXISTS lic_licencias_student_idx ON lic_licencias (student_id);
CREATE INDEX IF NOT EXISTS lic_licencias_envio_idx ON lic_licencias (envio_id);

-- Registro de correos enviados: una fila por CORREO (no por licencia), para poder consultar
-- después qué salió, a dónde y cuándo, y para que "fusionar varias licencias en un correo"
-- tenga a qué agarrarse.
CREATE TABLE IF NOT EXISTS lic_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lic_campaigns(id) ON DELETE CASCADE,
  tipo text NOT NULL,                  -- 'pago' | 'banco'
  student_id uuid REFERENCES lic_students(id),
  para text NOT NULL,                  -- destinatario
  asunto text NOT NULL,
  num_licencias integer NOT NULL DEFAULT 1,
  ok boolean NOT NULL DEFAULT true,
  error text,
  enviado_por_email text,
  enviado_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lic_envios_campaign_idx ON lic_envios (campaign_id, enviado_at DESC);
CREATE INDEX IF NOT EXISTS lic_envios_student_idx ON lic_envios (student_id);

-- Las plantillas de correo ya existían para los masivos de `/gestion/licencias/correos`. Ahora
-- las comparten dos pantallas con variables distintas, así que cada una lista las suyas.
ALTER TABLE lic_email_templates ADD COLUMN IF NOT EXISTS contexto text NOT NULL DEFAULT 'masivo';
-- `clave` marca las dos plantillas de fábrica ('banco' y 'pago') para poder proponerlas sin
-- que dependan de cómo las haya llamado quien las guardó.
ALTER TABLE lic_email_templates ADD COLUMN IF NOT EXISTS clave text;
CREATE UNIQUE INDEX IF NOT EXISTS lic_email_templates_clave_uq ON lic_email_templates (clave) WHERE clave IS NOT NULL;
