import { FROM, getResend } from '@/lib/email';
import { euros } from '@/lib/licencias';
import type { Recipient } from '@/lib/licencias-server';

export interface OrderEmailData {
  alumno: string;
  curso: string;
  email: string;
  items: { asignatura: string; precio: string }[];
  total: number;
  editUrl: string;
}

function gestores(): string[] {
  return (process.env.LICENCIAS_GESTORES ?? 'licencias@consolacionburriana.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function itemsHtml(items: { asignatura: string; precio: string }[]): string {
  if (items.length === 0) return '<li>(sin licencias de pago)</li>';
  return items
    .map((i) => `<li>${i.asignatura} — ${euros(parseFloat(i.precio || '0'))}</li>`)
    .join('');
}

// Devuelve 'sent' | 'skipped' | 'error' sin romper el flujo del pedido
async function safeSend(fn: () => Promise<unknown>): Promise<'sent' | 'skipped' | 'error'> {
  if (!process.env.RESEND_API_KEY) return 'skipped';
  try {
    await fn();
    return 'sent';
  } catch (e) {
    console.error('Resend error:', e);
    return 'error';
  }
}

export async function sendFamilyConfirmation(d: OrderEmailData) {
  return safeSend(() =>
    getResend().emails.send({
      from: FROM,
      to: d.email,
      subject: `Confirmación · licencias digitales de ${d.alumno}`,
      html: `
        <p>Hola,</p>
        <p>Hemos registrado la solicitud de licencias digitales para <strong>${d.alumno}</strong> (${d.curso}).</p>
        <ul>${itemsHtml(d.items)}</ul>
        <p><strong>Total: ${euros(d.total)}</strong></p>
        <p>Si necesitas modificar el pedido, usa este enlace antes de la fecha límite:<br>
        <a href="${d.editUrl}">${d.editUrl}</a></p>
        <p>Un saludo,<br>Colegio Consolación · Burriana</p>
      `,
    }),
  );
}

export async function notifyGestores(d: OrderEmailData) {
  return safeSend(() =>
    getResend().emails.send({
      from: FROM,
      to: gestores(),
      subject: `Nuevo pedido de licencias · ${d.alumno} (${d.curso})`,
      html: `
        <p>Nuevo pedido registrado.</p>
        <p><strong>${d.alumno}</strong> · ${d.curso} · ${d.email}</p>
        <ul>${itemsHtml(d.items)}</ul>
        <p><strong>Total: ${euros(d.total)}</strong></p>
      `,
    }),
  );
}

// ── Correos masivos (panel) ───────────────────────────────────────────────────
export function applyVars(text: string, r: { nombre: string; apellidos: string; curso: string }): string {
  return (text ?? '')
    .replace(/\{nombre\}/gi, r.nombre)
    .replace(/\{apellidos\}/gi, r.apellidos)
    .replace(/\{curso\}/gi, r.curso);
}

function wrapHtml(bodyText: string): string {
  const html = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6">${html}<br><br>—<br>Colegio Consolación · Burriana</div>`;
}

export async function sendBlastTest(email: string, subject: string, body: string, sample: Recipient) {
  return safeSend(() =>
    getResend().emails.send({
      from: FROM,
      to: email,
      subject: '[PRUEBA] ' + applyVars(subject, sample),
      html: wrapHtml(applyVars(body, sample)),
    }),
  );
}

export async function sendBlast(
  recipients: Recipient[],
  subject: string,
  body: string,
): Promise<{ sent: number; errors: number; skipped: boolean }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, errors: 0, skipped: true };
  const resend = getResend();
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const payload = chunk.map((r) => ({
      from: FROM,
      to: r.email,
      subject: applyVars(subject, r),
      html: wrapHtml(applyVars(body, r)),
    }));
    try {
      await resend.batch.send(payload);
      sent += chunk.length;
    } catch (e) {
      console.error('sendBlast chunk error:', e);
      errors += chunk.length;
    }
  }
  return { sent, errors, skipped: false };
}
