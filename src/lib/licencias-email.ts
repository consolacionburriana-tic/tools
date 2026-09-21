import { emailConfigurado, enviar } from '@/lib/email';
import { euros, fechaLimiteLabel, procesadoAntesDeCurso } from '@/lib/licencias';
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
  academicYear: string;
}

function gestores(): string[] {
  return (process.env.LICENCIAS_GESTORES ?? 'licencias@consolacionburriana.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

// OJO: en correo NO se puede usar flexbox (Gmail y otros lo ignoran y los importes salían
// pegados al texto: "Total51 €"). El concepto/importe va SIEMPRE en tabla de dos celdas,
// con la de la derecha alineada a la derecha, que es lo único que respetan todos.
function receiptRows(items: { asignatura: string; precio: string }[]): string {
  if (items.length === 0) {
    return `
      <tr><td colspan="2" style="font-size:13.5px;color:#9ca3af;font-style:italic;">(sin licencias de pago)</td></tr>`;
  }
  return items
    .map(
      (i) => `
      <tr>
        <td style="padding:5px 12px 5px 0;font-size:13.5px;color:#374151;">${i.asignatura}</td>
        <td align="right" style="padding:5px 0;font-size:13.5px;font-weight:600;color:#111827;white-space:nowrap;">${euros(parseFloat(i.precio || '0'))}</td>
      </tr>`,
    )
    .join('');
}

/**
 * Bloque "recibo": una fila por licencia y el total, en tabla (ver nota de arriba).
 * Exportado solo para poder testear que no vuelve a colarse un layout que los clientes
 * de correo ignoren (el bug de "Total51 €").
 */
export function receiptTable(items: { asignatura: string; precio: string }[], total: number): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        ${receiptRows(items)}
        <tr>
          <td style="border-top:1px solid #e4e4e7;padding:10px 12px 0 0;font-size:14px;font-weight:700;color:#111827;">Total</td>
          <td align="right" style="border-top:1px solid #e4e4e7;padding:10px 0 0;font-size:16px;font-weight:700;color:#0d9488;white-space:nowrap;">${euros(total)}</td>
        </tr>
      </table>`;
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

  const llegadaTexto = procesadoAntesDeCurso(d.academicYear)
    ? 'Los pedidos de licencias se procesan con antelación al inicio de curso y llegarán por correo electrónico, directamente al iPad del alumno durante los primeros días de clase.'
    : 'Los pedidos de licencias que llegan una vez se ha iniciado el curso se procesan en un máximo de 15-20 días y llegarán por correo electrónico, directamente al iPad del alumno en cuanto estén disponibles.';

  return safeSend(() =>
    enviar('licencias', {
      to: d.email,
      subject: `Confirmación · licencias digitales de ${d.alumno}`,
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#0d9488,#0c8f83);padding:28px 32px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#99f6e4;opacity:.9;">Consolación Burriana</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Pedido de licencias digitales</h1>
    </div>

    <div style="padding:24px 32px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Hemos registrado la solicitud para</p>
      <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827;">${d.alumno}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#0d9488;font-weight:600;">${d.curso}</p>
    </div>

    <div style="margin:20px 32px;border:1px dashed #d4d4d8;border-radius:12px;padding:16px 18px;">
      ${receiptTable(d.items, d.total)}
    </div>

    <div style="margin:0 32px 20px;background:#f0fdfa;border-radius:10px;padding:12px 16px;">
      <p style="margin:0;font-size:12.5px;color:#134e4a;line-height:1.5;">
        💳 El cobro de este importe se realizará mediante <strong>recibo bancario</strong> al final del primer trimestre, como es habitual desde el colegio. No es necesario hacer ningún pago ahora.
      </p>
    </div>

    ${deadlineBox}

    <div style="margin:0 32px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          <td width="26" valign="top" style="padding:0 0 14px;font-size:15px;line-height:1.5;">📦</td>
          <td valign="top" style="padding:0 0 14px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">¿Cuándo llegarán?</p>
            <p style="margin:3px 0 0;font-size:12.5px;color:#6b7280;line-height:1.5;">${llegadaTexto}</p>
          </td>
        </tr>
        <tr>
          <td width="26" valign="top" style="font-size:15px;line-height:1.5;">✅</td>
          <td valign="top">
            <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">¿Tengo que hacer algo más?</p>
            <p style="margin:3px 0 0;font-size:12.5px;color:#6b7280;line-height:1.5;">
              Nada más: hemos recibido tu pedido y lo hemos anotado. Las licencias llegarán directamente al iPad del alumno en los plazos previstos.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin:0 32px 28px;text-align:center;">
      <a href="${d.editUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 22px;border-radius:999px;">Ver o modificar el pedido</a>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;"><strong>Consolación Burriana</strong></p>
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
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#0d9488,#0c8f83);padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#99f6e4;opacity:.9;">Consolación Burriana · Licencias</p>
      <h1 style="margin:6px 0 0;font-size:18px;font-weight:700;color:#ffffff;">🧾 Nuevo pedido</h1>
    </div>

    <div style="padding:24px 32px 0;">
      <p style="margin:0;font-size:17px;font-weight:700;color:#111827;">${d.alumno}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#0d9488;font-weight:600;">${d.curso} · ${d.email || 'sin correo'}</p>
    </div>

    <div style="margin:18px 32px 28px;border:1px dashed #d4d4d8;border-radius:12px;padding:16px 18px;">
      ${receiptTable(d.items, d.total)}
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:14px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Aviso automático</p>
    </div>

  </div>
</body>
</html>`,
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
      html: wrapHtml(applyVars(body, vars), undefined, 'licencias'),
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
      html: wrapHtml(applyVars(body, sample.vars), { url: sample.enlace, label: CTA_LICENCIAS }, 'licencias'),
    }),
  );
}

// ─── Correo de entrega de licencias (Fase 5) ──────────────────────────────────
//
// Sustituye al FormMule sobre las plantillas ENVIAR. El cuerpo lo escribe el gestor en
// `/gestion/licencias/envios` con variables; aquí solo se le pone la vitrina.
//
// Dos cosas del render que no son caprichos:
//  · `{codigo}` no se sustituye por texto, sino por una CAJA con el código en grande y
//    monoespaciado. Es el único dato que el alumno tiene que copiar a mano, y en medio de un
//    párrafo se pierde (o se copia con un espacio de más y la plataforma dice que no existe).
//  · El cuerpo se escapa, pero se le devuelven las etiquetas `<b>/<i>/<u>/<br>`: el texto de
//    siempre viene de FormMule con `<b>` escrito a mano y hay que poder pegarlo tal cual.

// Las variables viven en `licencias-envios.ts` (puro) para que la pantalla las pueda pintar
// sin arrastrar Resend ni googleapis al navegador.
export { VARIABLES_LICENCIA } from '@/lib/licencias-envios';

/** Marca interna donde va la caja del código; no se puede teclear desde el panel. */
const HUECO_CODIGO = '\u0000CODIGO\u0000';

const INLINE_PERMITIDAS = ['b', 'strong', 'i', 'em', 'u'];

/**
 * Escapa el cuerpo y devuelve solo las etiquetas de énfasis y los saltos. Nada de atributos:
 * `<b onclick=…>` se queda escapado, que es justo lo que se quiere.
 */
export function cuerpoSeguro(texto: string): string {
  const escapado = (texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const conTags = INLINE_PERMITIDAS.reduce(
    (acc, tag) =>
      acc.replace(new RegExp(`&lt;(/?)${tag}&gt;`, 'gi'), (_m, cierre: string) => `<${cierre}${tag}>`),
    escapado,
  ).replace(/&lt;br\s*\/?&gt;/gi, '<br>');
  // `**negrita**` también, por si alguien escribe como en WhatsApp.
  return conTags.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

export interface LicenciaCorreo {
  asignatura: string;
  libro: string;
  plataforma: string;
  codigo: string;
}

/** Una caja por código. Con varias licencias fusionadas, cada una dice de qué asignatura es. */
export function cajaCodigos(licencias: LicenciaCorreo[]): string {
  const varias = licencias.length > 1;
  return licencias
    .map(
      (l) => `
      <div style="margin:18px 0;border:1px solid #99f6e4;background:#f0fdfa;border-radius:12px;padding:14px 16px;text-align:center;">
        ${varias ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#0f766e;">${l.asignatura}</p>` : ''}
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:21px;font-weight:700;letter-spacing:.06em;color:#0f766e;word-break:break-all;">${l.codigo}</p>
        ${l.plataforma ? `<p style="margin:8px 0 0;font-size:12px;color:#5f6b6a;">App del libro digital 📲 <strong>${l.plataforma}</strong></p>` : ''}
      </div>`,
    )
    .join('');
}

export interface DatosCorreoLicencia {
  alumno: string;
  nombre: string;
  apellidos: string;
  curso: string;
  clase: string;
  academicYear: string;
  licencias: LicenciaCorreo[];
}

/** Las variables que puede usar la plantilla. Con varias licencias, las de libro se juntan. */
export function varsDeLicencia(d: DatosCorreoLicencia): Record<string, string> {
  const junta = (valores: string[]) => {
    const unicos = [...new Set(valores.filter(Boolean))];
    if (unicos.length <= 1) return unicos[0] ?? '';
    return `${unicos.slice(0, -1).join(', ')} y ${unicos.at(-1)}`;
  };
  return {
    nombre: d.nombre,
    apellidos: d.apellidos,
    alumno: d.alumno,
    curso: d.curso,
    clase: d.clase,
    asignatura: junta(d.licencias.map((l) => l.asignatura)),
    libro: junta(d.licencias.map((l) => l.libro)),
    editorial: '',
    plataforma: junta(d.licencias.map((l) => l.plataforma)),
    codigo: HUECO_CODIGO,
    n: String(d.licencias.length),
    curso_escolar: d.academicYear,
  };
}

/**
 * El correo entero. Si el cuerpo no menciona `{codigo}` la caja se pone igual al final: un
 * correo de licencias sin el código dentro no le sirve a nadie, y es un error fácil de cometer
 * editando la plantilla con prisa.
 */
export function htmlLicencia(cuerpo: string, d: DatosCorreoLicencia): string {
  const vars = varsDeLicencia(d);
  const conVars = applyVars(cuerpo, vars);
  const seguro = cuerpoSeguro(conVars);
  const caja = cajaCodigos(d.licencias);
  const cuerpoHtml = seguro.includes(HUECO_CODIGO)
    ? seguro.split(HUECO_CODIGO).join(caja)
    : `${seguro}${caja}`;
  const ficha = [
    d.alumno ? `👤 <strong>Alumno/a:</strong> ${d.alumno}${d.clase ? ` · ${d.clase}` : ''}` : '',
    d.licencias.some((l) => l.libro)
      ? `📙 <strong>Libro${d.licencias.length > 1 ? 's' : ''}:</strong> ${[...new Set(d.licencias.map((l) => l.libro).filter(Boolean))].join(' · ')}`
      : '',
  ]
    .filter(Boolean)
    .join('<br>');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#0d9488,#0c8f83);padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#ffffff;opacity:.9;">Consolación Burriana · Licencias</p>
    </div>
    <div style="padding:26px 32px;font-size:14.5px;color:#27272a;line-height:1.65;">
      ${cuerpoHtml}
      ${ficha ? `<div style="margin-top:20px;border-top:1px solid #f4f4f5;padding-top:14px;font-size:13px;color:#52525b;line-height:1.7;">${ficha}</div>` : ''}
    </div>
    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;"><strong>Consolación Burriana</strong> · licencias@consolacionburriana.com</p>
    </div>
  </div>
</body>
</html>`;
}

export interface PlantillaLicencia {
  clave: 'pago' | 'banco';
  nombre: string;
  subject: string;
  body: string;
}

// Las dos de fábrica. Son EL texto de siempre (el del FormMule), con los `<b>` intactos: si el
// alumno recibe algo distinto a lo que recibía el año pasado, la culpa se la lleva la app.
export const PLANTILLAS_LICENCIA: PlantillaLicencia[] = [
  {
    clave: 'pago',
    nombre: 'Licencia Digital Adquirida',
    subject: '[Licencia Digital 📘] Licencia {asignatura}',
    body: `Hola,

Te mandamos la licencia de <b>{asignatura}</b>

⬇️ <b>CÓDIGO LICENCIA</b> ⬇️
{codigo}

Para cualquier duda, pregunta primero a tu profesor/a que te ayudará a poner la licencia en clase, después puedes consultarnos en licencias@consolacionburriana.com

Equipo TIC
Amparo, Jose Miguel, Bárbara y David`,
  },
  {
    clave: 'banco',
    nombre: 'Licencia Gratuita Banco de Libros',
    subject: '[Banco de Libros 📗] Licencia {asignatura}',
    body: `Hola,

Te mandamos la licencia de <b>{asignatura}</b>, incluida en el <b>Banco de Libros</b>.

⬇️ <b>CÓDIGO LICENCIA</b> ⬇️
{codigo}

Para cualquier duda, pregunta primero a tu profesor/a que te ayudará a poner la licencia en clase, después puedes consultarnos en licencias@consolacionburriana.com

Equipo TIC
Amparo, Jose Miguel, Bárbara y David`,
  },
];

/** Un correo de licencias. Lanza si falla: quien llama lo marca como error en esa licencia. */
export async function enviarCorreoLicencia(para: string, asunto: string, html: string): Promise<void> {
  await enviar('licencias', { to: para, subject: asunto, html });
}
