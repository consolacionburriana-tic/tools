// La cuenta de servicio de Google, en común: credenciales, un JWT por buzón suplantado,
// reintentos y errores dichos de forma que se puedan arreglar.
//
// Nació con Correos y grupos (docs/29-cuentas.md), que es el tercer módulo que habla con
// las APIs de administración. Calendarios ya la usa; `email-gmail.ts`, `mihorario-google.ts`
// y `google-sheets.ts` todavía llevan su copia (ver docs/00-desarrollos-futuros.md).
//
// Todo pasa por la MISMA cuenta de servicio con delegación de todo el dominio: el JWT lleva
// el `subject` (el buzón que se suplanta) y los scopes que se piden. Si un scope no está en
// la delegación, Google no da el token (`unauthorized_client`): por eso cada acción pide
// solo el suyo, y lo que no se ha delegado todavía no impide lo demás.
import { google } from 'googleapis';

interface Credenciales {
  clientEmail: string;
  privateKey: string;
}

function credenciales(): Credenciales | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL ?? process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY ?? process.env.GOOGLE_SHEETS_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n',
  );
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export function googleConfigurado(): boolean {
  return credenciales() !== null;
}

/** Un JWT que actúa como `subject` con estos scopes. */
export function jwtGoogle(scopes: string | string[], subject: string) {
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  return new google.auth.JWT({
    email: cred.clientEmail,
    key: cred.privateKey,
    scopes: Array.isArray(scopes) ? scopes : [scopes],
    subject,
  });
}

// ── Errores ────────────────────────────────────────────────────────────────────

export function statusDe(e: unknown): number | null {
  const x = e as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const v of [x?.status, x?.response?.status, x?.code]) if (typeof v === 'number') return v;
  return null;
}

export function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** El fallo es de la delegación o de la API apagada, no de lo que se pedía. */
export function esErrorDeDelegacion(e: unknown): boolean {
  return /unauthorized_client|accessNotConfigured|has not been used in project|is disabled|invalid_grant/i.test(mensajeDe(e));
}

/** Traduce los errores típicos de delegación a algo que se pueda arreglar en la consola. */
export function explicarError(e: unknown): string {
  const m = mensajeDe(e);
  if (/unauthorized_client/i.test(m))
    return 'Falta el scope en la delegación de todo el dominio (consola de admin → Seguridad → Control de API)';
  if (/accessNotConfigured|has not been used in project|is disabled/i.test(m))
    return 'La API no está habilitada en el proyecto de Google Cloud de la cuenta de servicio';
  if (/invalid_grant/i.test(m)) return 'No se puede suplantar a ese buzón (¿no existe, está suspendido o no tiene el servicio?)';
  if (/Not Authorized to access this resource|insufficient permissions|forbidden/i.test(m) || statusDe(e) === 403)
    return 'Ese buzón no tiene permiso para esto (si es Directory o Classroom, tiene que ser administrador)';
  return m.slice(0, 300);
}

// ── Reintentos (429, 5xx y los límites de cuota que Google da como 403) ─────────

function esReintentable(e: unknown): boolean {
  const s = statusDe(e);
  if (s !== null && (s === 429 || s >= 500)) return true;
  return /rateLimitExceeded|userRateLimitExceeded|backendError|Quota exceeded/i.test(mensajeDe(e));
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function conReintentos<T>(fn: () => Promise<T>, intentos = 4): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (!esReintentable(e) || i === intentos - 1) throw e;
      await espera(500 * 2 ** i);
    }
  }
  throw ultimo;
}

/** Reparte `fn` sobre `items` con `n` a la vez. Los errores los maneja `fn`. */
export async function enParalelo<T, R>(items: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      salida[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, trabajador));
  return salida;
}

/**
 * A quién se suplanta para las APIs de administración (Directory, Classroom): tiene que ser
 * administrador del dominio. `GOOGLE_ADMIN_BUZON` si está puesto; si no, quien está usando
 * la pantalla (que, si llega aquí, es TIC y casi seguro admin).
 */
export function buzonAdmin(emailSesion: string): string {
  return (process.env.GOOGLE_ADMIN_BUZON || emailSesion).trim().toLowerCase();
}
