// Primitivos compartidos de envío masivo (patrón de /gestion/correos, ver
// docs/04-convenciones-tecnicas.md): sustitución de variables, escapado, enlaces
// clicables y batch de 100 vía Resend. Cualquier módulo con correo masivo nuevo
// (Evaluaciones, o los "correos masivos a pendientes" de otro módulo) parte de aquí
// en vez de reimplementar su propia versión.
import { FROM, getResend } from '@/lib/email';

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

/** Envío masivo genérico: batch de 100 vía Resend, con variables, escapado y enlaces clicables. */
export async function sendChunks(
  items: BlastItem[],
  subject: string,
  body: string,
): Promise<{ sent: number; errors: number; skipped: boolean }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, errors: 0, skipped: true };
  const resend = getResend();
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const payload = chunk.map((r) => ({
      from: FROM,
      to: r.email,
      subject: applyVars(subject, r.vars),
      html: wrapHtml(applyVars(body, r.vars), r.cta),
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
