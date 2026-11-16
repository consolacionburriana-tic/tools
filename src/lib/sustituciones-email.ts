// Correos de Sustituciones (docs/32, decisiones 10 y 17). De compañero a compañero, como los de
// Oratorios: salen del buzón de quien confirma, sin logos ni firmas, y lo único «bonito» es un
// bloque por hora con raya azul (cuándo, dónde, indicaciones y el botón de Calendar), que es lo
// que se busca al abrirlo. Los textos de antes y después de los bloques se editan en Ajustes;
// el cuándo y el dónde los pone siempre el código. EL MOTIVO NO SALE NUNCA.
import {
  cuandoYDonde,
  enlaceGoogleCalendar,
  escaparHtml,
  fechaLarga,
  hora,
  horasTexto,
  lugarDe,
  mayuscula,
  ordenSesion,
  PLANTILLAS_DE_FABRICA,
  pintarPlantilla,
  rangoLargo,
  textoAHtml,
  GRUPO_MOTIVO_NOMBRE,
  nombreMes,
  type HoraCorreo,
  type Plantilla,
  type Resumen,
  type TipoPlantilla,
  type VariablesCorreo,
} from '@/lib/sustituciones';

export interface HoraBloque extends HoraCorreo {
  /** Para el correo al ausente: quién entra («Lucía»), o null si se queda sin cubrir. */
  quien?: string | null;
  /** Para el ausente: no hacía falta cubrirla (una reunión que solo cuenta). */
  noHaceFalta?: boolean;
}

export interface DatosAviso {
  tipo: TipoPlantilla;
  plantilla: Plantilla;
  /** Nombre de pila de quien lo recibe. */
  para: string;
  /** Quien falta (nombre corto). */
  ausente: string;
  /** Quien lo manda (nombre corto). */
  quien: string;
  desde: string;
  hasta: string;
  horas: readonly HoraBloque[];
  /** Qué hace la clase. Solo para quien entra en el aula. */
  indicaciones?: string | null;
  confirmacionUrl?: string;
}

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function boton(href: string, texto: string): string {
  return `<a href="${escaparHtml(href)}" style="display:inline-block;margin-top:8px;padding:8px 12px;border-radius:8px;background:#ffffff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:13px;font-weight:600;text-decoration:none;">${escaparHtml(texto)}</a>`;
}

function bloque(h: HoraBloque, d: DatosAviso): string {
  const tachado = d.tipo === 'cambio' || d.tipo === 'anulacion';
  const estilo = tachado ? 'text-decoration:line-through;color:#6b7280;' : 'color:#111827;';
  const cuando = `${hora(h.horaInicio)} – ${hora(h.horaFin)} · ${fechaLarga(h.fecha)}`;
  const lugar = lugarDe(h);
  let extra = '';
  if (d.tipo === 'ausente') {
    const texto = h.noHaceFalta ? 'No hace falta cubrirla' : h.quien ? `Entra ${h.quien}` : 'Sin cubrir de momento';
    const color = h.quien || h.noHaceFalta ? '#374151' : '#b45309';
    extra = `<div style="font-size:14px;margin-top:4px;font-weight:600;color:${color};">${escaparHtml(texto)}</div>`;
  }
  const conCalendario = d.tipo === 'sustituto' || d.tipo === 'en_aula';
  const titulo = `Sustitución · ${[h.grupos, h.materia].filter(Boolean).join(' · ') || d.ausente}`;
  const cal = conCalendario
    ? boton(
        enlaceGoogleCalendar({
          titulo,
          fecha: h.fecha,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          lugar: h.aula ? mayuscula(h.aula) : h.grupos,
          detalles: [`Cubres a ${d.ausente}.`, d.indicaciones?.trim() || null].filter(Boolean).join('\n\n'),
        }),
        'Añadir a mi Google Calendar',
      )
    : '';
  return `
    <div style="border-left:3px solid #2563eb;background:#f8fafc;border-radius:8px;padding:10px 14px;margin:0 0 10px;">
      <div style="font-size:17px;font-weight:700;${estilo}">${escaparHtml(cuando)}</div>
      ${lugar ? `<div style="font-size:15px;margin-top:2px;${estilo}">${escaparHtml(lugar)}</div>` : ''}
      ${extra}
      ${cal}
    </div>`;
}

function variables(d: DatosAviso): VariablesCorreo {
  const grupos = [...new Set(d.horas.map((h) => h.grupos).filter((g): g is string => Boolean(g)))];
  const aulas = [...new Set(d.horas.map((h) => h.aula).filter((a): a is string => Boolean(a)))];
  return {
    nombre: d.para,
    ausente: d.ausente,
    fecha: rangoLargo(d.desde, d.hasta),
    horas: horasTexto(d.horas.length),
    grupo: grupos.join(', '),
    aula: aulas.join(', '),
    quien: d.quien,
  };
}

/** El asunto: lo editable y, detrás, el cuándo y el dónde (que no se pueden quitar). */
export function asuntoAviso(d: Pick<DatosAviso, 'tipo' | 'plantilla' | 'horas'> & Partial<DatosAviso>): string {
  let asunto = pintarPlantilla(d.plantilla.asunto, d.para ? variables(d as DatosAviso) : {}).trim();
  // «Sustitución» de fábrica pasa a plural con varias horas.
  if (d.tipo === 'sustituto' && asunto === PLANTILLAS_DE_FABRICA.sustituto.asunto && d.horas.length > 1) asunto = 'Sustituciones';
  const cuando = cuandoYDonde(d.horas);
  return cuando ? `${asunto} · ${cuando}` : asunto;
}

/** Asunto y cuerpo de un aviso (sustituto, codocente, ausente, «ya no hace falta» o anulación). */
export function correoAviso(d: DatosAviso): { subject: string; html: string } {
  const vars = variables(d);
  const horas = [...d.horas].sort(ordenSesion);
  const indicaciones =
    d.indicaciones?.trim() && (d.tipo === 'sustituto' || d.tipo === 'en_aula')
      ? `<div style="margin:4px 0 14px;padding:10px 14px;border-radius:8px;background:#eff6ff;color:#1e3a8a;"><div style="font-size:13px;font-weight:600;margin-bottom:4px;">Indicaciones para la clase</div>${textoAHtml(d.indicaciones.trim(), 'margin:0')}</div>`
      : '';
  const html = `<!doctype html><html><body style="margin:0;padding:0;">
  <div style="font-family:${FUENTE};font-size:15px;line-height:1.55;color:#1f2937;max-width:560px;padding:8px 4px;">
    ${textoAHtml(pintarPlantilla(d.plantilla.antes, vars))}
    ${horas.map((h) => bloque(h, d)).join('')}
    ${indicaciones}
    ${(d.tipo === 'sustituto' || d.tipo === 'en_aula') && d.confirmacionUrl ? `<p style="margin:16px 0 6px;">Confirma, por favor, que puedes realizar esta sustitución:</p>${boton(d.confirmacionUrl, 'Confirmar sustitución')}` : ''}
    ${textoAHtml(pintarPlantilla(d.plantilla.despues, vars), 'margin:14px 0 0')}
  </div>
</body></html>`;
  return { subject: asuntoAviso({ ...d, horas }), html };
}

// ─── Informe mensual (decisión 12) ───────────────────────────────────────────

export interface DatosInforme {
  mes: string; // '2026-10'
  delMes: Resumen;
  delCurso: Resumen;
  curso: string;
  enlace: string;
  etapa?: string;
}

function tabla(cabeceras: string[], filas: (string | number)[][]): string {
  if (filas.length === 0) return '<p style="margin:0 0 16px;color:#6b7280;">Nada este mes.</p>';
  const th = cabeceras
    .map((c, i) => `<th style="text-align:${i === 0 ? 'left' : 'right'};padding:6px 8px;border-bottom:1px solid #d4d4d8;font-size:13px;color:#52525b;">${escaparHtml(c)}</th>`)
    .join('');
  const tr = filas
    .map(
      (f) =>
        `<tr>${f
          .map((v, i) => `<td style="text-align:${i === 0 ? 'left' : 'right'};padding:6px 8px;border-bottom:1px solid #f4f4f5;font-size:14px;${i > 0 ? 'font-variant-numeric:tabular-nums;' : ''}">${escaparHtml(String(v))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;margin:0 0 18px;"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/**
 * El informe del mes anterior para Jefatura y Dirección titular. Agrupa el motivo en «Actividad
 * escolar» / «Personal» (datos de salud): nunca dice el motivo concreto.
 */
export function correoInforme(d: DatosInforme): { subject: string; html: string } {
  const r = d.delMes;
  const cifra = (n: number, t: string, aviso = false) =>
    `<td style="padding:8px 12px;border:1px solid #e4e4e7;border-radius:8px;"><div style="font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:${aviso && n > 0 ? '#b45309' : '#18181b'};">${n}</div><div style="font-size:12px;color:#52525b;">${escaparHtml(t)}</div></td>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;">
  <div style="font-family:${FUENTE};font-size:15px;line-height:1.5;color:#1f2937;max-width:640px;padding:8px 4px;">
    <p style="margin:0 0 14px;">Este es el resumen de sustituciones de <strong>${escaparHtml(nombreMes(d.mes))}</strong>${d.etapa ? ` · ${escaparHtml(d.etapa)}` : ''}.</p>
    <table style="border-collapse:separate;border-spacing:6px;margin:0 0 14px -6px;"><tr>
      ${cifra(r.ausencias, 'ausencias')}${cifra(r.sesiones, 'horas ausentes')}${cifra(r.cubiertas, 'horas cubiertas')}${cifra(r.sinCubrir, 'sin cubrir', true)}
    </tr></table>
    <h3 style="margin:18px 0 6px;font-size:15px;">Horas ausentes por profe</h3>
    ${tabla(['Profe', GRUPO_MOTIVO_NOMBRE.escolar, GRUPO_MOTIVO_NOMBRE.personal, 'Total'], r.porAusente.map((a) => [a.nombre, a.escolar, a.personal, a.total]))}
    <h3 style="margin:18px 0 6px;font-size:15px;">Horas cubiertas por sustituto</h3>
    ${tabla(['Profe', 'Cubiertas', 'De urgencia'], r.porSustituto.map((s) => [s.nombre, s.total, s.urgencia]))}
    <h3 style="margin:18px 0 6px;font-size:15px;">Acumulado del curso ${escaparHtml(d.curso)}</h3>
    ${tabla(['Profe', GRUPO_MOTIVO_NOMBRE.escolar, GRUPO_MOTIVO_NOMBRE.personal, 'Total'], d.delCurso.porAusente.map((a) => [a.nombre, a.escolar, a.personal, a.total]))}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">El detalle, en <a href="${escaparHtml(d.enlace)}" style="color:#1d4ed8;">Sustituciones</a>. Por ser datos de salud, aquí el motivo va agrupado en «Actividad escolar» y «Personal».</p>
  </div>
</body></html>`;
  return { subject: `Sustituciones · ${mayuscula(nombreMes(d.mes))}`, html };
}

// ─── Vista previa y prueba (Ajustes) ─────────────────────────────────────────

/** El aviso con datos de ejemplo (inventados), para la vista previa en vivo y «Enviarme una prueba». */
export function ejemploAviso(tipo: TipoPlantilla, plantilla: Plantilla, quien: string, hoy: string): { subject: string; html: string } {
  const horas: HoraBloque[] = [
    { fecha: hoy, horaInicio: '09:45', horaFin: '10:30', grupos: '2º B', aula: null, materia: 'Matemáticas', quien: 'Lucía' },
    { fecha: hoy, horaInicio: '11:30', horaFin: '12:15', grupos: '2º B', aula: 'Música', materia: 'Música', quien: null },
  ];
  return correoAviso({
    tipo,
    plantilla,
    para: tipo === 'ausente' ? 'Marta' : 'Lucía',
    ausente: 'Marta Ejemplo',
    quien,
    desde: hoy,
    hasta: hoy,
    horas: tipo === 'en_aula' ? horas.slice(0, 1) : horas,
    indicaciones: 'Repasan la ficha 12 del cuadernillo. Las soluciones están en la mesa.',
    confirmacionUrl: tipo === 'sustituto' || tipo === 'en_aula' ? 'https://example.com/sustituciones/confirmar/00000000-0000-4000-8000-000000000000' : undefined,
  });
}
