// Tareas por correo (docs/34-paleta-y-tareas-por-correo.md): helpers puros para convertir un correo
// reenviado en una tarjeta de Tableros. Sin IO; lo que habla con Gmail está en tareas-correo-server.ts.

/** Quita «Fwd:», «RV:», «Re:», «Reenviado:»… del principio del asunto (las veces que haga falta). */
export function limpiarAsunto(asunto: string): string {
  let s = asunto.trim();
  for (;;) {
    const sin = s.replace(/^(fwd?|fw|rv|re|reenviado|reenv|tr|wg)\s*:\s*/i, '').trim();
    if (sin === s) return s;
    s = sin;
  }
}

/** «Ana Gil <ana@x.com>» → { nombre: 'Ana Gil', email: 'ana@x.com' }. */
export function remitente(from: string): { nombre: string | null; email: string } | null {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { nombre: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  const solo = from.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(solo) ? { nombre: null, email: solo } : null;
}

interface Parte {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: Parte[] | null;
}

function decodificar(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sinHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** El texto del correo: la parte `text/plain` (o el HTML sin etiquetas), sin líneas en blanco de más. */
export function textoDelCorreo(payload: Parte | null | undefined): string {
  const buscar = (p: Parte | null | undefined, tipo: string): string | null => {
    if (!p) return null;
    if (p.mimeType === tipo && p.body?.data) return decodificar(p.body.data);
    for (const h of p.parts ?? []) {
      const r = buscar(h, tipo);
      if (r) return r;
    }
    return null;
  };
  const plano = buscar(payload, 'text/plain');
  const html = plano ? null : buscar(payload, 'text/html');
  const texto = plano ?? (html ? sinHtml(html) : '');
  return texto
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Enlace al correo en Gmail por su Message-ID: lo abre en el buzón de quien lo pulse, si lo tiene
 * (quien lo reenvió lo tiene en Enviados). No apunta al buzón de TIC, que no es de todo el mundo.
 */
export function enlaceCorreo(messageId: string): string {
  const id = messageId.trim().replace(/^<|>$/g, '');
  return `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(id)}`;
}

/** La dirección a la que se reenvía: `tic+tarea@dominio` a partir del buzón. */
export function direccionTareas(buzon: string): string {
  const [local, dominio] = buzon.split('@');
  return `${local}+tarea@${dominio}`;
}
