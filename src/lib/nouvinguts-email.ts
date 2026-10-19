// Correos de Nouvinguts. Ficha: docs/28-nouvinguts.md
//
// Cortos y sin firmas corporativas (como los de Tableros): QUIÉN es el alumno, QUÉ ha pasado
// o qué le falta, y un botón para ir a su ficha.
//   - alta:            «Nouvingut: MARTA LLORENS (6º EP)» o «3 alumnos nuevos en nouvinguts»
//   - parte terminada: «Secretaría ha terminado con Ana Pérez: te toca»
//   - listo:           «Ana Pérez ya lo tiene todo: cierra su ciclo»
//   - nota:            la nota que alguien manda a mano desde un paso
// Puro (sin IO): las URLs las pasa quien llama.
import { RESPONSABLE_LABEL, type Responsable } from '@/lib/nouvinguts';

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

function pie(): string {
  return `<p style="margin:22px 0 0;font-size:12px;color:#6b7280;">Aviso automático de Nouvinguts. Quién recibe cada aviso se cambia en Nouvinguts → Proceso.</p>`;
}

export interface AlumnoCorreo {
  nombre: string;
  clase: string;
  url: string;
  /** «Apuntado a mano por Mª José» / «Alta de la sincronización de Educamos». */
  origen?: string;
}

export function correoAlta(alumnos: AlumnoCorreo[], urlLista: string): { subject: string; html: string } {
  if (alumnos.length === 1) {
    const a = alumnos[0];
    return {
      subject: `Nouvingut: ${a.nombre} (${a.clase})`,
      html: envolver(`
        <p style="margin:0 0 6px;">Ha llegado un alumno nuevo:</p>
        <p style="margin:0;font-size:17px;font-weight:600;">${esc(a.nombre)} <span style="font-weight:400;color:#6b7280;">· ${esc(a.clase)}</span></p>
        ${a.origen ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${esc(a.origen)}</p>` : ''}
        ${boton(a.url, 'Ver sus pasos')}
        ${pie()}`),
    };
  }
  const filas = alumnos
    .map(
      (a) =>
        `<li style="margin:0 0 4px;"><a href="${esc(a.url)}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">${esc(a.nombre)}</a> <span style="color:#6b7280;">· ${esc(a.clase)}</span></li>`,
    )
    .join('');
  return {
    subject: `${alumnos.length} alumnos nuevos en nouvinguts`,
    html: envolver(`
      <p style="margin:0 0 10px;">Han entrado ${alumnos.length} alumnos nuevos con la sincronización de Educamos:</p>
      <ul style="margin:0;padding-left:20px;">${filas}</ul>
      ${boton(urlLista, 'Abrir nouvinguts')}
      ${pie()}`),
  };
}

export function correoParteTerminada(
  a: AlumnoCorreo,
  terminada: Responsable,
  faltan: { titulo: string }[],
): { subject: string; html: string } {
  const otra = terminada === 'secretaria' ? 'tic' : 'secretaria';
  const lista = faltan.map((p) => `<li style="margin:0 0 2px;">${esc(p.titulo)}</li>`).join('');
  return {
    subject: `${RESPONSABLE_LABEL[terminada]} ha terminado con ${a.nombre}: le toca a ${RESPONSABLE_LABEL[otra]}`,
    html: envolver(`
      <p style="margin:0 0 6px;">${RESPONSABLE_LABEL[terminada]} ya ha hecho todo lo suyo con</p>
      <p style="margin:0;font-size:17px;font-weight:600;">${esc(a.nombre)} <span style="font-weight:400;color:#6b7280;">· ${esc(a.clase)}</span></p>
      <p style="margin:14px 0 4px;">A ${RESPONSABLE_LABEL[otra]} le queda:</p>
      <ul style="margin:0;padding-left:20px;">${lista}</ul>
      ${boton(a.url, 'Ver sus pasos')}
      ${pie()}`),
  };
}

export function correoListo(a: AlumnoCorreo): { subject: string; html: string } {
  return {
    subject: `${a.nombre} ya lo tiene todo: cierra su ciclo`,
    html: envolver(`
      <p style="margin:0 0 6px;">A este alumno ya no le queda ningún paso:</p>
      <p style="margin:0;font-size:17px;font-weight:600;">${esc(a.nombre)} <span style="font-weight:400;color:#6b7280;">· ${esc(a.clase)}</span></p>
      <p style="margin:12px 0 0;">Cuando lo veas bien, cierra su ciclo y saldrá de nouvinguts.</p>
      ${boton(a.url, 'Cerrar su ciclo')}
      ${pie()}`),
  };
}

export function correoNota(
  a: AlumnoCorreo,
  nota: { texto: string; paso: string | null; autor: string },
): { subject: string; html: string } {
  const sobre = nota.paso ? `${nota.paso} · ` : '';
  return {
    subject: `${sobre}${a.nombre} (nouvinguts)`,
    html: envolver(`
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${esc(nota.autor)} ha dejado una nota${nota.paso ? ` en «${esc(nota.paso)}»` : ''} sobre</p>
      <p style="margin:0;font-size:17px;font-weight:600;">${esc(a.nombre)} <span style="font-weight:400;color:#6b7280;">· ${esc(a.clase)}</span></p>
      <div style="margin:14px 0 0;padding:12px 14px;border-left:3px solid #2563eb;background:#f8fafc;border-radius:6px;white-space:pre-line;">${esc(nota.texto)}</div>
      ${boton(a.url, 'Abrir su ficha')}
      <p style="margin:22px 0 0;font-size:12px;color:#6b7280;">Si contestas a este correo, le llega a ${esc(nota.autor)}.</p>`),
  };
}
