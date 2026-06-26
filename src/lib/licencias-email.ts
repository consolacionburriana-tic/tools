import { FROM, getResend } from '@/lib/email';
import { euros } from '@/lib/licencias';

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
