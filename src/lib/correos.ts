// Primitivos compartidos de envío masivo (patrón de /gestion/correos, ver
// docs/04-convenciones-tecnicas.md): sustitución de variables, escapado, enlaces
// clicables y envío por lotes. Cualquier módulo con correo masivo nuevo (Evaluaciones, o los
// "correos masivos a pendientes" de otro módulo) parte de aquí en vez de reimplementar su
// propia versión. El transporte (API de Gmail o Resend) y el remitente los decide
// `src/lib/email.ts` según el perfil del módulo.
import { emailConfigurado, enviarLote, type PerfilCorreo } from '@/lib/email';

// Identidad visual por módulo: mismo esqueleto de tarjeta en todos los correos masivos,
// con el degradado del color de cada módulo (tan sutil que apenas se nota, a propósito).
interface CorreoTheme {
  label: string;
  accent: string;
  accentSoft: string;
}

const TEMAS: Record<PerfilCorreo, CorreoTheme> = {
  licencias: { label: 'Consolación Burriana · Licencias', accent: '#0d9488', accentSoft: '#0c8f83' },
  salidas: { label: 'Consolación Burriana · Salidas y pagos', accent: '#2563eb', accentSoft: '#2460df' },
  abc: { label: 'Consolación Burriana · Registro ABC', accent: '#0d9488', accentSoft: '#0c8f83' },
  evaluaciones: { label: 'Consolación Burriana · Evaluaciones', accent: '#7c3aed', accentSoft: '#7530dd' },
  puntualidad: { label: 'Consolación Burriana · Puntualidad', accent: '#ea580c', accentSoft: '#dc5209' },
  general: { label: 'Consolación Burriana', accent: '#52525b', accentSoft: '#48484f' },
};

/**
 * Sustituye las variables `{clave}` del texto (insensible a mayúsculas). Las claves que no
 * existan se dejan tal cual, para que un `{typo}` se vea en la vista previa y no desaparezca.
 */
export function applyVars(text: string, vars: Record<string, string>): string {
  const porClave = new Map(Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]));
  return (text ?? '').replace(/\{(\w+)\}/g, (m, k: string) => porClave.get(k.toLowerCase()) ?? m);
}

export function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Los enlaces que el gestor escribe en el mensaje (o el `{enlace}` del magic link) tienen que
// llegar clicables aunque el cuerpo sea texto plano.
export function enlazarUrls(htmlEscapado: string): string {
  return htmlEscapado.replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" style="color:#2563eb;word-break:break-all">${url}</a>`,
  );
}

export function boton(url: string, label: string, color = '#52525b'): string {
  return `<div style="margin:24px 0;text-align:center;"><a href="${url}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:12px 24px;border-radius:999px;">${label}</a></div>`;
}

/** Tarjeta compartida por todo correo masivo de texto libre (Licencias, Salidas…). El cuerpo
 * lo escribe el gestor en el panel; aquí solo se le pone la vitrina. `perfil` decide el color. */
export function wrapHtml(
  bodyText: string,
  cta?: { url: string; label: string },
  perfil: PerfilCorreo = 'general',
): string {
  const t = TEMAS[perfil] ?? TEMAS.general;
  const html = enlazarUrls(escapar(bodyText)).replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,${t.accent},${t.accentSoft});padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#ffffff;opacity:.9;">${t.label}</p>
    </div>

    <div style="padding:28px 32px;font-size:14.5px;color:#27272a;line-height:1.65;">
      ${html}
      ${cta ? boton(cta.url, cta.label, t.accent) : ''}
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;"><strong>Consolación Burriana</strong></p>
    </div>

  </div>
</body>
</html>`;
}

export interface BlastItem {
  email: string;
  vars: Record<string, string>;
  cta?: { url: string; label: string };
}

/**
 * Envío masivo genérico: un correo por destinatario, con variables, escapado y enlaces
 * clicables. `perfil` decide desde qué identidad sale (por defecto, la genérica) y `replyTo`
 * permite que las respuestas vayan a quien manda (el tutor de la salida, el gestor…).
 */
export async function sendChunks(
  items: BlastItem[],
  subject: string,
  body: string,
  opciones: { perfil?: PerfilCorreo; replyTo?: string } = {},
): Promise<{ sent: number; errors: number; skipped: boolean }> {
  if (!emailConfigurado()) return { sent: 0, errors: 0, skipped: true };
  const { sent, errors } = await enviarLote(
    opciones.perfil ?? 'general',
    items.map((r) => ({
      to: r.email,
      subject: applyVars(subject, r.vars),
      html: wrapHtml(applyVars(body, r.vars), r.cta, opciones.perfil),
      replyTo: opciones.replyTo,
    })),
  );
  return { sent, errors, skipped: false };
}
