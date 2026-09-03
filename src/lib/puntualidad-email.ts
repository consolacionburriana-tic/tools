// Plantillas de correo del módulo Puntualidad. Dos, y muy distintas:
//
//   1. **Aviso del tercer retraso** al tutor/a de la clase (con copia a jefatura si está
//      configurada): el detalle de los tres retrasos que lo motivan y UN botón que abre la
//      pantalla donde se fija el día que el alumno se queda sin patio. Un clic, sin login.
//   2. **Resumen semanal** al tutor/a: los retrasos de su clase esa semana. Si no hubo
//      ninguno, no se manda (decisión de David: correo cero cuando no hay nada que contar).
//
// El envío pasa por `enviar`/`enviarLote` de `src/lib/email.ts` con el perfil `puntualidad`.
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { appBaseUrl } from '@/lib/constants';
import { enviar, enviarLote, emailConfigurado } from '@/lib/email';
import { formatoRetraso } from '@/lib/puntualidad';
import type { AvisoConsecuencia, ResumenTutor } from '@/lib/puntualidad-server';

const NARANJA = '#ea580c';

function fechaLarga(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}

function fechaCorta(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM', { locale: es });
  } catch {
    return iso;
  }
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function envoltorio(titulo: string, cuerpo: string): string {
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#27272a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:${NARANJA};padding:16px 24px;color:#fff;font-size:13px;font-weight:600;letter-spacing:.02em;">
      Consolación Burriana · Puntualidad
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.3;color:#18181b;">${escapar(titulo)}</h1>
      ${cuerpo}
    </div>
    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f4f4f5;color:#a1a1aa;font-size:11px;">
      Correo automático del registro de puntualidad · no hace falta contestar.
    </div>
  </div>
</body></html>`;
}

function tablaRetrasos(retrasos: { fecha: string; hora: string; asignatura: string | null; profe: string | null }[]): string {
  const filas = retrasos
    .map(
      (r) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;white-space:nowrap;">${escapar(fechaCorta(r.fecha))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums;">${escapar(r.hora)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;">${escapar(r.asignatura ?? '—')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a;">${escapar(r.profe ?? '—')}</td>
      </tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Día</th>
      <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Hora</th>
      <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Asignatura</th>
      <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Registrado por</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>`;
}

function boton(url: string, label: string): string {
  return `<div style="margin:20px 0 8px;text-align:center;">
    <a href="${url}" style="display:inline-block;background:${NARANJA};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:999px;">${escapar(label)}</a>
  </div>`;
}

/** URL pública de la pantalla de un clic para fijar la consecuencia. */
export function urlConsecuencia(token: string): string {
  return `${appBaseUrl()}/puntualidad/consecuencia/${token}`;
}

export function htmlAvisoTercerRetraso(aviso: AvisoConsecuencia): string {
  const cuerpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      <strong>${escapar(aviso.alumnoNombre)}</strong> (${escapar(aviso.clase)}) acumula
      <strong>${aviso.totalCurso} retrasos sin justificar</strong> este curso, así que le
      corresponde quedarse sin patio.
    </p>
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;">Los tres que lo motivan:</p>
    ${tablaRetrasos(aviso.retrasos)}
    <p style="margin:0;font-size:14px;line-height:1.6;">
      Con el botón eliges el día en que lo cumple y queda registrado. Si prefieres hacerlo
      luego, la consecuencia ya está creada y te espera en el panel de Puntualidad.
    </p>
    ${boton(urlConsecuencia(aviso.token), 'Poner el día que se queda sin patio')}
    <p style="margin:12px 0 0;font-size:11px;color:#a1a1aa;text-align:center;">
      Este enlace es personal del aviso y caduca en 60 días.
    </p>`;
  return envoltorio(`${aviso.alumnoNombre} llega al tercer retraso`, cuerpo);
}

/** Manda el aviso del ciclo de tres. Devuelve a quién se le mandó de verdad. */
export async function enviarAvisoTercerRetraso(
  aviso: AvisoConsecuencia,
  extra: string[] = [],
): Promise<string[]> {
  const destinatarios = [...new Set([...aviso.destinatarios, ...extra])].filter(Boolean);
  if (!emailConfigurado() || destinatarios.length === 0) return [];
  await enviar('puntualidad', {
    to: destinatarios,
    subject: `${aviso.alumnoNombre} (${aviso.clase}) · ${aviso.totalCurso}º retraso sin justificar`,
    html: htmlAvisoTercerRetraso(aviso),
  });
  return destinatarios;
}

export function htmlResumenSemanal(tutor: ResumenTutor, desde: string, hasta: string): string {
  const filas = tutor.filas
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
    .map(
      (f) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;">${escapar(f.alumno)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;white-space:nowrap;">${escapar(fechaCorta(f.fecha))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums;">${escapar(f.hora)} <span style="color:#a1a1aa;">(${escapar(formatoRetraso(f.minutosRetraso))})</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #f4f4f5;font-size:13px;color:${f.justificado ? '#16a34a' : '#71717a'};">${f.justificado ? 'Justificado' : escapar(f.asignatura ?? '—')}</td>
      </tr>`,
    )
    .join('');

  const sinJustificar = tutor.filas.filter((f) => !f.justificado).length;
  const cuerpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Hola${tutor.nombre ? ` ${escapar(tutor.nombre.split(' ')[0])}` : ''}: esta semana
      (${escapar(fechaCorta(desde))} – ${escapar(fechaCorta(hasta))}) hay
      <strong>${tutor.filas.length} ${tutor.filas.length === 1 ? 'retraso' : 'retrasos'}</strong>
      en ${tutor.clases.length === 1 ? escapar(tutor.clases[0]) : 'tus clases'}${
        sinJustificar > 0 ? `, ${sinJustificar} sin justificar` : ''
      }.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Alumno</th>
        <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Día</th>
        <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Llegada</th>
        <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Asignatura</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    ${boton(`${appBaseUrl()}/gestion/puntualidad`, 'Ver el panel de puntualidad')}`;
  return envoltorio('Resumen semanal de puntualidad', cuerpo);
}

/** Manda el resumen semanal solo a los tutores que tienen algo que leer. */
export async function enviarResumenSemanal(
  tutores: ResumenTutor[],
  desde: string,
  hasta: string,
): Promise<string[]> {
  const conRetrasos = tutores.filter((t) => t.filas.length > 0 && t.email);
  if (!emailConfigurado() || conRetrasos.length === 0) return [];
  await enviarLote(
    'puntualidad',
    conRetrasos.map((t) => ({
      to: t.email,
      subject: `Puntualidad · ${t.filas.length} ${t.filas.length === 1 ? 'retraso' : 'retrasos'} esta semana en ${
        t.clases.length === 1 ? t.clases[0] : 'tus clases'
      }`,
      html: htmlResumenSemanal(t, desde, hasta),
    })),
  );
  return conRetrasos.map((t) => t.email);
}

/**
 * Aviso al profe de la asignatura en la que se registró el retraso. Escrito y listo, pero
 * NO se llama desde ningún sitio todavía: mientras los horarios del claustro no estén en
 * la app, la asignatura se elige a mano y no se puede saber con certeza de quién es la
 * clase (decisión de David: nada de correos a ciegas). El día que estén los horarios,
 * basta llamarlo desde el route de alta y marcar `aviso_profe_enviado_at`.
 */
export function htmlAvisoProfeAsignatura(datos: {
  alumno: string;
  clase: string;
  fecha: string;
  hora: string;
  minutos: number;
  asignatura: string;
  registradoPor: string | null;
}): string {
  const cuerpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      <strong>${escapar(datos.alumno)}</strong> (${escapar(datos.clase)}) llegó tarde el
      ${escapar(fechaLarga(datos.fecha))} a las <strong>${escapar(datos.hora)}</strong>
      (${escapar(formatoRetraso(datos.minutos))} de retraso) y ha quedado registrado en tu
      clase de ${escapar(datos.asignatura)}.
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
      Lo registró ${escapar(datos.registradoPor ?? 'el claustro')} en el control de
      puntualidad. No hace falta que hagas nada: es solo para que lo sepas.
    </p>`;
  return envoltorio('Un alumno llegó tarde a tu clase', cuerpo);
}
