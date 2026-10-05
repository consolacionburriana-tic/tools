// Oratorios y Godly Play: helpers puros (sin IO, testeables). Ficha: docs/26-oratorios.md
//
// Lo que tiene criterio vive aquí, sin BBDD delante, para poder probarlo con casos
// inventados: qué cuenta para el objetivo, qué avisos lleva cada candidato de un hueco, en
// qué orden se proponen y cómo reparte el autocompletar. La pantalla y el servidor solo
// pintan y guardan lo que sale de estas funciones.
//
// Fechas SIEMPRE como 'YYYY-MM-DD' y horas como 'HH:MM', en hora del centro. La aritmética
// de días va en UTC a propósito: `new Date('2026-10-05')` en España es el domingo anterior.
import { z } from 'zod';

import { cursoBaseEso, ETAPA_LABEL, ETAPAS, etapaDeCurso, nivelDeCurso, nombreClase, type Etapa } from '@/lib/cursos';
import { CONFIGURACION } from '@/lib/configuracion';

// ─── Catálogos ───────────────────────────────────────────────────────────────

export const FRECUENCIAS = ['mes', 'trimestre', 'curso'] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];
export const FRECUENCIA_LABELS: Record<Frecuencia, string> = { mes: 'al mes', trimestre: 'al trimestre', curso: 'al curso' };

export const ESTADOS_SESION = ['borrador', 'confirmado', 'reprogramar', 'anulado'] as const;
export type EstadoSesion = (typeof ESTADOS_SESION)[number];

export const ESTADOS_AVISO = ['no', 'pendiente', 'programado', 'enviado'] as const;
export type EstadoAviso = (typeof ESTADOS_AVISO)[number];

export const TIPOS_CORREO = ['aviso', 'cambio', 'anulacion'] as const;
export type TipoCorreo = (typeof TIPOS_CORREO)[number];

export const NIVELES = ['optima', 'alternativa', 'ultima'] as const;
export type Nivel = (typeof NIVELES)[number];
export const NIVEL_INFO: Record<Nivel, { emoji: string; label: string }> = {
  optima: { emoji: '⭐', label: 'Óptima' },
  alternativa: { emoji: '👍', label: 'Alternativa' },
  ultima: { emoji: '🤏', label: 'Último recurso' },
};
/** El toque en una franja de la disponibilidad cicla así. */
export function siguienteNivel(n: Nivel | null): Nivel | null {
  if (n === null) return 'optima';
  if (n === 'optima') return 'alternativa';
  if (n === 'alternativa') return 'ultima';
  return null;
}

export const ETAPAS_ORA = ETAPAS;

/**
 * Pestañas del panel (aquí y no en el componente: la página las valida en el servidor).
 * Ojo con los nombres: `sesiones` es la AGENDA de momentos planificados (lo que se llamó así
 * primero) y `abanico` es lo que David llama «Sesiones»: lo que se hace en cada momento.
 */
export const PESTANAS_ORA = ['planificar', 'sesiones', 'abanico', 'numeros', 'huecos', 'ajustes'] as const;
// Solo las etapas del colegio (`ETAPAS_ORA`): una `BACH` guardada antes de apagarla no se pinta.
export const ETAPA_LABELS: Record<string, string> = Object.fromEntries(
  ETAPAS.map((e) => [e, e === 'ESO' ? 'ESO' : ETAPA_LABEL[e]]),
);

// ─── Tipos de datos (lo que viaja entre servidor y pantalla) ────────────────────

export interface TipoMomento {
  id: string;
  codigo: string;
  nombre: string;
  nombreCorreo: string;
  emoji: string;
  calendarioId: string | null;
  frecuencia: Frecuencia;
  cantidad: number;
  etapas: string[];
  clases: string[] | null;
  textoCorreo: string | null;
  avisoDias: number;
  /** Revisar que ninguna sesión del abanico se repita en la vida escolar del alumno. */
  sinRepetir: boolean;
  orden: number;
  activo: boolean;
}

export interface ProfeAfectado {
  id: string;
  nombre: string;
  materia: string | null;
}

export interface SesionOra {
  id: string;
  tipoId: string;
  academicYear: string;
  curso: string;
  letra: string | null;
  numero: number;
  /** La sesión del abanico que se hace en este momento (null = sin elegir). */
  catalogoId: string | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  responsableEmail: string;
  responsableNombre: string | null;
  profeId: string | null;
  profeNombre: string | null;
  materia: string | null;
  profes: ProfeAfectado[];
  estado: EstadoSesion;
  avisoEstado: EstadoAviso;
  avisoTipo: TipoCorreo;
  avisoProgramadoPara: string | null;
  avisoEnviadoAt: string | null;
  avisoManual: boolean;
  avisoError: string | null;
  googleEventId: string | null;
  calendarioError: string | null;
  notas: string | null;
  historial: { at: string; por: string; que: string; fecha?: string; horaInicio?: string; horaFin?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Clase {
  curso: string;
  letra: string | null;
}

/** Una celda del horario de una clase: a esa hora, qué tiene y quién se la da. */
export interface HuecoHorario {
  periodoId: string;
  curso: string | null; // null = hora sin grupo (guardia, reunión…) — sale en el horario del profe
  letra: string | null;
  dia: number;
  horaInicio: string;
  horaFin: string;
  materia: string | null;
  actividad: string; // código de hor_actividades
  profes: { id: string; nombre: string; titular: boolean }[];
}

export interface TramoRejilla {
  etapa: string;
  dia: number;
  horaInicio: string;
  horaFin: string;
  tipo: string; // 'sesion' | 'recreo' | …
}

export interface Disponibilidad {
  dia: number;
  horaInicio: string;
  horaFin: string;
  nivel: Nivel;
}

export interface Trimestre {
  inicio: string;
  fin: string;
}

export interface Periodo {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  esOrdinario?: boolean;
}

export interface RangoFechas {
  inicio: string;
  fin: string;
}

export interface SalidaDia {
  fecha: string;
  nombre: string;
  clases: string[]; // claves de clase
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

function aUtc(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function deUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function sumarDias(iso: string, n: number): string {
  return deUtc(aUtc(iso) + n * 86_400_000);
}

/** Días de `a` a `b` (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((aUtc(b) - aUtc(a)) / 86_400_000);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(iso: string): number {
  const d = new Date(aUtc(iso)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function lunesDe(iso: string): string {
  return sumarDias(iso, 1 - diaSemana(iso));
}

/** Hoy en el colegio (su zona horaria), como 'YYYY-MM-DD' (el servidor va en UTC). */
export function hoyEnEspana(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIGURACION.calendario.zonaHoraria }).format(ahora);
}

export function aMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** '09:50' → '9:50'. */
export function horaBonita(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1');
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function diaCorto(dia: number): string {
  return DIAS_CORTOS[dia - 1] ?? '';
}

/** 'martes, 14 de octubre'. */
export function fechaLarga(iso: string): string {
  return `${DIAS_LARGOS[diaSemana(iso) - 1]}, ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
}

/** '14 oct'. */
export function fechaCorta(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
}

export function nombreMesCorto(mes: number): string {
  return MESES_CORTOS[mes - 1] ?? '';
}

// ─── Clases ──────────────────────────────────────────────────────────────────

export function claveClase(c: { curso: string | null; letra: string | null }): string {
  return `${c.curso ?? ''}|${c.letra ?? ''}`;
}

export function claseDeClave(clave: string): Clase {
  const [curso, letra] = clave.split('|');
  return { curso, letra: letra || null };
}

/**
 * La clave con la que esa clase aparece en el horario. Coincide con la del alumnado salvo en
 * el PDC: Educamos lo llama '3ºPPDC' y el horario '3ESO' + 'PDC' (ver `cursoBaseEso`).
 */
export function claveHorario(c: Clase): string {
  if (c.letra === 'PDC') return `${cursoBaseEso(c.curso)}|PDC`;
  return claveClase(c);
}

/** '4ESO' + 'B' → '4 ESO B'; '3ºPPDC' → '3º PDC'. Para el título del evento y el correo. */
export function etiquetaClase(c: Clase): string {
  if (c.letra === 'PDC') return `${(cursoBaseEso(c.curso) ?? c.curso).replace(/\D.*$/, '')}º PDC`;
  return nombreClase(c.curso, c.letra).replace(/^(\d+)(º?)\s*([A-Za-zÀ-ÿ])/, '$1$2 $3');
}

/**
 * Las clases a las que va un tipo: su lista fija si la tiene; si no, todas las de sus etapas,
 * PDC incluido (David, 30-sep-2026: «el PDC dentrísimo» — son 10 clases en la ESO).
 */
export function clasesDeTipo(tipo: Pick<TipoMomento, 'clases' | 'etapas'>, alumnado: readonly Clase[]): Clase[] {
  if (tipo.clases && tipo.clases.length > 0) {
    const fijas = new Set(tipo.clases);
    return alumnado.filter((c) => fijas.has(claveClase(c)));
  }
  const etapas = new Set(tipo.etapas);
  return alumnado.filter((c) => etapas.has(etapaDeCurso(c.curso) ?? ''));
}

// ─── Trimestres y unidades del objetivo ────────────────────────────────────────

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
export function pascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Trimestres de partida de un curso ('2026-27'): T1 del inicio al 22-dic, T2 del 7-ene al
 * viernes antes de Ramos, T3 del martes después de Pascua al 19-jun. Se retocan en Ajustes.
 * Las fechas de partida están en `CONFIGURACION.calendario.trimestres`.
 */
export function trimestresPorDefecto(academicYear: string, inicioCurso?: string | null): Trimestre[] {
  const y = Number(academicYear.slice(0, 4));
  const p = pascua(y + 1);
  const t = CONFIGURACION.calendario.trimestres;
  return [
    { inicio: inicioCurso ?? `${y}-${String(CONFIGURACION.calendario.mesInicioCurso).padStart(2, '0')}-01`, fin: `${y}-${t.finT1}` },
    { inicio: `${y + 1}-${t.inicioT2}`, fin: sumarDias(p, t.finT2DiasDesdePascua) },
    { inicio: sumarDias(p, t.inicioT3DiasDesdePascua), fin: `${y + 1}-${t.finT3}` },
  ];
}

/** Índice (0, 1, 2) del trimestre de una fecha, o -1 si cae fuera (vacaciones). */
export function trimestreDe(fecha: string, trimestres: readonly Trimestre[]): number {
  return trimestres.findIndex((t) => t.inicio <= fecha && fecha <= t.fin);
}

export interface Unidad {
  clave: string;
  etiqueta: string;
  inicio: string;
  fin: string;
}

/** Las unidades del objetivo en todo el curso: meses lectivos, trimestres o el curso entero. */
export function unidadesCurso(frecuencia: Frecuencia, trimestres: readonly Trimestre[]): Unidad[] {
  if (trimestres.length === 0) return [];
  const inicio = trimestres[0].inicio;
  const fin = trimestres[trimestres.length - 1].fin;
  if (frecuencia === 'curso') return [{ clave: 'curso', etiqueta: 'Curso', inicio, fin }];
  if (frecuencia === 'trimestre') {
    return trimestres.map((t, i) => ({ clave: `T${i + 1}`, etiqueta: `T${i + 1}`, inicio: t.inicio, fin: t.fin }));
  }
  const unidades: Unidad[] = [];
  let y = Number(inicio.slice(0, 4));
  let m = Number(inicio.slice(5, 7));
  for (;;) {
    const primero = `${y}-${String(m).padStart(2, '0')}-01`;
    if (primero > fin) break;
    const ultimo = sumarDias(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
    const a = primero < inicio ? inicio : primero;
    const b = ultimo > fin ? fin : ultimo;
    // Un mes solo cuenta si tiene algún día dentro de un trimestre (julio y agosto, fuera).
    if (trimestres.some((t) => t.inicio <= b && a <= t.fin)) {
      unidades.push({ clave: primero.slice(0, 7), etiqueta: MESES_CORTOS[m - 1], inicio: a, fin: b });
    }
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
  return unidades;
}

export function unidadDeFecha(unidades: readonly Unidad[], fecha: string): Unidad | null {
  return unidades.find((u) => u.inicio <= fecha && fecha <= u.fin) ?? null;
}

export function unidadesEnRango(unidades: readonly Unidad[], rango: RangoFechas): Unidad[] {
  return unidades.filter((u) => u.inicio <= rango.fin && rango.inicio <= u.fin);
}

/** Rangos de los botones del asistente: este mes y cada trimestre. */
export function rangosRapidos(hoy: string, trimestres: readonly Trimestre[]): { clave: string; etiqueta: string; rango: RangoFechas }[] {
  const mesInicio = `${hoy.slice(0, 7)}-01`;
  const [y, m] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
  const mesFin = sumarDias(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
  return [
    { clave: 'mes', etiqueta: 'Este mes', rango: { inicio: mesInicio, fin: mesFin } },
    ...trimestres.map((t, i) => ({ clave: `T${i + 1}`, etiqueta: `T${i + 1}`, rango: { inicio: t.inicio, fin: t.fin } })),
  ];
}

// ─── Qué cuenta ──────────────────────────────────────────────────────────────

/** Una sesión que ocupa hueco y cuenta para el objetivo: borrador o confirmada. */
export function estaActiva(s: Pick<SesionOra, 'estado'>): boolean {
  return s.estado === 'borrador' || s.estado === 'confirmado';
}

export function esHecha(s: Pick<SesionOra, 'estado' | 'fecha'>, hoy: string): boolean {
  return s.estado === 'confirmado' && s.fecha < hoy;
}

/** Primer número libre de esa clase y tipo en el curso (anular la 2 deja libre el 2). */
export function siguienteNumero(sesiones: readonly Pick<SesionOra, 'tipoId' | 'curso' | 'letra' | 'numero' | 'estado'>[], tipoId: string, clase: Clase): number {
  const clave = claveClase(clase);
  const usados = new Set(
    sesiones.filter((s) => s.tipoId === tipoId && s.estado !== 'anulado' && claveClase(s) === clave).map((s) => s.numero),
  );
  let n = 1;
  while (usados.has(n)) n++;
  return n;
}

export interface CeldaProgreso {
  esperadas: number;
  hechas: number;
  programadas: number;
  borradores: number;
  porHacer: number;
}

export function progresoCelda(sesiones: readonly SesionOra[], cantidad: number, unidad: RangoFechas, hoy: string): CeldaProgreso {
  let hechas = 0;
  let programadas = 0;
  let borradores = 0;
  for (const s of sesiones) {
    if (s.fecha < unidad.inicio || s.fecha > unidad.fin) continue;
    if (s.estado === 'borrador') borradores++;
    else if (s.estado === 'confirmado') {
      if (s.fecha < hoy) hechas++;
      else programadas++;
    }
  }
  return { esperadas: cantidad, hechas, programadas, borradores, porHacer: Math.max(0, cantidad - hechas - programadas - borradores) };
}

export interface FilaProgreso {
  clase: Clase;
  clave: string;
  celdas: CeldaProgreso[];
  total: CeldaProgreso;
}

/** Progreso de un tipo: una fila por clase y una celda por unidad (mes / trimestre / curso). */
export function progresoTipo(
  tipo: Pick<TipoMomento, 'id' | 'cantidad'>,
  clases: readonly Clase[],
  sesiones: readonly SesionOra[],
  unidades: readonly Unidad[],
  hoy: string,
): FilaProgreso[] {
  return clases.map((clase) => {
    const clave = claveClase(clase);
    const suyas = sesiones.filter((s) => s.tipoId === tipo.id && claveClase(s) === clave);
    const celdas = unidades.map((u) => progresoCelda(suyas, tipo.cantidad, u, hoy));
    const total = celdas.reduce<CeldaProgreso>(
      (acc, c) => ({
        esperadas: acc.esperadas + c.esperadas,
        hechas: acc.hechas + c.hechas,
        programadas: acc.programadas + c.programadas,
        borradores: acc.borradores + c.borradores,
        porHacer: acc.porHacer + c.porHacer,
      }),
      { esperadas: 0, hechas: 0, programadas: 0, borradores: 0, porHacer: 0 },
    );
    return { clase, clave, celdas, total };
  });
}

/** Profes de una sesión (lo guardado en `profes`, o el principal si es una fila antigua). */
export function profesDe(s: Pick<SesionOra, 'profes' | 'profeId' | 'profeNombre' | 'materia'>): ProfeAfectado[] {
  if (s.profes && s.profes.length > 0) return s.profes;
  return s.profeId ? [{ id: s.profeId, nombre: s.profeNombre ?? '', materia: s.materia }] : [];
}

export interface Molestias {
  profeId: string;
  nombre: string;
  porTrimestre: number[];
  total: number;
  borradores: number;
}

/**
 * A qué profes se ha quitado la hora, por trimestre. Cuentan las confirmadas (hechas o por
 * venir); los borradores van aparte porque aún no le han molestado a nadie.
 */
export function molestiasPorProfe(sesiones: readonly SesionOra[], trimestres: readonly Trimestre[]): Molestias[] {
  const por = new Map<string, Molestias>();
  for (const s of sesiones) {
    if (!estaActiva(s)) continue;
    for (const p of profesDe(s)) {
      const m = por.get(p.id) ?? { profeId: p.id, nombre: p.nombre, porTrimestre: trimestres.map(() => 0), total: 0, borradores: 0 };
      if (s.estado === 'borrador') m.borradores++;
      else {
        const t = trimestreDe(s.fecha, trimestres);
        if (t >= 0) m.porTrimestre[t]++;
        m.total++;
      }
      por.set(p.id, m);
    }
  }
  return [...por.values()].sort((a, b) => b.total - a.total || b.borradores - a.borradores || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Cuántas fechas hay de cada tipo por mes ('2026-10' → { tipoId → n }). */
export function sesionesPorMes(sesiones: readonly SesionOra[]): Map<string, Map<string, number>> {
  const por = new Map<string, Map<string, number>>();
  for (const s of sesiones) {
    if (!estaActiva(s)) continue;
    const mes = s.fecha.slice(0, 7);
    const fila = por.get(mes) ?? new Map<string, number>();
    fila.set(s.tipoId, (fila.get(s.tipoId) ?? 0) + 1);
    por.set(mes, fila);
  }
  return por;
}

// ─── Días y huecos ───────────────────────────────────────────────────────────

export function esFestivo(fecha: string, festivos: readonly RangoFechas[]): boolean {
  return festivos.some((f) => f.inicio <= fecha && fecha <= f.fin);
}

/** ¿Se puede planificar ese día? Entre semana, dentro de un trimestre y no festivo. */
export function esDiaLectivo(fecha: string, trimestres: readonly Trimestre[], festivos: readonly RangoFechas[]): boolean {
  return diaSemana(fecha) <= 5 && trimestreDe(fecha, trimestres) >= 0 && !esFestivo(fecha, festivos);
}

function solapa(a: { horaInicio: string; horaFin: string }, b: { horaInicio: string; horaFin: string }): boolean {
  return aMin(a.horaInicio) < aMin(b.horaFin) && aMin(b.horaInicio) < aMin(a.horaFin);
}

/** El periodo de horario que manda una fecha (el de más prioridad; si ninguno, el ordinario). */
export function periodoDeFecha(periodos: readonly Periodo[], fecha: string): Periodo | null {
  const vigentes = periodos.filter((p) => p.fechaInicio <= fecha && fecha <= p.fechaFin);
  if (vigentes.length > 0) return vigentes.reduce((a, b) => (b.prioridad > a.prioridad ? b : a));
  return periodos.find((p) => p.esOrdinario) ?? periodos[0] ?? null;
}

/** Índice del horario por clase y día, para no filtrar cientos de filas en cada celda. */
export function indexarHorario(horario: readonly HuecoHorario[]): Map<string, HuecoHorario[]> {
  const idx = new Map<string, HuecoHorario[]>();
  for (const h of horario) {
    if (!h.curso) continue;
    const k = `${h.periodoId}#${claveClase(h)}#${h.dia}`;
    const lista = idx.get(k);
    if (lista) lista.push(h);
    else idx.set(k, [h]);
  }
  return idx;
}

export interface HoraDeClase {
  horaInicio: string;
  horaFin: string;
  profes: ProfeAfectado[];
  materias: string[];
}

/**
 * Qué tiene una clase en una franja de un día concreto, según el horario vigente. Varias filas
 * = desdoble u optativa: todos sus profes pierden esa hora. Los apoyos no cuentan si hay titular.
 */
export function horaDeClase(
  idx: Map<string, HuecoHorario[]>,
  periodos: readonly Periodo[],
  clase: Clase,
  fecha: string,
  franja: { horaInicio: string; horaFin: string },
): HoraDeClase | null {
  const periodo = periodoDeFecha(periodos, fecha);
  if (!periodo) return null;
  const filas = (idx.get(`${periodo.id}#${claveHorario(clase)}#${diaSemana(fecha)}`) ?? []).filter((h) => solapa(h, franja));
  if (filas.length === 0) return null;
  // La hora que se queda es la del tramo de la clase: 1º y 3º de ESO no acaban igual.
  const principal = [...filas].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio))[0];
  const profes: ProfeAfectado[] = [];
  const vistos = new Set<string>();
  for (const f of filas) {
    const titulares = f.profes.some((p) => p.titular) ? f.profes.filter((p) => p.titular) : f.profes;
    for (const p of titulares) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      profes.push({ id: p.id, nombre: p.nombre, materia: f.materia });
    }
  }
  const materias = [...new Set(filas.map((f) => f.materia).filter((m): m is string => Boolean(m)))];
  return { horaInicio: principal.horaInicio, horaFin: principal.horaFin, profes, materias };
}

/** ¿Tiene la persona responsable clase suya a esa hora? (lo que se pinta de gris). */
export function ocupacionPropia(
  horario: readonly HuecoHorario[],
  profeId: string | null,
  periodos: readonly Periodo[],
  fecha: string,
  franja: { horaInicio: string; horaFin: string },
): HuecoHorario[] {
  if (!profeId) return [];
  const periodo = periodoDeFecha(periodos, fecha);
  if (!periodo) return [];
  const dia = diaSemana(fecha);
  return horario.filter((h) => h.periodoId === periodo.id && h.dia === dia && h.profes.some((p) => p.id === profeId) && solapa(h, franja));
}

/** Franjas de la rejilla de unas etapas (filas de la cuadrícula), sin repetir. */
export function franjasDeEtapas(tramos: readonly TramoRejilla[], etapas: readonly string[]): { horaInicio: string; horaFin: string }[] {
  const set = new Set(etapas);
  const vistas = new Map<string, { horaInicio: string; horaFin: string }>();
  for (const t of tramos) {
    if (t.tipo !== 'sesion' || !set.has(t.etapa)) continue;
    vistas.set(`${t.horaInicio}-${t.horaFin}`, { horaInicio: t.horaInicio, horaFin: t.horaFin });
  }
  return [...vistas.values()].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio) || aMin(a.horaFin) - aMin(b.horaFin));
}

export function nivelEn(disp: readonly Disponibilidad[], dia: number, franja: { horaInicio: string; horaFin: string }): Nivel | null {
  const exacta = disp.find((d) => d.dia === dia && d.horaInicio === franja.horaInicio);
  if (exacta) return exacta.nivel;
  return disp.find((d) => d.dia === dia && solapa(d, franja))?.nivel ?? null;
}

// ─── Avisos de un candidato ──────────────────────────────────────────────────

export type NivelAviso = 'rojo' | 'naranja' | 'amarillo' | 'info';
export type CodigoAviso = 'mismo_hueco' | 'mismo_profe' | 'profe_trimestre' | 'mismo_dia' | 'reciente' | 'salida' | 'cubierta' | 'sin_profe';

export interface AvisoCandidato {
  codigo: CodigoAviso;
  nivel: NivelAviso;
  simbolo: string; // lo que se pinta: '🔴', '×2', '⏱️6d'…
  texto: string; // el title al pasar el dedo
}

export interface ContextoPlan {
  tipos: readonly TipoMomento[];
  sesiones: readonly SesionOra[];
  horario: readonly HuecoHorario[];
  idx: Map<string, HuecoHorario[]>;
  periodos: readonly Periodo[];
  trimestres: readonly Trimestre[];
  festivos: readonly RangoFechas[];
  salidas: readonly SalidaDia[];
  hoy: string;
  /** Quien lo lleva: si da clase a ese grupo a esa hora, no es un profe «molestado». */
  responsableProfeId?: string | null;
  // El abanico de sesiones (lo que se hace en cada momento). Sin él, todo funciona como antes.
  /** Curso en el que se planifica ('2026-27'). */
  academicYear?: string;
  catalogo?: readonly SesionCatalogo[];
  /** Niveles de cada tipo ('1ESO'…), para dar por vistas las sesiones de cursos anteriores. */
  nivelesPorTipo?: Readonly<Record<string, readonly string[]>>;
  /** Lo que se hizo en OTROS cursos (momentos confirmados de años anteriores). */
  usosPrevios?: readonly UsoSesion[];
}

export function crearContexto(datos: Omit<ContextoPlan, 'idx'>): ContextoPlan {
  return { ...datos, idx: indexarHorario(datos.horario) };
}

function ordenSesion(s: { fecha: string; horaInicio: string }): string {
  return `${s.fecha} ${s.horaInicio.padStart(5, '0')}`;
}

/** Días mínimos entre dos sesiones seguidas de la misma clase antes de avisar ⏱️. */
export function umbralReciente(frecuencia: Frecuencia): number {
  return frecuencia === 'mes' ? 14 : frecuencia === 'trimestre' ? 28 : 0;
}

export interface EntradaAvisos {
  tipo: TipoMomento;
  clase: Clase;
  fecha: string;
  horaInicio: string;
  profes: readonly ProfeAfectado[];
  excluirId?: string; // la sesión que se está moviendo no se compara consigo misma
}

/**
 * Los avisos de poner esta clase en este hueco. Se miran las sesiones de TODOS los tipos: al
 * profe le da igual si la hora se la quita un oratorio o un Godly Play.
 */
export function avisosCandidato(ctx: ContextoPlan, e: EntradaAvisos, necesita = true): AvisoCandidato[] {
  const avisos: AvisoCandidato[] = [];
  const clave = claveClase(e.clase);
  const yo = ordenSesion(e);
  const deLaClase = ctx.sesiones
    .filter((s) => s.id !== e.excluirId && estaActiva(s) && claveClase(s) === clave)
    .sort((a, b) => ordenSesion(a).localeCompare(ordenSesion(b)));
  const anterior = [...deLaClase].reverse().find((s) => ordenSesion(s) < yo) ?? null;
  const siguiente = deLaClase.find((s) => ordenSesion(s) > yo) ?? null;
  const misProfes = new Set(e.profes.map((p) => p.id));
  const comparte = (s: SesionOra) => profesDe(s).some((p) => misProfes.has(p.id));
  const dia = diaSemana(e.fecha);

  // 🔴 El criterio gordo: misma clase, misma hora de la semana y mismo profe que la de al lado.
  const mismoHueco = [anterior, siguiente].find(
    (s): s is SesionOra => s !== null && diaSemana(s.fecha) === dia && s.horaInicio === e.horaInicio && (misProfes.size === 0 || comparte(s)),
  );
  if (mismoHueco) {
    avisos.push({
      codigo: 'mismo_hueco',
      nivel: 'rojo',
      simbolo: '🔴',
      texto: `Misma hora y mismo profe que la sesión ${mismoHueco.numero} (${fechaCorta(mismoHueco.fecha)})`,
    });
  } else {
    const mismoProfe = [anterior, siguiente].find((s): s is SesionOra => s !== null && misProfes.size > 0 && comparte(s));
    if (mismoProfe) {
      avisos.push({ codigo: 'mismo_profe', nivel: 'amarillo', simbolo: '🟡', texto: `Mismo profe que la sesión ${mismoProfe.numero} (${fechaCorta(mismoProfe.fecha)})` });
    }
  }

  const mismoDia = deLaClase.find((s) => s.fecha === e.fecha);
  if (mismoDia) avisos.push({ codigo: 'mismo_dia', nivel: 'naranja', simbolo: '📅', texto: 'Esta clase ya tiene otra sesión ese día' });

  const umbral = umbralReciente(e.tipo.frecuencia);
  const cercanas = [anterior, siguiente]
    .filter((s): s is SesionOra => s !== null && s.tipoId === e.tipo.id)
    .map((s) => Math.abs(diasEntre(s.fecha, e.fecha)));
  const masCerca = cercanas.length ? Math.min(...cercanas) : null;
  if (masCerca !== null && masCerca > 0 && masCerca < umbral) {
    avisos.push({ codigo: 'reciente', nivel: 'amarillo', simbolo: `⏱️${masCerca}d`, texto: `Solo ${masCerca} días de la sesión más cercana de esta clase` });
  }

  // ×N: cuántas veces lleva ya este profe este trimestre (confirmadas y borradores).
  const t = trimestreDe(e.fecha, ctx.trimestres);
  if (t >= 0 && misProfes.size > 0) {
    const tri = ctx.trimestres[t];
    let max = 0;
    let quien = '';
    for (const p of e.profes) {
      const n = ctx.sesiones.filter(
        (s) => s.id !== e.excluirId && estaActiva(s) && s.fecha >= tri.inicio && s.fecha <= tri.fin && profesDe(s).some((x) => x.id === p.id),
      ).length;
      if (n > max) {
        max = n;
        quien = p.nombre;
      }
    }
    if (max > 0) {
      avisos.push({
        codigo: 'profe_trimestre',
        nivel: max >= 2 ? 'naranja' : 'amarillo',
        simbolo: `×${max}`,
        texto: `${quien} ya lleva ${max} este trimestre`,
      });
    }
  }

  const salida = ctx.salidas.find((s) => s.fecha === e.fecha && s.clases.includes(clave));
  if (salida) avisos.push({ codigo: 'salida', nivel: 'naranja', simbolo: '🚌', texto: `Salida ese día: ${salida.nombre}` });

  if (misProfes.size === 0) avisos.push({ codigo: 'sin_profe', nivel: 'naranja', simbolo: '👤?', texto: 'No se sabe qué profe tiene a esa hora' });

  if (!necesita) avisos.push({ codigo: 'cubierta', nivel: 'info', simbolo: '✓', texto: 'Esta clase ya tiene cubierto el objetivo' });
  return avisos;
}

/** Lo que falta para el objetivo de la unidad (mes / trimestre) que contiene la fecha. */
export function necesidadEnFecha(ctx: ContextoPlan, tipo: TipoMomento, clase: Clase, fecha: string, excluirId?: string): number {
  const unidad = unidadDeFecha(unidadesCurso(tipo.frecuencia, ctx.trimestres), fecha);
  if (!unidad) return 0;
  const clave = claveClase(clase);
  const hay = ctx.sesiones.filter(
    (s) => s.id !== excluirId && s.tipoId === tipo.id && estaActiva(s) && claveClase(s) === clave && s.fecha >= unidad.inicio && s.fecha <= unidad.fin,
  ).length;
  return Math.max(0, tipo.cantidad - hay);
}

export interface Candidato {
  clase: Clase;
  clave: string;
  hora: HoraDeClase;
  necesita: number;
  avisos: AvisoCandidato[];
  puntos: number; // menos = mejor
}

const PESO: Record<NivelAviso, number> = { rojo: 100, naranja: 10, amarillo: 3, info: 0 };

export function puntuar(necesita: number, avisos: readonly AvisoCandidato[]): number {
  let p = necesita > 0 ? 0 : 1000;
  for (const a of avisos) {
    p += PESO[a.nivel];
    // Entre dos con el mismo color, el profe menos molestado primero.
    if (a.codigo === 'profe_trimestre') p += Number(a.simbolo.slice(1)) || 0;
  }
  return p;
}

/** Quién cabe en un hueco (fecha + franja), de mejor a peor. */
export function candidatosHueco(
  ctx: ContextoPlan,
  tipo: TipoMomento,
  clases: readonly Clase[],
  fecha: string,
  franja: { horaInicio: string; horaFin: string },
  excluirId?: string,
): Candidato[] {
  const lista: Candidato[] = [];
  for (const clase of clases) {
    const bruta = horaDeClase(ctx.idx, ctx.periodos, clase, fecha, franja);
    if (!bruta) continue;
    const hora = ctx.responsableProfeId ? { ...bruta, profes: bruta.profes.filter((p) => p.id !== ctx.responsableProfeId) } : bruta;
    const necesita = necesidadEnFecha(ctx, tipo, clase, fecha, excluirId);
    const avisos = avisosCandidato(ctx, { tipo, clase, fecha, horaInicio: hora.horaInicio, profes: hora.profes, excluirId }, necesita > 0);
    lista.push({ clase, clave: claveClase(clase), hora, necesita, avisos, puntos: puntuar(necesita, avisos) });
  }
  return lista.sort((a, b) => a.puntos - b.puntos || a.clave.localeCompare(b.clave, 'es'));
}

// ─── Autocompletar ───────────────────────────────────────────────────────────

export interface Propuesta {
  tipoId: string;
  curso: string;
  letra: string | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  profes: ProfeAfectado[];
  catalogoId?: string | null;
}

/**
 * Reparte un rango de una vez. Primero llena los huecos ⭐ de todos los días, y solo después
 * los 👍 (los 🤏 nunca por sí solo). En cada hueco pone la mejor clase que aún necesite
 * sesión, sin 🔴 ni otra sesión ese día. Lo que propone cuenta para lo siguiente, así que
 * no pone dos veces la misma clase si con una ya cubre.
 */
export function autocompletar(
  ctx: ContextoPlan,
  tipo: TipoMomento,
  clases: readonly Clase[],
  rango: RangoFechas,
  disp: readonly Disponibilidad[],
  responsable: { email: string; profeId: string | null },
  /** Una sesión del abanico para todas las propuestas; si no, la de por defecto de cada clase. */
  forzada: SesionCatalogo | null = null,
): Propuesta[] {
  const propuestas: Propuesta[] = [];
  const sesiones: SesionOra[] = [...ctx.sesiones];
  const local: ContextoPlan = { ...ctx, sesiones };
  // Desde mañana: planificar para hoy mismo no le da tiempo a nadie a enterarse.
  const manana = sumarDias(ctx.hoy, 1);
  const desde = rango.inicio < manana ? manana : rango.inicio;
  const dias: string[] = [];
  for (let d = desde; d <= rango.fin; d = sumarDias(d, 1)) {
    if (esDiaLectivo(d, ctx.trimestres, ctx.festivos)) dias.push(d);
  }
  for (const nivel of ['optima', 'alternativa'] as const) {
    for (const fecha of dias) {
      const huecos = disp.filter((h) => h.nivel === nivel && h.dia === diaSemana(fecha)).sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio));
      for (const hueco of huecos) {
        const ocupado = sesiones.some((s) => estaActiva(s) && s.responsableEmail === responsable.email && s.fecha === fecha && solapa(s, hueco));
        if (ocupado) continue;
        const elegido = candidatosHueco(local, tipo, clases, fecha, hueco).find(
          (c) => c.necesita > 0 && !c.avisos.some((a) => a.codigo === 'mismo_hueco' || a.codigo === 'mismo_dia'),
        );
        if (!elegido) continue;
        const sesionElegida = forzada ?? sesionPorDefecto(opcionesSesion(local, tipo, elegido.clase, fecha));
        const p: Propuesta = {
          tipoId: tipo.id,
          curso: elegido.clase.curso,
          letra: elegido.clase.letra,
          fecha,
          horaInicio: elegido.hora.horaInicio,
          horaFin: elegido.hora.horaFin,
          profes: elegido.hora.profes,
          catalogoId: sesionElegida?.id ?? null,
        };
        propuestas.push(p);
        sesiones.push(sesionDePropuesta(p, responsable.email, `prop-${propuestas.length}`, ctx.academicYear));
      }
    }
  }
  return propuestas.sort((a, b) => ordenSesion(a).localeCompare(ordenSesion(b)));
}

/** Una propuesta con forma de sesión en borrador (para que cuente en los cálculos). */
export function sesionDePropuesta(p: Propuesta, responsableEmail: string, id: string, academicYear = ''): SesionOra {
  return {
    id,
    tipoId: p.tipoId,
    academicYear,
    curso: p.curso,
    letra: p.letra,
    numero: 0,
    catalogoId: p.catalogoId ?? null,
    fecha: p.fecha,
    horaInicio: p.horaInicio,
    horaFin: p.horaFin,
    responsableEmail,
    responsableNombre: null,
    profeId: p.profes[0]?.id ?? null,
    profeNombre: p.profes[0]?.nombre ?? null,
    materia: p.profes[0]?.materia ?? null,
    profes: p.profes,
    estado: 'borrador',
    avisoEstado: 'no',
    avisoTipo: 'aviso',
    avisoProgramadoPara: null,
    avisoEnviadoAt: null,
    avisoManual: false,
    avisoError: null,
    googleEventId: null,
    calendarioError: null,
    notas: null,
    historial: [],
    createdAt: '',
    updatedAt: '',
  };
}

// ─── El abanico: lo que se hace en cada momento ──────────────────────────────────
//
// Cada tipo tiene un abanico de 10-15 SESIONES (lo que se hace en el oratorio, no el momento en
// sí) y la regla es que ningún alumno vea la misma dos veces en su vida escolar. «Su vida
// escolar» se mide por GENERACIONES: un grupo de alumnos que avanza junto (el que hoy está en
// 3º de ESO estuvo en 2º el curso pasado y en 1º el anterior) tiene siempre el mismo
// «año de inicio − posición en el camino». Una sesión choca con una clase si esa generación ya
// la hizo, en el curso que sea; así «la primera vez» se puede repetir cada año en 1º (alumnos
// nuevos) y una sesión que se hace en todos los cursos queda fuera de juego hasta que esos
// alumnos se han ido.

/** Una sesión del abanico de un tipo: lo que se hace en el momento. */
export interface SesionCatalogo {
  id: string;
  tipoId: string;
  nombre: string;
  enlace: string | null;
  /** Curso en que se hizo ('2024-25'); null = todavía no. */
  academicYear: string | null;
  /** Niveles a los que va ('1ESO'…); null = todos los del tipo. */
  cursos: string[] | null;
  orden: number;
  activo: boolean;
}

/** Un nivel concreto que hizo una sesión del abanico en un curso. */
export interface UsoSesion {
  catalogoId: string;
  academicYear: string;
  curso: string; // nivel: '3ESO'
  letra: string | null; // null = todas las clases de ese nivel
}

/** Cuántos cursos anteriores se pueden elegir como mínimo (David: «los 4 anteriores»). */
export const ANIOS_ATRAS = 4;

/** Nivel de un curso del alumnado: '3ºPPDC' → '3ESO'; el resto, tal cual. */
export function nivelDe(curso: string): string {
  return cursoBaseEso(curso) ?? curso;
}

const ETAPA_CORTA: Record<Etapa, string> = { EI: 'Inf.', EP: 'Prim.', ESO: 'ESO', BACH: 'Bach.' };

/** '3ESO' → '3º ESO'; '4INF' → '4º Inf.'. */
export function etiquetaNivel(nivel: string): string {
  const etapa = etapaDeCurso(nivel);
  const n = nivelDeCurso(nivel);
  return etapa && n !== 99 ? `${n}º ${ETAPA_CORTA[etapa]}` : nivel;
}

/** Posición de un nivel en el camino entero del alumno (infantil → bachillerato), o null. */
export function ordinalNivel(curso: string): number | null {
  const nivel = nivelDe(curso);
  const etapa = etapaDeCurso(nivel);
  if (!etapa) return null;
  const n = nivelDeCurso(nivel);
  const { min, max } = CONFIGURACION.niveles[etapa];
  if (n < min || n > max) return null;
  let antes = 0;
  for (const e of ETAPAS) {
    if (e === etapa) break;
    antes += CONFIGURACION.niveles[e].max - CONFIGURACION.niveles[e].min + 1;
  }
  return antes + (n - min);
}

/** Los niveles de un tipo, en orden: los de sus clases ('3ºPPDC' cuenta como 3ESO). */
export function nivelesDeTipo(tipo: Pick<TipoMomento, 'clases' | 'etapas'>, alumnado: readonly Clase[]): string[] {
  const niveles = new Set(clasesDeTipo(tipo, alumnado).map((c) => nivelDe(c.curso)));
  return [...niveles].sort((a, b) => (ordinalNivel(a) ?? 99) - (ordinalNivel(b) ?? 99));
}

export function anioInicio(academicYear: string): number {
  return Number(academicYear.slice(0, 4));
}

/** 2024 → '2024-25'. */
export function cursoAcademico(inicio: number): string {
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/**
 * Los cursos que se pueden elegir como «el curso en que se hizo»: los anteriores (cuatro como
 * mínimo, y tantos como niveles tenga el camino del tipo menos uno: en Godly Play, de infantil a
 * 6º, un alumno lleva hasta ocho cursos), el actual y el siguiente.
 */
export function cursosAcademicosElegibles(actual: string, niveles = 0): string[] {
  const y = anioInicio(actual);
  const atras = Math.max(ANIOS_ATRAS, niveles - 1);
  const cursos: string[] = [];
  for (let i = y - atras; i <= y + 1; i++) cursos.push(cursoAcademico(i));
  return cursos;
}

/** La generación de un grupo: constante mientras los mismos alumnos avanzan juntos. */
export function generacion(curso: string, academicYear: string): number | null {
  const o = ordinalNivel(curso);
  const y = anioInicio(academicYear);
  return o === null || Number.isNaN(y) ? null : y - o;
}

/** Los usos de una sesión que ya vieron los alumnos de esta clase (en este curso o en otro). */
export function usosQueChocan(usos: readonly UsoSesion[], catalogoId: string, clase: Clase, academicYear: string): UsoSesion[] {
  const g = generacion(clase.curso, academicYear);
  if (g === null) return [];
  return usos.filter((u) => {
    if (u.catalogoId !== catalogoId || generacion(u.curso, u.academicYear) !== g) return false;
    // En el mismo curso, 1º A y 1º B son alumnos distintos; de un curso a otro los grupos se mezclan.
    return !(u.academicYear === academicYear && u.letra !== null && clase.letra !== null && u.letra !== clase.letra);
  });
}

/** 'La vio 3º ESO en 2025-26 · 4º ESO en 2025-26'. */
export function describirUsos(usos: readonly UsoSesion[]): string {
  return usos.map((u) => `${etiquetaNivel(u.curso)}${u.letra ? ` ${u.letra}` : ''} (${u.academicYear})`).join(' · ');
}

/** Lo planificado en la app (borradores y confirmadas) como usos de sesiones del abanico. */
export function usosDeSesiones(
  sesiones: readonly Pick<SesionOra, 'catalogoId' | 'estado' | 'academicYear' | 'curso' | 'letra'>[],
  academicYear: string,
): UsoSesion[] {
  const usos: UsoSesion[] = [];
  for (const s of sesiones) {
    if (!s.catalogoId || !estaActiva(s)) continue;
    usos.push({ catalogoId: s.catalogoId, academicYear: s.academicYear || academicYear, curso: nivelDe(s.curso), letra: s.letra });
  }
  return usos;
}

/**
 * Lo que se hizo ANTES de que la app lo supiera: una sesión con curso anterior al actual cuenta
 * como hecha ese curso por los niveles a los que va (o por todos los del tipo). El curso en
 * marcha cuenta por lo que se planifica, no por esto.
 */
export function usosHistoricos(
  catalogo: readonly SesionCatalogo[],
  nivelesPorTipo: Readonly<Record<string, readonly string[]>>,
  academicYear: string,
): UsoSesion[] {
  const usos: UsoSesion[] = [];
  for (const s of catalogo) {
    if (!s.academicYear || anioInicio(s.academicYear) >= anioInicio(academicYear)) continue;
    for (const nivel of s.cursos ?? nivelesPorTipo[s.tipoId] ?? []) {
      usos.push({ catalogoId: s.id, academicYear: s.academicYear, curso: nivel, letra: null });
    }
  }
  return usos;
}

/**
 * Todo lo que ya se ha hecho: otros cursos, el historial del abanico y lo planificado ahora.
 * Sin caché a propósito: `autocompletar` va añadiendo propuestas a `ctx.sesiones` y cada una
 * tiene que contar para la siguiente.
 */
export function usosVigentes(ctx: ContextoPlan, excluirId?: string): UsoSesion[] {
  const anio = ctx.academicYear ?? '';
  return [
    ...(ctx.usosPrevios ?? []),
    ...usosHistoricos(ctx.catalogo ?? [], ctx.nivelesPorTipo ?? {}, anio),
    ...usosDeSesiones(excluirId ? ctx.sesiones.filter((s) => s.id !== excluirId) : ctx.sesiones, anio),
  ];
}

export interface OpcionSesion {
  sesion: SesionCatalogo;
  /** ¿Va a este nivel? */
  aplicable: boolean;
  /** Quién la vio ya (vacío si el tipo no revisa repeticiones). */
  choques: UsoSesion[];
  /** Cuántas veces se ha elegido ya en esta unidad (mes / trimestre) del tipo. */
  enLaUnidad: number;
  /** Último curso en que se hizo, con cualquier clase. */
  ultimoUso: string | null;
}

/** Las sesiones del abanico de un tipo, con lo que importa para elegir una para esta clase y fecha. */
export function opcionesSesion(ctx: ContextoPlan, tipo: TipoMomento, clase: Clase, fecha: string, excluirId?: string): OpcionSesion[] {
  const abanico = (ctx.catalogo ?? []).filter((s) => s.tipoId === tipo.id && s.activo);
  if (abanico.length === 0) return [];
  const anio = ctx.academicYear ?? '';
  const usos = usosVigentes(ctx, excluirId);
  const unidad = unidadDeFecha(unidadesCurso(tipo.frecuencia, ctx.trimestres), fecha);
  const nivel = nivelDe(clase.curso);
  return abanico.map((sesion) => {
    const suyos = usos.filter((u) => u.catalogoId === sesion.id);
    const enLaUnidad = unidad
      ? ctx.sesiones.filter(
          (s) => s.id !== excluirId && s.tipoId === tipo.id && s.catalogoId === sesion.id && estaActiva(s) && s.fecha >= unidad.inicio && s.fecha <= unidad.fin,
        ).length
      : 0;
    return {
      sesion,
      aplicable: sesion.cursos === null || sesion.cursos.includes(nivel),
      choques: tipo.sinRepetir ? usosQueChocan(suyos, sesion.id, clase, anio) : [],
      enLaUnidad,
      ultimoUso: suyos.reduce<string | null>((ultimo, u) => (ultimo === null || u.academicYear > ultimo ? u.academicYear : ultimo), null),
    };
  });
}

/**
 * De mejor a peor para esa clase: las que van a su nivel y no ha visto nadie; las hechas a
 * medida para ese nivel («la primera vez»); la que ya se ha elegido para otras clases en la misma
 * unidad (lo normal es que se repita lo mismo en todas); la que lleva más tiempo sin hacerse.
 */
export function ordenarOpciones(opciones: readonly OpcionSesion[]): OpcionSesion[] {
  return [...opciones].sort(
    (a, b) =>
      Number(b.aplicable) - Number(a.aplicable) ||
      Number(a.choques.length > 0) - Number(b.choques.length > 0) ||
      Number(b.sesion.cursos !== null) - Number(a.sesion.cursos !== null) ||
      b.enLaUnidad - a.enLaUnidad ||
      (a.ultimoUso ?? '').localeCompare(b.ultimoUso ?? '') ||
      a.sesion.orden - b.sesion.orden ||
      a.sesion.nombre.localeCompare(b.sesion.nombre, 'es'),
  );
}

/** La que se propone sola: la primera que va a ese nivel y no se repite; si no hay, ninguna. */
export function sesionPorDefecto(opciones: readonly OpcionSesion[]): SesionCatalogo | null {
  const mejor = ordenarOpciones(opciones)[0];
  return mejor && mejor.aplicable && mejor.choques.length === 0 ? mejor.sesion : null;
}

/** ¿Es una URL que se puede enseñar como enlace? Solo http(s): nunca `javascript:`. */
export function esEnlaceSeguro(valor: string): boolean {
  try {
    const u = new URL(valor);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Clases del tipo que no están en NINGÚN horario importado (hoy el PDC, y en Godly Play todo
 * infantil y primaria): el asistente no sabe a qué hora tienen clase y no las puede proponer.
 */
export function clasesSinHorario(clases: readonly Clase[], horario: readonly Pick<HuecoHorario, 'curso' | 'letra'>[]): Clase[] {
  const conHorario = new Set<string>();
  for (const h of horario) if (h.curso) conHorario.add(claveClase(h));
  return clases.filter((c) => !conHorario.has(claveHorario(c)));
}

// ─── Evento y aviso ──────────────────────────────────────────────────────────

/** `[4 ESO B] Oratorio - Ana García` (con varios profes, separados por « / »). */
export function tituloEvento(tipo: Pick<TipoMomento, 'nombre'>, s: Pick<SesionOra, 'curso' | 'letra' | 'profes' | 'profeId' | 'profeNombre' | 'materia'>): string {
  const nombres = profesDe(s).map((p) => p.nombre).filter(Boolean);
  const base = `[${etiquetaClase(s)}] ${tipo.nombre}`;
  return nombres.length ? `${base} - ${nombres.join(' / ')}` : base;
}

/**
 * Cuándo sale el aviso al confirmar: N días antes. Si ese día ya ha pasado (la sesión es muy
 * pronto), queda pendiente para mandarlo a mano ya.
 */
export function avisoAlConfirmar(fecha: string, dias: number, hoy: string): { avisoEstado: EstadoAviso; avisoProgramadoPara: string | null } {
  const dia = sumarDias(fecha, -dias);
  if (dia <= hoy) return { avisoEstado: 'pendiente', avisoProgramadoPara: null };
  return { avisoEstado: 'programado', avisoProgramadoPara: dia };
}

export interface Chip {
  emoji: string;
  texto: string;
  tono: 'zinc' | 'blue' | 'emerald' | 'amber' | 'violet' | 'sky' | 'rose';
}

export function chipEstado(s: Pick<SesionOra, 'estado' | 'fecha'>, hoy: string): Chip {
  if (s.estado === 'borrador') return { emoji: '📝', texto: 'Borrador', tono: 'zinc' };
  if (s.estado === 'reprogramar') return { emoji: '🔁', texto: 'Reprogramar', tono: 'violet' };
  if (s.estado === 'anulado') return { emoji: '✖️', texto: 'Anulada', tono: 'rose' };
  return s.fecha < hoy ? { emoji: '✔️', texto: 'Hecha', tono: 'emerald' } : { emoji: '✅', texto: 'Confirmada', tono: 'blue' };
}

export function chipAviso(s: Pick<SesionOra, 'avisoEstado' | 'avisoTipo' | 'avisoProgramadoPara' | 'avisoManual'>): Chip | null {
  const que = s.avisoTipo === 'cambio' ? ' cambio' : s.avisoTipo === 'anulacion' ? ' anulación' : '';
  if (s.avisoEstado === 'pendiente') return { emoji: '✉️', texto: `Avisar${que}`, tono: 'amber' };
  if (s.avisoEstado === 'programado') return { emoji: '⏰', texto: s.avisoProgramadoPara ? fechaCorta(s.avisoProgramadoPara) : 'Programado', tono: 'sky' };
  if (s.avisoEstado === 'enviado') return { emoji: s.avisoManual ? '✋' : '📨', texto: s.avisoManual ? 'Dicho' : 'Avisado', tono: 'emerald' };
  return null;
}

/** Qué correo toca cuando una sesión cambia de fecha o se anula. */
export function avisoTrasCambio(
  s: Pick<SesionOra, 'avisoEstado'>,
  que: 'mover' | 'anular',
): { avisoEstado: EstadoAviso; avisoTipo: TipoCorreo } | null {
  const yaAvisado = s.avisoEstado === 'enviado';
  if (que === 'anular') return yaAvisado ? { avisoEstado: 'pendiente', avisoTipo: 'anulacion' } : { avisoEstado: 'no', avisoTipo: 'aviso' };
  return yaAvisado ? { avisoEstado: 'pendiente', avisoTipo: 'cambio' } : null;
}

// ─── Validación de lo que entra por la red ────────────────────────────────────

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const hora = z.string().regex(/^\d{1,2}:\d{2}$/, 'Hora no válida');
const profeAfectado = z.object({ id: z.string().uuid(), nombre: z.string().max(200), materia: z.string().max(200).nullable() });

export const nuevaSesionSchema = z.object({
  tipoId: z.string().uuid(),
  curso: z.string().min(1).max(20),
  letra: z.string().max(10).nullable(),
  fecha: fechaIso,
  horaInicio: hora,
  horaFin: hora,
  profes: z.array(profeAfectado).max(10),
  responsableEmail: z.string().email(),
  notas: z.string().max(1000).nullable().optional(),
  catalogoId: z.string().uuid().nullable().optional(),
});
export const crearSesionesSchema = z.object({ sesiones: z.array(nuevaSesionSchema).min(1).max(300) });
export type NuevaSesion = z.infer<typeof nuevaSesionSchema>;

export const accionSesionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('mover'), fecha: fechaIso, horaInicio: hora, horaFin: hora, profes: z.array(profeAfectado).max(10) }),
  z.object({ accion: z.literal('reprogramar') }),
  z.object({ accion: z.literal('anular') }),
  z.object({ accion: z.literal('notas'), notas: z.string().max(1000).nullable() }),
  z.object({ accion: z.literal('profes'), profes: z.array(profeAfectado).max(10) }),
  z.object({ accion: z.literal('catalogo'), catalogoId: z.string().uuid().nullable() }),
]);
export type AccionSesion = z.infer<typeof accionSesionSchema>;

export const ACCIONES_LOTE = ['confirmar', 'descartar', 'calendario', 'enviar', 'programar', 'manual', 'no_avisar'] as const;
export type AccionLote = (typeof ACCIONES_LOTE)[number];
export const accionLoteSchema = z.object({
  accion: z.enum(ACCIONES_LOTE),
  ids: z.array(z.string().uuid()).min(1).max(300),
  dias: z.number().int().min(0).max(60).optional(),
});

export const disponibilidadSchema = z.object({
  responsableEmail: z.string().email(),
  huecos: z
    .array(z.object({ dia: z.number().int().min(1).max(5), horaInicio: hora, horaFin: hora, nivel: z.enum(NIVELES) }))
    .max(100),
});

export const tipoSchema = z.object({
  codigo: z.string().regex(/^[a-z0-9_-]{2,30}$/, 'Código: minúsculas, sin espacios'),
  nombre: z.string().min(1).max(60),
  nombreCorreo: z.string().min(1).max(60),
  emoji: z.string().min(1).max(8),
  calendarioId: z.string().max(300).nullable(),
  frecuencia: z.enum(FRECUENCIAS),
  cantidad: z.number().int().min(1).max(20),
  etapas: z.array(z.enum(ETAPAS_ORA)),
  clases: z.array(z.string().max(30)).nullable(),
  textoCorreo: z.string().max(2000).nullable(),
  avisoDias: z.number().int().min(0).max(60),
  sinRepetir: z.boolean(),
  activo: z.boolean(),
});
export type EntradaTipo = z.infer<typeof tipoSchema>;

export const ajustesSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{2}$/),
  trimestres: z.array(z.object({ inicio: fechaIso, fin: fechaIso })).length(3).optional(),
  accesoComun: z.boolean().optional(),
});

export const sesionCatalogoSchema = z.object({
  tipoId: z.string().uuid(),
  nombre: z.string().trim().min(1, 'Ponle un nombre').max(120),
  enlace: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || esEnlaceSeguro(v), 'El enlace tiene que empezar por https://')
    .nullable(),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  cursos: z.array(z.string().regex(/^\d(INF|PRI|ESO|BACH)$/)).max(20).nullable(),
  activo: z.boolean(),
});
export type EntradaSesionCatalogo = z.infer<typeof sesionCatalogoSchema>;
