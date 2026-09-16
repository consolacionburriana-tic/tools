-- Tiradas de pedidos a editoriales: un Google Sheet por editorial y tipo (pago / banco).
-- Ficha: docs/11-licencias-v2.md (Fase 3 · pedido a editoriales)
-- Aditivo e idempotente, se aplica con SQL.
--
-- Una fila por FICHERO generado. `tirada_id` agrupa los ficheros de una misma pulsación del
-- botón: hace falta para los dos pasos siguientes (convertir a PDF y marcar como hechos), que
-- actúan sobre lo que se generó y no sobre lo que haya pendiente en ese momento — entre generar
-- y marcar puede entrar un pedido nuevo, y ese no iba en el Sheet que se mandó a la editorial.
--
-- `order_ids` solo se rellena en las tiradas de pago: son los pedidos que entraron en el
-- fichero, los que se marcan con 🧾 al confirmar. Las del banco no salen de ningún pedido.

CREATE TABLE IF NOT EXISTS lic_pedidos_editorial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lic_campaigns(id) ON DELETE CASCADE,
  tirada_id uuid NOT NULL,
  tipo text NOT NULL,                 -- 'pago' | 'banco'
  editorial text NOT NULL,
  nombre text NOT NULL,               -- nombre del fichero en Drive
  sheet_id text,
  sheet_url text,
  pdf_id text,
  pdf_url text,
  unidades integer NOT NULL DEFAULT 0,
  libros integer NOT NULL DEFAULT 0,
  importe numeric(10, 2) NOT NULL DEFAULT 0,
  order_ids jsonb,
  marcado_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lic_pedidos_editorial_campaign_idx ON lic_pedidos_editorial (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lic_pedidos_editorial_tirada_idx ON lic_pedidos_editorial (tirada_id);
