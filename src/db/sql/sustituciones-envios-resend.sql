-- Sustituciones: los correos programados los guarda y dispara Resend (`scheduled_at`), sin cron.
-- Aquí queda el id que devuelve Resend, para poder cancelarlo o ver si salió.
ALTER TABLE sust_envios ADD COLUMN IF NOT EXISTS resend_id text;
