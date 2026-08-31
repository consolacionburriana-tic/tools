import { emailConfigurado, enviar } from '@/lib/email';
import { euros, fechaLimiteLabel } from '@/lib/licencias';
import type { Recipient } from '@/lib/licencias-server';
import { applyVars, sendChunks, wrapHtml } from '@/lib/correos';

export interface OrderEmailData {
  alumno: string;
  curso: string;
  email: string;
  items: { asignatura: string; precio: string }[];
  total: number;
  editUrl: string;
  deadline?: string | null;
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
  if (!emailConfigurado()) return 'skipped';
  try {
    await fn();
    return 'sent';
  } catch (e) {
    console.error('Error enviando correo de licencias:', e instanceof Error ? e.message : e);
    return 'error';
  }
}

function receiptRows(items: { asignatura: string; precio: string }[]): string {
  if (items.length === 0) {
    return `<p style="margin:0;font-size:13.5px;color:#9ca3af;font-style:italic;">(sin licencias de pago)</p>`;
  }
  return items
    .map(
      (i) => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:13.5px;color:#374151;">
        <span>${i.asignatura}</span>
        <span style="font-weight:600;color:#111827;white-space:nowrap;">${euros(parseFloat(i.precio || '0'))}</span>
      </div>`,
    )
    .join('');
}

export async function sendFamilyConfirmation(d: OrderEmailData) {
  const deadlineBox = d.deadline
    ? `
      <div style="margin:0 32px 20px;background:#fffbeb;border-radius:10px;padding:12px 16px;">
        <p style="margin:0;font-size:12.5px;color:#92400e;line-height:1.5;">
          ⏰ Puedes modificar este pedido hasta el <strong>${fechaLimiteLabel(d.deadline)}</strong>. Pasada esa fecha no se admitirán cambios.
        </p>
      </div>`
    : '';

  return safeSend(() =>
    enviar('licencias', {
      to: d.email,
      subject: `Confirmación · licencias digitales de ${d.alumno}`,
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#99f6e4;opacity:.9;">Colegio Consolación · Burriana</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Pedido de licencias digitales</h1>
    </div>

    <div style="padding:24px 32px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Hemos registrado la solicitud para</p>
      <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827;">${d.alumno}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#0d9488;font-weight:600;">${d.curso}</p>
    </div>

    <div style="margin:20px 32px;border:1px dashed #d4d4d8;border-radius:12px;padding:16px 18px;">
      ${receiptRows(d.items)}
      <div style="border-top:1px solid #e4e4e7;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;">
        <span style="font-size:14px;font-weight:700;color:#111827;">Total</span>
        <span style="font-size:16px;font-weight:700;color:#0d9488;">${euros(d.total)}</span>
      </div>
    </div>

    <div style="margin:0 32px 20px;background:#f0fdfa;border-radius:10px;padding:12px 16px;">
      <p style="margin:0;font-size:12.5px;color:#134e4a;line-height:1.5;">
        💳 El cobro de este importe se realizará más adelante mediante <strong>recibo bancario</strong>, como es habitual desde el colegio. No es necesario hacer ningún pago ahora.
      </p>
    </div>

    ${deadlineBox}

    <div style="margin:0 32px 28px;text-align:center;">
      <a href="${d.editUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 22px;border-radius:999px;">Ver o modificar el pedido</a>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Un saludo,<br><strong>Colegio Consolación · Burriana</strong></p>
    </div>

  </div>
</body>
</html>`,
    }),
  );
}

export async function notifyGestores(d: OrderEmailData) {
  return safeSend(() =>
    enviar('licencias', {
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
// Primitivos (applyVars, escapado, enlaces clicables, batch de 100) en src/lib/correos.ts,
// compartidos con Salidas (src/lib/salidas-email.ts).

// Variables del envío clásico (uno por alumno).
function varsDeAlumno(r: Recipient): Record<string, string> {
  return { nombre: r.nombre, apellidos: r.apellidos, curso: r.curso };
}

export async function sendBlastTest(email: string, subject: string, body: string, sample: Recipient) {
  const vars = varsDeAlumno(sample);
  return safeSend(() =>
    enviar('licencias', {
      to: email,
      subject: '[PRUEBA] ' + applyVars(subject, vars),
      html: wrapHtml(applyVars(body, vars)),
    }),
  );
}

export async function sendBlast(recipients: Recipient[], subject: string, body: string) {
  return sendChunks(
    recipients.map((r) => ({ email: r.email, vars: varsDeAlumno(r) })),
    subject,
    body,
    { perfil: 'licencias' },
  );
}

// ── Correos a familias con magic link ─────────────────────────────────────────
export const CTA_LICENCIAS = 'Entrar y pedir las licencias';

export interface FamilyBlastItem {
  email: string;
  vars: Record<string, string>;
  enlace: string;
}

/** Envío masivo a familias: cada correo lleva su propio enlace de acceso (botón + `{enlace}`). */
export async function sendFamilyBlast(items: FamilyBlastItem[], subject: string, body: string) {
  return sendChunks(
    items.map((i) => ({ email: i.email, vars: i.vars, cta: { url: i.enlace, label: CTA_LICENCIAS } })),
    subject,
    body,
    { perfil: 'licencias' },
  );
}

/** Prueba de un correo de familia (con su enlace real) a la dirección que diga el gestor. */
export async function sendFamilyBlastTest(email: string, subject: string, body: string, sample: FamilyBlastItem) {
  return safeSend(() =>
    enviar('licencias', {
      to: email,
      subject: '[PRUEBA] ' + applyVars(subject, sample.vars),
      html: wrapHtml(applyVars(body, sample.vars), { url: sample.enlace, label: CTA_LICENCIAS }),
    }),
  );
}
