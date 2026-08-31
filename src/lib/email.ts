// Punto de entrada ÚNICO del correo del sitio. Dos cosas viven aquí:
//
//  1. **Perfiles de remitente** (`PerfilCorreo`): cada módulo manda desde su identidad, con su
//     `Reply-To`. Licencias sale y contesta a `licencias@…` (buzón real del cole, centralizado);
//     el resto sale de un buzón genérico y el `Reply-To` lo pone quien envía (el tutor de la
//     salida, el gestor de la evaluación…), que es a quien hay que contestar de verdad.
//  2. **Transportes**: `gmail` (API de Google Workspace, `src/lib/email-gmail.ts`) o `resend`.
//     Mismo interfaz para los dos; se elige por env sin tocar código, global o por módulo.
//
// Todo es configurable por entorno (ver tabla en docs/04-convenciones-tecnicas.md):
//   EMAIL_TRANSPORTE=gmail|resend            · transporte por defecto de todo el sitio
//   EMAIL_TRANSPORTE_<PERFIL>=gmail|resend   · excepción para un módulo
//   EMAIL_FROM_<PERFIL>="Nombre <buzon@dominio>"
//   EMAIL_REPLYTO_<PERFIL>=buzon@dominio
//   EMAIL_BUZON_<PERFIL>=buzon@dominio       · solo Gmail: buzón real a suplantar si el `From`
//                                              es un alias o un grupo (si no, se usa el `From`)
// Los módulos NO leen estas variables ni instancian clientes: usan `enviar` / `enviarLote`.
import { Resend } from 'resend';
import { enviarGmail, enviarLoteGmail, direccion, gmailConfigurado, type MensajeGmail } from '@/lib/email-gmail';

export type Transporte = 'gmail' | 'resend';
export type PerfilCorreo = 'licencias' | 'salidas' | 'abc' | 'evaluaciones' | 'general';

export interface Remitente {
  nombre: string;
  email: string;
  /** Buzón real que se suplanta en Gmail (por defecto, el propio `email`). */
  buzon: string;
  replyTo?: string;
  transporte: Transporte;
}

export interface Mensaje {
  to: string | string[];
  subject: string;
  html: string;
  /** Pisa el `Reply-To` del perfil (p. ej. el tutor que manda el recordatorio de la salida). */
  replyTo?: string;
}

const DOMINIO = 'consolacionburriana.com';

// Identidades por defecto. Cambiarlas en producción no requiere deploy: EMAIL_FROM_<PERFIL>.
const DEFECTOS: Record<PerfilCorreo, { nombre: string; email: string; replyTo?: string }> = {
  licencias: {
    nombre: 'Licencias · Colegio Consolación',
    email: `licencias@${DOMINIO}`,
    replyTo: `licencias@${DOMINIO}`, // centralizado: todo lo de licencias vuelve a ese buzón
  },
  salidas: { nombre: 'Salidas · Colegio Consolación', email: `no-responder@${DOMINIO}` },
  abc: { nombre: 'Registro ABC · Colegio Consolación', email: `no-responder@${DOMINIO}` },
  evaluaciones: { nombre: 'Evaluaciones · Colegio Consolación', email: `no-responder@${DOMINIO}` },
  general: { nombre: 'Colegio Consolación', email: `no-responder@${DOMINIO}` },
};

/** Parsea `"Nombre <buzon@dominio>"` (o un correo suelto) en sus dos partes. */
export function parseRemitente(valor: string): { nombre: string; email: string } | null {
  const conNombre = valor.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (conNombre) return { nombre: conNombre[1].replace(/^["']|["']$/g, ''), email: conNombre[2] };
  const suelto = valor.trim();
  return /^[^<>\s]+@[^<>\s]+$/.test(suelto) ? { nombre: '', email: suelto } : null;
}

function env(clave: string, perfil: PerfilCorreo): string | undefined {
  const valor = process.env[`${clave}_${perfil.toUpperCase()}`]?.trim();
  return valor ? valor : undefined;
}

function transportePorDefecto(): Transporte {
  const global = process.env.EMAIL_TRANSPORTE?.trim().toLowerCase();
  if (global === 'gmail' || global === 'resend') return global;
  return gmailConfigurado() ? 'gmail' : 'resend'; // sin config explícita, Workspace manda
}

export function remitente(perfil: PerfilCorreo): Remitente {
  const defecto = DEFECTOS[perfil];
  const crudo =
    env('EMAIL_FROM', perfil) ??
    (perfil === 'general' ? process.env.RESEND_FROM?.trim() : undefined) ??
    `${defecto.nombre} <${defecto.email}>`;
  const parseado = parseRemitente(crudo) ?? { nombre: defecto.nombre, email: defecto.email };
  const transporteModulo = env('EMAIL_TRANSPORTE', perfil)?.toLowerCase();
  return {
    nombre: parseado.nombre || defecto.nombre,
    email: parseado.email,
    buzon: env('EMAIL_BUZON', perfil) ?? parseado.email,
    replyTo: env('EMAIL_REPLYTO', perfil) ?? defecto.replyTo,
    transporte:
      transporteModulo === 'gmail' || transporteModulo === 'resend' ? transporteModulo : transportePorDefecto(),
  };
}

/** ¿Hay algún transporte configurado? Los módulos lo usan para no romper el flujo sin correo. */
export function emailConfigurado(): boolean {
  return gmailConfigurado() || Boolean(process.env.RESEND_API_KEY);
}

// ── Transporte Resend ─────────────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function from(r: Remitente): string {
  return r.nombre ? `${r.nombre} <${r.email}>` : r.email;
}

function aLista(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Un correo (transaccional). Lanza si falla: quien llama decide si eso rompe su flujo. */
export async function enviar(perfil: PerfilCorreo, mensaje: Mensaje): Promise<void> {
  const r = remitente(perfil);
  const replyTo = mensaje.replyTo ?? r.replyTo;
  if (r.transporte === 'gmail') {
    await enviarGmail(r.buzon, {
      from: direccion(r.nombre, r.email),
      to: aLista(mensaje.to),
      subject: mensaje.subject,
      html: mensaje.html,
      replyTo,
    });
    return;
  }
  const { error } = await getResend().emails.send({
    from: from(r),
    to: aLista(mensaje.to),
    replyTo,
    subject: mensaje.subject,
    html: mensaje.html,
  });
  if (error) throw new Error(error.message);
}

/**
 * Masivo: un mensaje por destinatario (nadie ve el correo de nadie). Resend lo hace en lotes
 * de 100 por llamada; Gmail va de uno en uno con concurrencia limitada — mismo contrato,
 * `{ sent, errors }`, con errores parciales contados y sin abortar el resto.
 */
export async function enviarLote(
  perfil: PerfilCorreo,
  mensajes: Mensaje[],
): Promise<{ sent: number; errors: number }> {
  if (mensajes.length === 0) return { sent: 0, errors: 0 };
  const r = remitente(perfil);
  if (r.transporte === 'gmail') {
    const payload: MensajeGmail[] = mensajes.map((m) => ({
      from: direccion(r.nombre, r.email),
      to: aLista(m.to),
      subject: m.subject,
      html: m.html,
      replyTo: m.replyTo ?? r.replyTo,
    }));
    return enviarLoteGmail(r.buzon, payload);
  }
  const resend = getResend();
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < mensajes.length; i += 100) {
    const chunk = mensajes.slice(i, i + 100);
    try {
      await resend.batch.send(
        chunk.map((m) => ({
          from: from(r),
          to: aLista(m.to),
          replyTo: m.replyTo ?? r.replyTo,
          subject: m.subject,
          html: m.html,
        })),
      );
      sent += chunk.length;
    } catch (e) {
      console.error('Resend batch error:', e instanceof Error ? e.message : e);
      errors += chunk.length;
    }
  }
  return { sent, errors };
}
