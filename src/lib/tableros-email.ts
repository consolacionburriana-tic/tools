// Correos de los Tableros. Ficha: docs/27-tableros.md
//
// Tres correos, los tres cortos y sin firmas corporativas (como los de Oratorios): lo que se
// busca al abrirlos es QUÉ tarea, DE QUÉ tablero y PARA CUÁNDO, y un botón para ir a ella.
//   - asignación: «Ana te ha asignado una tarea»
//   - equipo:     «Ana te ha añadido al equipo TIC»
//   - vencimientos (cron diario): «Tienes 2 tareas que vencen mañana»
// Puro (sin IO): la URL base la pasa quien llama.
import { diaLargo, diasEntre, PRIORIDAD_LABELS, type Prioridad } from '@/lib/tableros';

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function envolver(cuerpo: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;">
  <div style="font-family:${FUENTE};font-size:15px;line-height:1.55;color:#1f2937;max-width:560px;padding:8px 4px;">
    ${cuerpo}
  </div>
</body></html>`;
}

function boton(url: string, texto: string): string {
  return `<p style="margin:18px 0 0;"><a href="${esc(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;">${esc(texto)}</a></p>`;
}

const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  baja: '#64748b',
  media: '#2563eb',
  alta: '#ea580c',
  urgente: '#dc2626',
};

function pastilla(texto: string, color: string): string {
  return `<span style="display:inline-block;font-size:12px;font-weight:600;color:${color};border:1px solid ${color};border-radius:999px;padding:1px 8px;margin-right:6px;">${esc(texto)}</span>`;
}

/** «vence mañana», «venció ayer», «vence el jueves, 9 de octubre». */
export function fraseVence(vence: string, hoy: string): string {
  const dias = diasEntre(hoy, vence);
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias === -1) return 'venció ayer';
  if (dias < 0) return `venció hace ${-dias} días`;
  return `vence el ${diaLargo(vence)}`;
}

export interface TarjetaCorreo {
  titulo: string;
  tablero: string; // «🛠️ Mantenimiento de aulas»
  equipo: string;
  vence: string | null;
  prioridad: Prioridad | null;
  descripcion?: string | null;
  url: string;
}

function bloqueTarjeta(t: TarjetaCorreo, hoy: string, detalle = false): string {
  const chips = [
    t.prioridad ? pastilla(PRIORIDAD_LABELS[t.prioridad], COLOR_PRIORIDAD[t.prioridad]) : '',
    t.vence ? pastilla(fraseVence(t.vence, hoy), diasEntre(hoy, t.vence) < 0 ? '#dc2626' : '#b45309') : '',
  ].join('');
  const desc =
    detalle && t.descripcion?.trim()
      ? `<div style="font-size:14px;color:#4b5563;margin-top:6px;white-space:pre-line;">${esc(t.descripcion.trim().slice(0, 400))}${t.descripcion.trim().length > 400 ? '…' : ''}</div>`
      : '';
  return `
    <div style="border-left:3px solid #2563eb;background:#f8fafc;border-radius:8px;padding:10px 14px;margin:0 0 10px;">
      <div style="font-size:12px;color:#6b7280;">${esc(t.equipo)} · ${esc(t.tablero)}</div>
      <div style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;"><a href="${esc(t.url)}" style="color:#111827;text-decoration:none;">${esc(t.titulo)}</a></div>
      ${chips ? `<div style="margin-top:6px;">${chips}</div>` : ''}
      ${desc}
    </div>`;
}

/** A quien le acaban de asignar una tarea. */
export function correoAsignacion(d: { saludo: string; quien: string; tarjeta: TarjetaCorreo; hoy: string }): {
  subject: string;
  html: string;
} {
  const html = envolver(`
    <p style="margin:0 0 12px;">Hola ${esc(d.saludo)},</p>
    <p style="margin:0 0 12px;">${esc(d.quien)} te ha asignado una tarea:</p>
    ${bloqueTarjeta(d.tarjeta, d.hoy, true)}
    ${boton(d.tarjeta.url, 'Abrir la tarea')}
  `);
  return { subject: `Tarea para ti: ${d.tarjeta.titulo}`, html };
}

/** A quien acaban de meter en un equipo. */
export function correoEquipo(d: {
  saludo: string;
  quien: string;
  equipo: string;
  tableros: string[];
  url: string;
}): { subject: string; html: string } {
  const lista = d.tableros.length
    ? `<p style="margin:0 0 12px;">Tiene ${d.tableros.length === 1 ? 'este tablero' : 'estos tableros'}: ${d.tableros.map((t) => `<b>${esc(t)}</b>`).join(', ')}.</p>`
    : '';
  const html = envolver(`
    <p style="margin:0 0 12px;">Hola ${esc(d.saludo)},</p>
    <p style="margin:0 0 12px;">${esc(d.quien)} te ha añadido al equipo <b>${esc(d.equipo)}</b> en los Tableros de la plataforma.</p>
    ${lista}
    ${boton(d.url, 'Ver los tableros')}
  `);
  return { subject: `Te han añadido al equipo ${d.equipo}`, html };
}

export interface ItemVencimiento extends TarjetaCorreo {
  tipo: 'proximo' | 'vencido';
}

/** El aviso diario: lo que vence ya y lo que se ha pasado de fecha, todo junto. */
export function correoVencimientos(d: { saludo: string; items: ItemVencimiento[]; hoy: string; url: string }): {
  subject: string;
  html: string;
} {
  const vencidas = d.items.filter((i) => i.tipo === 'vencido');
  const proximas = d.items.filter((i) => i.tipo === 'proximo');
  const partes: string[] = [];
  if (proximas.length) {
    partes.push(`<p style="margin:16px 0 8px;font-weight:600;">⏰ Vence${proximas.length === 1 ? '' : 'n'} ya</p>`);
    partes.push(proximas.map((t) => bloqueTarjeta(t, d.hoy)).join(''));
  }
  if (vencidas.length) {
    partes.push(`<p style="margin:16px 0 8px;font-weight:600;">🔴 Se ha${vencidas.length === 1 ? '' : 'n'} pasado de fecha</p>`);
    partes.push(vencidas.map((t) => bloqueTarjeta(t, d.hoy)).join(''));
  }
  const n = d.items.length;
  const plural = (k: number, uno: string, varios: string) => (k === 1 ? uno : varios);
  const subject =
    vencidas.length && proximas.length
      ? `Tus tareas: ${proximas.length} ${plural(proximas.length, 'vence', 'vencen')} ya y ${vencidas.length} ${plural(vencidas.length, 'se ha', 'se han')} pasado de fecha`
      : vencidas.length
        ? `${plural(n, 'Una tarea se ha pasado', `${n} tareas se han pasado`)} de fecha`
        : n === 1
          ? `Tarea que ${fraseVence(d.items[0].vence ?? d.hoy, d.hoy)}: ${d.items[0].titulo}`
          : `Tienes ${n} tareas que vencen ya`;
  const html = envolver(`
    <p style="margin:0 0 4px;">Hola ${esc(d.saludo)},</p>
    <p style="margin:0;">Un recordatorio de lo que tienes asignado en los tableros:</p>
    ${partes.join('')}
    ${boton(d.url, 'Ver todas mis tareas')}
    <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">Si no quieres estos avisos, apágalos en Tableros → «Avisos por correo».</p>
  `);
  return { subject, html };
}
