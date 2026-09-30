// Correos de Oratorios y Godly Play al profe al que se le quita la hora. Ficha:
// docs/26-oratorios.md
//
// Es un correo de compañero a compañero: sale del buzón de quien lo lleva, sin logos ni
// firma corporativa (David, 30-sep-2026: «evita firmitas»). Lo único «bonito» es el bloque
// con la fecha, la hora, la clase y la asignatura, que es lo que se busca al abrirlo.
import { fechaLarga, horaBonita, type TipoCorreo } from '@/lib/oratorios';

export interface ItemCorreo {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  clase: string; // '4 ESO B'
  materia: string | null;
  /** En un cambio: dónde estaba antes. */
  antes?: { fecha: string; horaInicio: string; horaFin: string } | null;
}

export interface DatosCorreo {
  tipoCorreo: TipoCorreo;
  nombreCorreo: string; // 'oratorio'
  textoExtra: string | null; // «Será primero la mitad…»
  saludo: string; // nombre de pila del profe
  firma: string; // nombre de quien lo lleva
  items: ItemCorreo[];
}

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capital(t: string): string {
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
}

function cuando(i: { fecha: string; horaInicio: string; horaFin: string }): string {
  return `${capital(fechaLarga(i.fecha))} · ${horaBonita(i.horaInicio)} – ${horaBonita(i.horaFin)}`;
}

function bloque(i: ItemCorreo, tachado = false): string {
  const clase = [i.clase, i.materia].filter(Boolean).join(' · ');
  const antes = i.antes
    ? `<div style="font-size:13px;color:#9ca3af;text-decoration:line-through;margin-bottom:4px;">${esc(cuando(i.antes))}</div>`
    : '';
  const estilo = tachado ? 'text-decoration:line-through;color:#6b7280;' : 'color:#111827;';
  return `
    <div style="border-left:3px solid #2563eb;background:#f8fafc;border-radius:8px;padding:10px 14px;margin:0 0 10px;">
      ${antes}
      <div style="font-size:15px;font-weight:600;${estilo}">📅 ${esc(cuando(i))}</div>
      <div style="font-size:14px;margin-top:2px;${estilo}">👥 ${esc(clase)}</div>
    </div>`;
}

function asunto(d: DatosCorreo): string {
  const nombre = capital(d.nombreCorreo);
  const uno = d.items.length === 1 ? d.items[0] : null;
  const detalle = uno ? ` con ${uno.clase} · ${fechaLarga(uno.fecha)}` : ` · ${d.items.length} momentos`;
  if (d.tipoCorreo === 'cambio') return `Cambio: ${nombre}${detalle}`;
  if (d.tipoCorreo === 'anulacion') return `Anulado: ${nombre}${detalle}`;
  return `${nombre}${detalle}`;
}

function entrada(d: DatosCorreo): string {
  const varios = d.items.length > 1;
  const momento = varios ? `unos momentos de ${d.nombreCorreo}` : `un momento de ${d.nombreCorreo}`;
  if (d.tipoCorreo === 'cambio') return `Te cambio ${varios ? 'los momentos' : 'el momento'} de ${d.nombreCorreo}. Ahora queda${varios ? 'n' : ''} así:`;
  if (d.tipoCorreo === 'anulacion') return `Al final no haremos ${momento} que te había dicho:`;
  return `Tengo previsto ${momento}:`;
}

/** Asunto y cuerpo del correo a un profe (uno o varios momentos en el mismo correo). */
export function correoProfe(d: DatosCorreo): { subject: string; html: string } {
  const tachado = d.tipoCorreo === 'anulacion';
  const extra = d.textoExtra && !tachado ? `<p style="margin:14px 0 0;">${esc(d.textoExtra)}</p>` : '';
  const cierre = tachado ? 'Gracias igualmente.' : 'Gracias por tu colaboración.';
  const html = `<!doctype html><html><body style="margin:0;padding:0;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px;padding:8px 4px;">
    <p style="margin:0 0 12px;">Hola ${esc(d.saludo)},</p>
    <p style="margin:0 0 12px;">${esc(entrada(d))}</p>
    ${d.items.map((i) => bloque(i, tachado)).join('')}
    ${extra}
    <p style="margin:16px 0 0;">${cierre}<br>${esc(d.firma)}</p>
  </div>
</body></html>`;
  return { subject: asunto(d), html };
}
