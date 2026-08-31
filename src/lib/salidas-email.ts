// Emails del módulo de Salidas: alertas a los responsables cuando entra un
// justificante, minimalistas y con un footer distinto cada vez para hacer más
// llevadera la burocracia. Sale del perfil 'salidas' de src/lib/email.ts (buzón genérico, con
// el Reply-To apuntando a quien envía cuando lo hay: el tutor del recordatorio).
import { emailConfigurado, enviar } from '@/lib/email';
import { appBaseUrl } from '@/lib/constants';
import { sendChunks, type BlastItem } from '@/lib/correos';
import type { SalTrip } from '@/db/schema';
import type { TripStats } from '@/lib/salidas-server';

// Frases y datos curiosos para el footer (rotan con cada email).
const FOOTERS = [
  'Dato curioso: los pulpos tienen tres corazones. Tú con uno ya vas sobrado gestionando esta salida.',
  'Un autobús escolar recorre de media 20.000 km al año. Este email solo ha recorrido unos 900, tranquilidad.',
  'Las nutrias se dan la mano mientras duermen para no separarse. Como tu clase en el museo, ojalá.',
  'Dato curioso: la Torre Eiffel crece hasta 15 cm en verano por el calor. Los justificantes, en cambio, no crecen solos.',
  'El 87 % de los profes revisan el correo en el pasillo. Si es tu caso: ánimo con las escaleras.',
  'Los flamencos solo son rosas por lo que comen. Tú serás legendario/a por lo que organizas.',
  'Un caracol puede dormir tres años seguidos. Algunas familias entregan el justificante en un plazo similar.',
  'Dato curioso: en Suiza es ilegal tener una sola cobaya (se aburren). Por eso las salidas se organizan en equipo.',
  'La miel no caduca nunca. Este report, en cambio, se actualiza con cada justificante.',
  'Los cohetes usan menos potencia de cálculo que tu móvil. Y aún así, organizar una salida sigue siendo más difícil.',
  'Las vacas tienen mejores amigas y se estresan si las separan. Igual que los alumnos al hacer los grupos del bus.',
  'Dato curioso: un rayo es 5 veces más caliente que la superficie del sol. Casi tanto como el grupo de WhatsApp de familias.',
  'Los pingüinos se declaran con una piedrecita. Las familias, con un justificante de pago.',
  'El sonido del bosque reduce el cortisol un 21 %. La excursión ya casi es terapia, díselo a dirección.',
];

function footerAleatorio(): string {
  return FOOTERS[Math.floor(Math.random() * FOOTERS.length)];
}

function fechaBonita(fecha: string | null): string {
  if (!fecha) return 'sin fecha';
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function barra(pct: number): string {
  return `
  <div style="background:#e4e4e7;border-radius:999px;height:8px;overflow:hidden;margin:6px 0 2px">
    <div style="background:#2563eb;height:8px;width:${Math.min(100, Math.max(0, pct))}%"></div>
  </div>`;
}

/**
 * Alerta a los responsables: ha entrado un justificante nuevo + mini-report de cómo
 * va la salida (cuántos quedan pendientes, etc.).
 */
export async function sendJustificanteAlert(input: {
  trip: SalTrip;
  alumnoLabel: string; // "Nombre Apellidos (2ESO B)" — los responsables son claustro
  stats: TripStats;
  destinatarios: string[];
}): Promise<void> {
  if (!emailConfigurado() || input.destinatarios.length === 0) return;
  const { trip, stats } = input;
  const entregables = Math.max(0, stats.objetivo - stats.noVan);
  const pct = entregables > 0 ? Math.round((stats.entregados / entregables) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#2563eb,#2460df);padding:24px 32px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#dbeafe;opacity:.9;">Consolación Burriana · Salidas y pagos</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;color:#ffffff;">📎 Justificante nuevo</h1>
    </div>

    <div style="padding:24px 32px;">
      <div style="border:1px solid #e4e4e7;border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 2px;font-size:15px;color:#18181b;"><strong>${input.alumnoLabel}</strong> acaba de entregar su justificante.</p>
        <p style="margin:0;color:#71717a;font-size:14px;">${trip.nombre} · ${fechaBonita(trip.fecha)}${trip.importe ? ` · ${trip.importe} €` : ''}</p>
      </div>
      <div style="border:1px solid #e4e4e7;border-radius:12px;padding:16px 18px;margin-top:12px;">
        <p style="margin:0 0 6px;font-size:13px;color:#71717a;">Cómo va la cosa</p>
        ${barra(pct)}
        <p style="margin:6px 0 0;font-size:14px;color:#18181b;">
          <strong>${stats.entregados}</strong> de <strong>${entregables}</strong> justificantes entregados (${pct} %)
        </p>
        <p style="margin:4px 0 0;font-size:13px;color:#71717a;">
          ${stats.pendientes} pendientes · ${stats.validados} ya validados · ${stats.noVan} no van${stats.manuales > 0 ? ` · <strong style="color:#b45309">⚠️ ${stats.manuales} entrada(s) manual(es) por enlazar</strong>` : ''}
        </p>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">
        Revísalo y valídalo en el panel: <a href="${appBaseUrl()}/gestion/salidas/${trip.id}" style="color:#2563eb;">gestión de la salida</a>.
      </p>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">${footerAleatorio()}</p>
    </div>

  </div>
</body>
</html>`;

  await enviar('salidas', {
    to: input.destinatarios,
    subject: `📎 ${input.alumnoLabel.split(' (')[0]} ha entregado · ${trip.nombre}`,
    html,
  });
}

/** Confirmación a la familia de que el justificante se ha recibido. */
export async function sendJustificanteConfirmacion(input: {
  trip: SalTrip;
  maskedName: string;
  email: string;
}): Promise<void> {
  if (!emailConfigurado() || !input.email) return;
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#2563eb,#2460df);padding:28px 32px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#dbeafe;opacity:.9;">Consolación Burriana</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">✅ Justificante recibido</h1>
    </div>

    <div style="padding:24px 32px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Hemos recibido el justificante de pago de</p>
      <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827;">${input.maskedName}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#2563eb;font-weight:600;">${input.trip.nombre}</p>
    </div>

    <div style="margin:20px 32px;border:1px dashed #d4d4d8;border-radius:12px;padding:16px 18px;">
      <div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:13.5px;color:#374151;">
        <span>Fecha</span>
        <span style="font-weight:600;color:#111827;white-space:nowrap;">${fechaBonita(input.trip.fecha)}</span>
      </div>
      ${
        input.trip.importe
          ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:13.5px;color:#374151;">
        <span>Importe</span>
        <span style="font-weight:600;color:#111827;white-space:nowrap;">${input.trip.importe} €</span>
      </div>`
          : ''
      }
    </div>

    <div style="margin:0 32px 28px;">
      <div style="display:flex;gap:10px;">
        <span style="font-size:15px;line-height:1.5;">✅</span>
        <div>
          <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">¿Tengo que hacer algo más?</p>
          <p style="margin:3px 0 0;font-size:12.5px;color:#6b7280;line-height:1.5;">
            Nada más: el equipo responsable lo revisará. Si hubiera cualquier problema, nos pondremos en contacto contigo.
          </p>
        </div>
      </div>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;"><strong>Consolación Burriana</strong></p>
    </div>

  </div>
</body>
</html>`;
  await enviar('salidas', {
    to: [input.email],
    subject: `✅ Justificante recibido · ${input.trip.nombre}`,
    html,
  });
}

/**
 * Recordatorio de pago: un email por tutor (no uno por familia) con variables sustituidas,
 * batch de 100 y enlaces auto-clicables — mismos primitivos que el envío masivo de Licencias
 * (src/lib/correos.ts). `enlace` es el magic link personal de la familia (opcional — no todas
 * tienen token). Antes era un único envío con `to` a todos los tutores de golpe (así cada
 * tutor veía el correo del otro en el `to`); ahora cada tutor recibe su propia copia.
 */
export async function sendRecordatorioPago(input: {
  trip: SalTrip;
  subject: string;
  body: string;
  familias: { nombre: string; emails: string[]; enlace?: string }[];
  /** Correo de quien lo manda: las familias contestan al tutor, no a un buzón que nadie lee. */
  replyTo?: string;
}): Promise<{ enviados: number; errores: number }> {
  const items: BlastItem[] = input.familias.flatMap((f) =>
    f.emails.map((email) => ({
      email,
      vars: {
        alumno: f.nombre,
        salida: input.trip.nombre,
        fecha: fechaBonita(input.trip.fecha),
        importe: input.trip.importe ? `${input.trip.importe} €` : '',
        enlace: f.enlace ?? '',
      },
    })),
  );
  const { sent, errors } = await sendChunks(items, input.subject, input.body, {
    perfil: 'salidas',
    replyTo: input.replyTo,
  });
  return { enviados: sent, errores: errors };
}
