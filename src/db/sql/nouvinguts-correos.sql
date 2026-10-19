-- Nouvinguts · notas que también se mandan por correo (ficha: docs/28-nouvinguts.md)
-- Fecha: 2026-10-19. Puramente ADITIVO e idempotente: una columna nueva en nou_notas.

ALTER TABLE "nou_notas" ADD COLUMN IF NOT EXISTS "enviada_a" text;
