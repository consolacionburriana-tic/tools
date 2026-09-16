-- Fecha del último informe de licencias GRATIS del banco de libros descargado.
-- Ficha: docs/11-licencias-v2.md (Fase 3 · pedido a editoriales)
-- Aditivo e idempotente, se aplica con SQL.
--
-- Las licencias de pago llevan su propio ciclo por pedido (lic_orders.editorial_processed_at):
-- el informe es incremental, solo salen los pedidos que aún no se han pedido. Las del banco de
-- libros no nacen de un pedido — son un censo de "alumnos BdL × libros del banco de su curso" —
-- así que su informe es siempre completo. Guardamos cuándo se descargó para poder avisar en
-- pantalla y que nadie lo mande dos veces a la editorial por error.

ALTER TABLE lic_campaigns ADD COLUMN IF NOT EXISTS banco_report_at timestamp;
