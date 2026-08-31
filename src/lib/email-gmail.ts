// Adaptador de envío por la API de Gmail (Google Workspace) — "opción B" de
// docs/00-desarrollos-futuros.md, ya decidida. No se usa directamente desde los módulos:
// el punto de entrada sigue siendo `src/lib/email.ts` (perfiles de remitente + `enviar`).
//
// Cómo funciona: la MISMA cuenta de servicio que escribe en el Sheet de Licencias, pero con
// **delegación de dominio** para el scope `gmail.send`, suplantando un buzón real del dominio
// (`subject` del JWT). El correo sale del buzón de verdad (licencias@…, no-responder@…), con
// el DKIM del dominio, aparece en "Enviados" de ese buzón y las respuestas llegan a él.
//
// Límites reales que condicionan los envíos masivos (Workspace, por buzón suplantado):
// ~2.000 mensajes/día y ~250 unidades de cuota/segundo — `messages.send` cuesta 100, o sea
// ~2,5 correos/segundo. De ahí la concurrencia pequeña y los reintentos con espera de abajo:
// un masivo de 300 familias son 300 llamadas (~2 min), no 3 como en el batch de Resend.
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

function credenciales(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL ?? process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY ?? process.env.GOOGLE_SHEETS_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n',
  );
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export function gmailConfigurado(): boolean {
  return credenciales() !== null;
}

// Un cliente por buzón suplantado (el JWT lleva el `subject` dentro, no se puede reutilizar).
const clientes = new Map<string, gmail_v1.Gmail>();

function getGmail(buzon: string): gmail_v1.Gmail {
  const cacheado = clientes.get(buzon);
  if (cacheado) return cacheado;
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  const auth = new google.auth.JWT({
    email: cred.clientEmail,
    key: cred.privateKey,
    scopes: SCOPES,
    subject: buzon, // delegación de dominio: "envía como este buzón"
  });
  const cliente = google.gmail({ version: 'v1', auth });
  clientes.set(buzon, cliente);
  return cliente;
}

// ── Armado del MIME ───────────────────────────────────────────────────────────
// Las cabeceras solo admiten ASCII: cualquier acento ("Consolación", asuntos con emoji) va
// codificado en RFC 2047. El cuerpo, en base64, para no pelearnos con líneas largas ni con
// caracteres de escape del quoted-printable.

export function encabezado(valor: string): string {
  return /^[\x20-\x7E]*$/.test(valor) ? valor : `=?UTF-8?B?${Buffer.from(valor, 'utf8').toString('base64')}?=`;
}

export function direccion(nombre: string, email: string): string {
  return nombre ? `${encabezado(nombre)} <${email}>` : email;
}

export interface MensajeGmail {
  from: string; // ya formateado ("Nombre <buzon@dominio>")
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export function construirMime(m: MensajeGmail): string {
  const cuerpo = Buffer.from(m.html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  const cabeceras = [
    `From: ${m.from}`,
    `To: ${m.to.join(', ')}`,
    m.replyTo ? `Reply-To: ${m.replyTo}` : null,
    `Subject: ${encabezado(m.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean);
  return `${cabeceras.join('\r\n')}\r\n\r\n${cuerpo}`;
}

function raw(m: MensajeGmail): string {
  return Buffer.from(construirMime(m), 'utf8').toString('base64url');
}

// ── Envío ─────────────────────────────────────────────────────────────────────

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

/** Un correo desde el buzón indicado. Lanza si falla (quien llama decide si romper el flujo). */
export async function enviarGmail(buzon: string, mensaje: MensajeGmail): Promise<void> {
  const gmail = getGmail(buzon);
  await conReintentos(() => gmail.users.messages.send({ userId: 'me', requestBody: { raw: raw(mensaje) } }));
}

/**
 * Masivo: la API de Gmail va de uno en uno, así que se envía con una concurrencia pequeña
 * (por defecto 3, ajustable con `GMAIL_CONCURRENCIA`) para no chocar con la cuota por segundo.
 * Los errores son parciales: se cuentan y se sigue, como en el batch de Resend.
 */
export async function enviarLoteGmail(
  buzon: string,
  mensajes: MensajeGmail[],
): Promise<{ sent: number; errors: number }> {
  const concurrencia = Math.max(1, Math.min(10, Number(process.env.GMAIL_CONCURRENCIA ?? 3)));
  let siguiente = 0;
  let sent = 0;
  let errors = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < mensajes.length) {
      const mensaje = mensajes[siguiente++];
      try {
        await enviarGmail(buzon, mensaje);
        sent++;
      } catch (e) {
        errors++;
        console.error('Gmail error:', e instanceof Error ? e.message : e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrencia, mensajes.length) }, trabajador));
  return { sent, errors };
}
