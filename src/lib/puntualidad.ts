// Helpers puros del módulo Puntualidad (sin IO, testeables).
//
// Aquí vive la aritmética del módulo: cuántos minutos de retraso lleva una llegada, y —lo
// más importante— cómo se lee el historial de un alumno de un vistazo. Esa lectura es la
// razón de ser de la pantalla: no es lo mismo la charla que toca con quien acumula tres
// retrasos esta semana que con quien llegó tarde por última vez hace cinco meses.
import { z } from 'zod';
import { etapaDeCurso } from '@/lib/cursos';

/** Hora a la que se cierran las puertas: a partir de aquí es retraso. */
export const HORA_LIMITE = '08:05';

/** Cada cuántos retrasos NO justificados se avisa al tutor y se pone consecuencia. */
export const RETRASOS_POR_CONSECUENCIA = 3;

export const JUSTIFICACION_TIPOS = [
  { value: 'familiar', label: 'Justificación familiar' },
  { value: 'medico', label: 'Justificante médico / analíticas' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'otro', label: 'Otro' },
] as const;

export type JustificacionTipo = (typeof JUSTIFICACION_TIPOS)[number]['value'];

export function labelJustificacion(tipo: string | null | undefined): string {
  return JUSTIFICACION_TIPOS.find((t) => t.value === tipo)?.label ?? (tipo ?? '');
}

/** 'HH:mm' → minutos desde medianoche, o null si no es una hora válida. */
export function minutosDeHora(hora: string | null | undefined): number | null {
  const m = (hora ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutos desde medianoche → 'HH:mm'. */
export function horaDeMinutos(minutos: number): string {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Hora actual del navegador/servidor en 'HH:mm' (lo que propone el formulario). */
export function horaAhora(fecha = new Date()): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

/**
 * Minutos de retraso de una llegada respecto a la hora límite. Nunca negativo: si alguien
 * llega antes del límite el retraso es 0 (el registro sigue siendo válido — se apunta por
 * lo que sea—, pero no cuenta minutos).
 */
export function minutosRetraso(hora: string, limite: string = HORA_LIMITE): number {
  const llegada = minutosDeHora(hora);
  const tope = minutosDeHora(limite);
  if (llegada === null || tope === null) return 0;
  return Math.max(0, llegada - tope);
}

/** '12' → '12 min'; '75' → '1 h 15 min'. */
export function formatoRetraso(minutos: number): string {
  if (minutos <= 0) return 'a tiempo';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** ¿Este curso entra en el módulo? Decisión de David: solo secundaria (ESO y PDC). */
export function cursoEnPuntualidad(curso: string | null | undefined): boolean {
  return etapaDeCurso(curso) === 'ESO';
}

/** Lo mínimo de un retraso para poder resumir un historial. */
export interface RetrasoHistorial {
  fecha: string; // 'yyyy-MM-dd'
  justificado: boolean;
  /** true si ya se contó en una consecuencia anterior (no cuenta para el ciclo en curso). */
  consumido?: boolean;
}

export interface ResumenHistorial {
  /** Todos los retrasos del curso académico, justificados incluidos. */
  total: number;
  /** Los del mes natural de la fecha de referencia. */
  esteMes: number;
  /** Los de los últimos 7 días (incluida la fecha de referencia). */
  ultimos7: number;
  /** No justificados del curso. */
  noJustificados: number;
  /** Justificados del curso. */
  justificados: number;
  /** No justificados que aún no han entrado en ninguna consecuencia. */
  enCiclo: number;
  /** Cuántos faltan para que el registro que se está guardando dispare consecuencia. */
  faltanParaConsecuencia: number;
  /** Fecha del retraso anterior más reciente ('yyyy-MM-dd'), o null si es el primero. */
  ultimaFecha: string | null;
  /** Días entre el retraso anterior y la fecha de referencia (null si no hay anterior). */
  diasDesdeUltimo: number | null;
  /** Cómo de preocupante es: colorea la tarjeta del formulario. */
  tono: 'primero' | 'lejano' | 'atencion' | 'alerta';
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Resumen del historial de un alumno en el momento de registrarle un retraso nuevo.
 * `retrasos` son los del curso académico en vigor SIN incluir el que se está creando;
 * `hoy` es la fecha del registro ('yyyy-MM-dd').
 *
 * El tono es lo que de verdad usa la interfaz:
 *   - `primero`  → no tiene ninguno este curso.
 *   - `lejano`   → hace más de 30 días del anterior (informativo, sin drama).
 *   - `atencion` → acumula sin justificar, pero aún no llega al ciclo de tres.
 *   - `alerta`   → con el que se está registrando se cierra un ciclo de tres.
 */
export function resumenHistorial(retrasos: readonly RetrasoHistorial[], hoy: string): ResumenHistorial {
  const anteriores = [...retrasos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total = anteriores.length;
  const mes = hoy.slice(0, 7);
  const esteMes = anteriores.filter((r) => r.fecha.slice(0, 7) === mes).length;
  const ultimos7 = anteriores.filter((r) => {
    const d = diasEntre(r.fecha, hoy);
    return d >= 0 && d < 7;
  }).length;
  const noJustificados = anteriores.filter((r) => !r.justificado).length;
  const enCiclo = anteriores.filter((r) => !r.justificado && !r.consumido).length;
  const ultima = anteriores.length ? anteriores[anteriores.length - 1].fecha : null;
  const faltanParaConsecuencia = Math.max(0, RETRASOS_POR_CONSECUENCIA - enCiclo - 1);

  const diasDesdeUltimo = ultima ? diasEntre(ultima, hoy) : null;
  let tono: ResumenHistorial['tono'];
  if (total === 0) tono = 'primero';
  else if (faltanParaConsecuencia === 0) tono = 'alerta';
  else if (diasDesdeUltimo !== null && diasDesdeUltimo > 30) tono = 'lejano';
  else tono = 'atencion';

  return {
    total,
    esteMes,
    ultimos7,
    noJustificados,
    justificados: total - noJustificados,
    enCiclo,
    faltanParaConsecuencia,
    ultimaFecha: ultima,
    diasDesdeUltimo,
    tono,
  };
}

/**
 * La frase que lee el profe mientras registra. Corta a propósito: tiene que caber en una
 * línea del iPad y decir lo único que importa — cuántos lleva y si el anterior fue ayer o
 * en otra vida.
 */
export function fraseHistorial(r: ResumenHistorial, formatoFecha: (iso: string) => string): string {
  if (r.total === 0) return 'Primer retraso del curso.';
  const ordinal = `${r.total + 1}º retraso del curso`;
  if (r.esteMes > 0) {
    const mes = r.esteMes === 1 ? '1 este mes' : `${r.esteMes} este mes`;
    const semana = r.ultimos7 > 1 ? ` · ${r.ultimos7} en los últimos 7 días` : '';
    return `${ordinal} · ${mes}${semana}.`;
  }
  return `${ordinal} · ninguno este mes; el último fue el ${formatoFecha(r.ultimaFecha!)}.`;
}

/** ¿Guardar este registro cierra un ciclo de tres no justificados? */
export function cierraCiclo(enCiclo: number, justificado: boolean): boolean {
  if (justificado) return false;
  return (enCiclo + 1) % RETRASOS_POR_CONSECUENCIA === 0;
}

/** Clave de semana ISO ('2026-W36') — identifica el envío del resumen semanal. */
export function semanaISO(fecha: Date): string {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dow = d.getUTCDay() || 7; // lunes = 1 … domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dow); // jueves de esa semana ISO
  const year = d.getUTCFullYear();
  const enero1 = Date.UTC(year, 0, 1);
  const semana = Math.ceil(((d.getTime() - enero1) / 86_400_000 + 1) / 7);
  return `${year}-W${String(semana).padStart(2, '0')}`;
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

/** 'yyyy-MM-dd' → 0 (lunes) … 6 (domingo). Para el gráfico de días de la semana. */
export function indiceDiaSemana(fecha: string): number {
  const t = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(t)) return 0;
  return (new Date(t).getUTCDay() + 6) % 7;
}

// ─── Payload compartido cliente/servidor ──────────────────────────────────────
// Un envío trae uno o varios alumnos: lo común (fecha, hora, asignatura) va arriba y cada
// alumno puede personalizar lo suyo (justificado, sube a clase, observaciones). El mismo
// schema valida en el formulario antes de enviar y en el route handler al recibir.

export const alumnoRetrasoSchema = z.object({
  eduStudentId: z.string().uuid(),
  subjectId: z.string().uuid().nullable().optional(),
  justificado: z.boolean().optional(),
  justificacionTipo: z.enum(['familiar', 'medico', 'transporte', 'otro']).nullable().optional(),
  justificacionNota: z.string().max(500).nullable().optional(),
  subeAClase: z.boolean().optional(),
  observaciones: z.string().max(1000).nullable().optional(),
});

export const registroPayloadSchema = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
    hora: z.string().regex(/^\d{1,2}:\d{2}$/, 'Hora no válida (formato 08:12)'),
    subjectId: z.string().uuid().nullable().optional(),
    alumnos: z.array(alumnoRetrasoSchema).min(1, 'Elige al menos un alumno').max(40),
  })
  // Con un solo alumno la asignatura es opcional (a veces no se sabe y lo urgente es
  // apuntarlo); en un registro múltiple se exige, porque si no, esos retrasos quedarían
  // todos sin contexto de golpe. Decisión de David.
  .refine((d) => d.alumnos.length === 1 || Boolean(d.subjectId) || d.alumnos.every((a) => a.subjectId), {
    message: 'Al registrar varios alumnos a la vez hay que indicar la asignatura',
    path: ['subjectId'],
  });

export type RegistroPayload = z.infer<typeof registroPayloadSchema>;
