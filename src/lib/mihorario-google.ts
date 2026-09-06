// Adaptador de Google Calendar para "Mi horario". Ficha: docs/20-mi-horario.md
//
// MISMO mecanismo que `email-gmail.ts`: la cuenta de servicio ya tiene delegación de
// dominio (montada para el scope `gmail.send`); si en la consola de Workspace se le añade
// también `https://www.googleapis.com/auth/calendar` al MISMO Client ID, puede suplantar a
// cualquier buzón del dominio y escribir en su calendario sin que esa persona autorice nada
// por separado. Es la misma credencial, un scope más.
//
// ⚠️ Sin probar en vivo: este fichero se ha escrito siguiendo la documentación de la API
// v3 de Calendar y el mismo patrón (JWT + `subject`) que ya funciona en `email-gmail.ts`,
// pero esta sesión no tiene credenciales reales para ejecutarlo contra un calendario de
// verdad. La primera exportación real hay que mirarla con calma.
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function credenciales(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL ?? process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY ?? process.env.GOOGLE_SHEETS_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n',
  );
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export function calendarConfigurado(): boolean {
  return credenciales() !== null;
}

// Un cliente por buzón suplantado, igual que en email-gmail.ts (el JWT lleva el `subject`
// dentro, no se puede reutilizar entre personas).
const clientes = new Map<string, calendar_v3.Calendar>();

function getCalendar(buzon: string): calendar_v3.Calendar {
  const cacheado = clientes.get(buzon);
  if (cacheado) return cacheado;
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  const auth = new google.auth.JWT({
    email: cred.clientEmail,
    key: cred.privateKey,
    scopes: SCOPES,
    subject: buzon, // delegación de dominio: "actúa como el calendario de este buzón"
  });
  const cliente = google.calendar({ version: 'v3', auth });
  clientes.set(buzon, cliente);
  return cliente;
}

// ── Reintentos (mismo criterio que email-gmail.ts: 429 y 5xx, backoff exponencial) ─────

function esReintentable(e: unknown): boolean {
  const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
  if (typeof status === 'number' && (status === 429 || status >= 500)) return true;
  const mensaje = e instanceof Error ? e.message : String(e);
  return /rateLimitExceeded|userRateLimitExceeded|backendError|Quota exceeded/i.test(mensaje);
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function conReintentos<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
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

export interface CalendarioDisponible {
  id: string;
  nombre: string;
  esPrincipal: boolean;
}

/** Los calendarios de la persona, para el selector de destino ("¿en cuál lo meto?"). */
export async function listarCalendarios(buzon: string): Promise<CalendarioDisponible[]> {
  const cal = getCalendar(buzon);
  const { data } = await conReintentos(() => cal.calendarList.list({ minAccessRole: 'writer' }));
  return (data.items ?? [])
    .filter((c) => c.id)
    .map((c) => ({ id: c.id!, nombre: c.summaryOverride ?? c.summary ?? c.id!, esPrincipal: c.primary === true }));
}

/**
 * Crea los eventos ya construidos (ver `construirEventoGoogle` en `mihorario.ts`) en el
 * calendario indicado. Uno por uno —la API de Calendar no tiene un "insertar en lote" como
 * `messages.send` de Gmail— con la misma concurrencia moderada que los correos masivos,
 * para no chocar con la cuota. Los fallos son parciales: se cuentan y se sigue.
 */
export async function crearEventos(
  buzon: string,
  calendarId: string,
  eventos: readonly Record<string, unknown>[],
): Promise<{ creados: number; errores: number }> {
  const cal = getCalendar(buzon);
  const concurrencia = Math.max(1, Math.min(10, Number(process.env.GOOGLE_CALENDAR_CONCURRENCIA ?? 3)));
  let siguiente = 0;
  let creados = 0;
  let errores = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < eventos.length) {
      const requestBody = eventos[siguiente++];
      try {
        await conReintentos(() => cal.events.insert({ calendarId, requestBody }));
        creados++;
      } catch (e) {
        errores++;
        console.error('Google Calendar error:', e instanceof Error ? e.message : e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrencia, eventos.length || 1) }, trabajador));
  return { creados, errores };
}

/**
 * Borra los eventos de un periodo concreto que YA se habían exportado (marcados con
 * `extendedProperties.private.origen = 'tools-horarios'` y el `periodoId`). Es el
 * "deshacer", y también el primer paso de reexportar: se reescribe como una foto nueva,
 * no se intenta casar evento a evento.
 */
export async function borrarEventosDeOrigen(buzon: string, calendarId: string, periodoId: string): Promise<number> {
  const cal = getCalendar(buzon);
  let borrados = 0;
  let pageToken: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      cal.events.list({
        calendarId,
        privateExtendedProperty: [`origen=tools-horarios`, `periodoId=${periodoId}`],
        pageToken,
        maxResults: 250,
        showDeleted: false,
      }),
    );
    for (const ev of data.items ?? []) {
      if (!ev.id) continue;
      try {
        await conReintentos(() => cal.events.delete({ calendarId, eventId: ev.id! }));
        borrados++;
      } catch (e) {
        // Un evento ya borrado a mano por la persona no es un error: se sigue.
        console.error('Google Calendar (borrar) error:', e instanceof Error ? e.message : e);
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return borrados;
}
