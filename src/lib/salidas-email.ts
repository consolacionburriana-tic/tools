// Emails del módulo de Salidas: alertas a los responsables cuando entra un
// justificante, minimalistas y con un footer distinto cada vez para hacer más
// llevadera la burocracia. Usa el cliente único de src/lib/email.ts.
import { getResend, FROM } from '@/lib/email';
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
  if (!process.env.RESEND_API_KEY || input.destinatarios.length === 0) return;
  const { trip, stats } = input;
  const entregables = Math.max(0, stats.objetivo - stats.noVan);
  const pct = entregables > 0 ? Math.round((stats.entregados / entregables) * 100) : 0;

  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#18181b">
    <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;margin:0 0 4px">Salidas y pagos · Tools Consolación</p>
    <h2 style="margin:0 0 16px;font-size:20px">📎 Justificante nuevo</h2>
    <div style="border:1px solid #e4e4e7;border-radius:16px;padding:16px 18px">
      <p style="margin:0 0 2px;font-size:15px"><strong>${input.alumnoLabel}</strong> acaba de entregar su justificante.</p>
      <p style="margin:0;color:#71717a;font-size:14px">${trip.nombre} · ${fechaBonita(trip.fecha)}${trip.importe ? ` · ${trip.importe} €` : ''}</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-radius:16px;padding:16px 18px;margin-top:12px">
      <p style="margin:0 0 6px;font-size:13px;color:#71717a">Cómo va la cosa</p>
      ${barra(pct)}
      <p style="margin:6px 0 0;font-size:14px">
        <strong>${stats.entregados}</strong> de <strong>${entregables}</strong> justificantes entregados (${pct} %)
      </p>
      <p style="margin:4px 0 0;font-size:13px;color:#71717a">
        ${stats.pendientes} pendientes · ${stats.validados} ya validados · ${stats.noVan} no van${stats.manuales > 0 ? ` · <strong style="color:#b45309">⚠️ ${stats.manuales} entrada(s) manual(es) por enlazar</strong>` : ''}
      </p>
    </div>
    <p style="margin:16px 4px 0;font-size:13px;color:#71717a">
      Revísalo y valídalo en el panel: <a href="https://tools.consolacionburriana.com/gestion/salidas/${trip.id}" style="color:#2563eb">gestión de la salida</a>.
    </p>
    <p style="margin:24px 4px 0;padding-top:12px;border-top:1px solid #f4f4f5;font-size:12px;color:#a1a1aa">
      ${footerAleatorio()}
    </p>
  </div>`;

  const resend = getResend();
  await resend.emails.send({
    from: FROM,
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
  if (!process.env.RESEND_API_KEY || !input.email) return;
  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#18181b">
    <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;margin:0 0 4px">Colegio Consolación Burriana</p>
    <h2 style="margin:0 0 12px;font-size:20px">✅ Justificante recibido</h2>
    <p style="font-size:15px;margin:0 0 8px">
      Hemos recibido el justificante de pago de <strong>${input.maskedName}</strong> para
      <strong>${input.trip.nombre}</strong> (${fechaBonita(input.trip.fecha)}).
    </p>
    <p style="font-size:14px;color:#71717a;margin:0">
      El equipo responsable lo revisará. Si hubiera cualquier problema, nos pondremos en contacto contigo.
      No hace falta que hagas nada más. ¡Gracias!
    </p>
  </div>`;
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: [input.email],
    subject: `✅ Justificante recibido · ${input.trip.nombre}`,
    html,
  });
}

/** Recordatorio de pago: un email por familia pendiente, con variables sustituidas. */
export async function sendRecordatorioPago(input: {
  trip: SalTrip;
  subject: string;
  body: string;
  familias: { nombre: string; emails: string[] }[];
}): Promise<{ enviados: number; errores: number }> {
  if (!process.env.RESEND_API_KEY) return { enviados: 0, errores: 0 };
  const resend = getResend();
  let enviados = 0;
  let errores = 0;
  const rellenar = (t: string, nombre: string) =>
    t
      .replace(/\{alumno\}/gi, nombre)
      .replace(/\{salida\}/gi, input.trip.nombre)
      .replace(/\{fecha\}/gi, fechaBonita(input.trip.fecha))
      .replace(/\{importe\}/gi, input.trip.importe ? `${input.trip.importe} €` : '');
  for (const f of input.familias) {
    try {
      await resend.emails.send({
        from: FROM,
        to: f.emails,
        subject: rellenar(input.subject, f.nombre),
        html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#18181b;white-space:pre-wrap;font-size:15px">${rellenar(
          input.body,
          f.nombre,
        )}</div>`,
      });
      enviados++;
    } catch {
      errores++;
    }
  }
  return { enviados, errores };
}
