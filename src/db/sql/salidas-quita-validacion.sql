-- Quita la validación manual del justificante de Salidas: un justificante está enviado o
-- no lo está, no hay paso intermedio de "validar/rechazar". Ficha: docs/15-salidasypagos.md
--
-- Migra los datos ya existentes: lo que estaba 'validado' o 'rechazado' pasa a 'subido'
-- (el archivo se envió; ya no distinguimos si alguien lo revisó o lo rechazó). Aditivo e
-- idempotente: no queda ninguna fila con esos valores tras la primera pasada.

UPDATE sal_signups SET justificante_estado = 'subido' WHERE justificante_estado IN ('validado', 'rechazado');
