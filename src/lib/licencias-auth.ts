// Auth simple del panel de licencias (sin DB). Credenciales por env con fallback.
export const ADMIN_EMAIL = process.env.LICENCIAS_ADMIN_EMAIL ?? 'licencias@consolacionburriana.com';
export const ADMIN_PASSWORD = process.env.LICENCIAS_ADMIN_PASSWORD ?? 'Licencias2025';
export const ADMIN_TOKEN = process.env.LICENCIAS_ADMIN_TOKEN ?? 'lic-admin-7f3a9c2e10b4';
export const ADMIN_COOKIE = 'lic_admin';
