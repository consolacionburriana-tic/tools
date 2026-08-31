// Primitivos compartidos de envío masivo (patrón de /gestion/correos, ver
// docs/04-convenciones-tecnicas.md): sustitución de variables, escapado, enlaces
// clicables y envío por lotes. Cualquier módulo con correo masivo nuevo (Evaluaciones, o los
// "correos masivos a pendientes" de otro módulo) parte de aquí en vez de reimplementar su
// propia versión. El transporte (API de Gmail o Resend) y el remitente los decide
// `src/lib/email.ts` según el perfil del módulo.
import { emailConfigurado, enviarLote, type PerfilCorreo } from '@/lib/email';

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

export function boton(url: string, label: string): string {
  return `<div style="margin:22px 0"><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:12px">${label}</a></div>`;
}

export function wrapHtml(bodyText: string, cta?: { url: string; label: string }): string {
  const html = enlazarUrls(escapar(bodyText)).replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6">${html}${
    cta ? boton(cta.url, cta.label) : '<br><br>'
  }—<br>Colegio Consolación · Burriana</div>`;
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
      html: wrapHtml(applyVars(body, r.vars), r.cta),
      replyTo: opciones.replyTo,
    })),
  );
  return { sent, errors, skipped: false };
}
