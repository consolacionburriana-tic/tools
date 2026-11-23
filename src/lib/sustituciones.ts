// Sustituciones del profesorado: lógica PURA (sin IO), con tests en `__tests__/sustituciones.test.ts`.
// Ficha: docs/32-sustituciones.md. Las consultas viven en `sustituciones-server.ts` y los correos en
// `sustituciones-email.ts`; aquí está todo lo que tiene criterio, para poder probarlo con casos
// inventados: qué horario manda en una fecha, qué horas del ausente hay que cubrir, quién puede
// cubrir cada una y en qué orden, la disponibilidad de cada profe, las plantillas y las cuentas.
//
// Fechas SIEMPRE 'YYYY-MM-DD' y horas 'HH:mm', en hora del centro. Se compara por SOLAPE de horas,
// nunca por tramo u orden: cada etapa tiene su rejilla (la 2ª de EP no es la 2ª de EI).
import { z } from 'zod';

import { CONFIGURACION, type NivelSustitucionConfig } from '@/lib/configuracion';
import { etapaDeCurso, ETAPA_LABEL, nivelDeCurso, type Etapa } from '@/lib/cursos';
import { aMin, diaSemana, sumarDias } from '@/lib/oratorios';
import { canAccess, type Acceso } from '@/lib/permissions';
import { esVigente, type CoberturaBajaBase } from '@/lib/coberturas-baja';

export type ConfigSustituciones = typeof CONFIGURACION.sustituciones;
const CFG: ConfigSustituciones = CONFIGURACION.sustituciones;

// ─── Catálogos ───────────────────────────────────────────────────────────────

export const DISPONIBILIDADES = ['si', 'si_hace_falta', 'urgencia', 'no'] as const;
export type Disponibilidad = (typeof DISPONIBILIDADES)[number];

export const DISPONIBILIDAD_INFO: Record<Disponibilidad, { nombre: string; frase: string }> = {
  si: { nombre: 'Sí', frase: 'Intentamos que sí' },
  si_hace_falta: { nombre: 'Si hace falta', frase: 'Disponible' },
  urgencia: { nombre: 'Solo urgencia', frase: 'Si no hay otra, pero intentamos que no' },
  no: { nombre: 'No', frase: 'No se le propone' },
};

const RANGO_DISP: Record<Disponibilidad, number> = { si: 0, si_hace_falta: 1, urgencia: 2, no: 3 };

/** La peor de dos disponibilidades (la que menos propone). */
export function peorDisponibilidad(a: Disponibilidad, b: Disponibilidad): Disponibilidad {
  return RANGO_DISP[a] >= RANGO_DISP[b] ? a : b;
}

export const ESTADOS_AUSENCIA = ['confirmada', 'anulada'] as const;
export type EstadoAusencia = (typeof ESTADOS_AUSENCIA)[number];

export const ESTADOS_AVISO = ['no', 'programado', 'enviado', 'error'] as const;
export type EstadoAvisoSust = (typeof ESTADOS_AVISO)[number];

/** Claves de nivel que no salen de la lista: el codocente de la misma sesión, la hora libre y lo elegido a mano. */
export const NIVEL_EN_AULA = 'en_aula';
export const NIVEL_LIBRE = 'libre';
export const NIVEL_MANUAL = 'manual';

/** El nombre corto de un nivel («Codocencia», «Ya está en el aula»…). */
export function nombreNivel(clave: string | null | undefined, cfg: ConfigSustituciones = CFG): string {
  if (!clave) return 'Tiene clase';
  if (clave === NIVEL_EN_AULA) return 'Ya está en el aula';
  if (clave === NIVEL_LIBRE) return 'Hora libre';
  if (clave === NIVEL_MANUAL) return 'Elegido a mano';
  return cfg.niveles.find((n) => n.clave === clave)?.nombre ?? clave;
}

/** Posición de un nivel en el orden (menos = antes). `en_aula` va el primero; sin nivel, el último. */
export function rangoNivel(clave: string | null | undefined, cfg: ConfigSustituciones = CFG): number {
  if (clave === NIVEL_EN_AULA) return -1;
  if (clave === NIVEL_LIBRE) return cfg.niveles.length;
  if (clave === NIVEL_MANUAL || !clave) return cfg.niveles.length + 1;
  const i = cfg.niveles.findIndex((n) => n.clave === clave);
  return i === -1 ? cfg.niveles.length + 1 : i;
}

// ─── Motivos (y datos de salud) ──────────────────────────────────────────────

export type GrupoMotivo = 'escolar' | 'personal';

export function nombreMotivo(clave: string, cfg: ConfigSustituciones = CFG): string {
  return cfg.motivos.find((m) => m.clave === clave)?.nombre ?? clave;
}

export function esMotivo(clave: unknown, cfg: ConfigSustituciones = CFG): clave is string {
  return typeof clave === 'string' && cfg.motivos.some((m) => m.clave === clave);
}

/**
 * En cifras e informes el motivo va agrupado (decisión 11): «Actividad escolar» o «Personal».
 * El motivo concreto (casi siempre un dato de salud) solo se ve dentro del módulo.
 */
export function agruparMotivo(clave: string, cfg: ConfigSustituciones = CFG): GrupoMotivo {
  return cfg.motivos.find((m) => m.clave === clave)?.escolar ? 'escolar' : 'personal';
}

export const GRUPO_MOTIVO_NOMBRE: Record<GrupoMotivo, string> = { escolar: 'Actividad escolar', personal: 'Personal' };

// ─── Horas ───────────────────────────────────────────────────────────────────

export interface Franja {
  horaInicio: string;
  horaFin: string;
}

export function solapa(a: Franja, b: Franja): boolean {
  return aMin(a.horaInicio) < aMin(b.horaFin) && aMin(b.horaInicio) < aMin(a.horaFin);
}

/** '09:50' → '9:50'. */
export function hora(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1');
}

/** Normaliza para comparar etiquetas: mayúsculas, sin acentos, espacios simples. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dia = (iso: string) => Number(iso.slice(8, 10));
const mes = (iso: string) => Number(iso.slice(5, 7));

/** 'martes 17 de noviembre'. */
export function fechaLarga(iso: string): string {
  return `${DIAS[diaSemana(iso) - 1]} ${dia(iso)} de ${MESES[mes(iso) - 1]}`;
}

/** 'mar 17 nov'. */
export function fechaCorta(iso: string): string {
  return `${DIAS_CORTOS[diaSemana(iso) - 1]} ${dia(iso)} ${MESES_CORTOS[mes(iso) - 1]}`;
}

/** 'el martes 17 de noviembre' o 'del martes 17 al jueves 19 de noviembre'. */
export function rangoLargo(desde: string, hasta: string): string {
  if (desde === hasta) return `el ${fechaLarga(desde)}`;
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  const ini = mismoMes ? `${DIAS[diaSemana(desde) - 1]} ${dia(desde)}` : fechaLarga(desde);
  return `del ${ini} al ${fechaLarga(hasta)}`;
}

/** '17 nov' o 'del 17 al 19 nov' o 'del 30 nov al 2 dic'. */
export function rangoCorto(desde: string, hasta: string): string {
  if (desde === hasta) return fechaCorta(desde);
  if (desde.slice(0, 7) === hasta.slice(0, 7)) return `del ${dia(desde)} al ${dia(hasta)} ${MESES_CORTOS[mes(hasta) - 1]}`;
  return `del ${dia(desde)} ${MESES_CORTOS[mes(desde) - 1]} al ${dia(hasta)} ${MESES_CORTOS[mes(hasta) - 1]}`;
}

/** 'octubre de 2026' para '2026-10'. */
export function nombreMes(mesIso: string): string {
  return `${MESES[Number(mesIso.slice(5, 7)) - 1]} de ${mesIso.slice(0, 4)}`;
}

/** El mes anterior a una fecha, 'YYYY-MM'. */
export function mesAnterior(hoy: string): string {
  const y = Number(hoy.slice(0, 4));
  const m = Number(hoy.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Curso académico de una fecha ('2026-11-17' → '2026-27'), con el mes de inicio de la configuración. */
export function cursoDeFecha(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const inicio = mes(iso) >= CONFIGURACION.calendario.mesInicioCurso ? y : y - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

export interface RangoFestivo {
  inicio: string;
  fin: string;
  nombre?: string;
}

export interface DiaSaltado {
  fecha: string;
  porque: 'finde' | 'festivo';
  nombre?: string;
}

/** Los días lectivos de un rango (ni sábado, ni domingo, ni festivo), y los que se saltan con su porqué. */
export function diasLectivos(desde: string, hasta: string, festivos: readonly RangoFestivo[]): { lectivos: string[]; saltados: DiaSaltado[] } {
  const lectivos: string[] = [];
  const saltados: DiaSaltado[] = [];
  if (!desde || !hasta || hasta < desde) return { lectivos, saltados };
  // Tope de seguridad: un rango absurdo no se recorre entero.
  for (let f = desde, n = 0; f <= hasta && n < 400; f = sumarDias(f, 1), n++) {
    if (diaSemana(f) > 5) {
      saltados.push({ fecha: f, porque: 'finde' });
      continue;
    }
    const fest = festivos.find((x) => x.inicio <= f && f <= x.fin);
    if (fest) saltados.push({ fecha: f, porque: 'festivo', nombre: fest.nombre });
    else lectivos.push(f);
  }
  return { lectivos, saltados };
}

/** ¿Se pasa del tope de días lectivos? (más largo = una cobertura por baja). */
export function excedeTope(lectivos: readonly string[], cfg: ConfigSustituciones = CFG): boolean {
  return lectivos.length > cfg.maxDiasAusencia;
}

// ─── Qué horario manda en una fecha (decisión 4) ─────────────────────────────

export interface PeriodoHorario {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  esOrdinario: boolean;
}

export interface RejillaHorario {
  id: string;
  periodoId: string;
  /** Sus ámbitos: etapa (o curso, del que sale la etapa). Todo a null = centro entero. */
  ambitos: { etapa: string | null; curso: string | null }[];
}

/** Una rejilla de «centro entero»: sin ámbitos, o con un ámbito todo a null. */
function esDeCentro(r: RejillaHorario): boolean {
  return r.ambitos.length === 0 || r.ambitos.some((a) => !a.etapa && !a.curso);
}

/** ¿Es una rejilla PROPIA de esa etapa? (su ámbito la nombra, o nombra un curso suyo). La de centro no cuenta. */
function rejillaDeEtapa(r: RejillaHorario, etapa: Etapa): boolean {
  return r.ambitos.some((a) => (a.etapa ?? etapaDeCurso(a.curso)) === etapa);
}

export interface HorarioDeFecha {
  /** Las rejillas cuyas sesiones cuentan ese día. */
  rejillas: Set<string>;
  /** Por etapa, el periodo que manda (null = ninguno: no hay horario). */
  porEtapa: { etapa: Etapa; periodo: PeriodoHorario | null; ordinarioDeRespaldo: boolean }[];
}

/**
 * Para cada etapa, de los periodos que contienen la fecha y tienen rejilla de esa etapa, gana el de
 * más prioridad. Si ninguno la tiene, se mantiene el ORDINARIO (David, 13-nov-2026): en septiembre
 * y junio solo primaria tiene horario propio, e infantil y la ESO siguen con el de siempre hasta que
 * se suba el suyo. Nunca un periodo para todo el centro (`getPeriodoVigente` no vale aquí).
 */
export function horarioDeFecha(
  fecha: string,
  periodos: readonly PeriodoHorario[],
  rejillas: readonly RejillaHorario[],
  etapas: readonly Etapa[] = CFG.etapas,
): HorarioDeFecha {
  const usadas = new Set<string>();
  const porEtapa: HorarioDeFecha['porEtapa'] = [];
  const contienen = periodos.filter((p) => p.fechaInicio <= fecha && fecha <= p.fechaFin);
  const elegidos = new Set<string>();
  for (const etapa of etapas) {
    // El periodo de cada etapa se elige SOLO por sus rejillas propias: una rejilla de «centro entero»
    // (las horas sueltas que el importador no casa con una etapa) no hace que un periodo especial de
    // primaria pase a mandar también en infantil o en la ESO.
    const conRejilla = (p: PeriodoHorario) => rejillas.some((r) => r.periodoId === p.id && rejillaDeEtapa(r, etapa));
    const candidatos = contienen.filter(conRejilla);
    let periodo: PeriodoHorario | null = null;
    if (candidatos.length > 0) periodo = candidatos.reduce((a, b) => (b.prioridad > a.prioridad ? b : a));
    // Sin nada vigente para la etapa: el ordinario que contenga la fecha o, si no, el del curso de la fecha.
    if (!periodo) {
      const curso = cursoDeFecha(fecha);
      periodo =
        periodos.find((p) => p.esOrdinario && p.fechaInicio <= fecha && fecha <= p.fechaFin && conRejilla(p)) ??
        periodos.find((p) => p.esOrdinario && conRejilla(p) && cursoDeFecha(p.fechaInicio) === curso && p.fechaInicio <= fecha) ??
        null;
    }
    const especial = contienen.some((p) => !p.esOrdinario);
    porEtapa.push({ etapa, periodo, ordinarioDeRespaldo: Boolean(periodo?.esOrdinario && especial) });
    if (periodo) {
      elegidos.add(periodo.id);
      for (const r of rejillas) if (r.periodoId === periodo.id && rejillaDeEtapa(r, etapa)) usadas.add(r.id);
    }
  }
  // Las de centro entero cuentan si son de un periodo que manda en alguna etapa.
  for (const r of rejillas) if (esDeCentro(r) && elegidos.has(r.periodoId)) usadas.add(r.id);
  return { rejillas: usadas, porEtapa };
}

/**
 * Las líneas discretas de «Infantil: horario ordinario, no hay de septiembre» (decisión 4), para
 * que nadie se extrañe. Una por etapa que se queda con el ordinario en un periodo especial.
 */
export function notasDeHorario(h: HorarioDeFecha, periodos: readonly PeriodoHorario[], fecha: string): string[] {
  const especiales = periodos.filter((p) => !p.esOrdinario && p.fechaInicio <= fecha && fecha <= p.fechaFin);
  if (especiales.length === 0) return [];
  const nombre = especiales[0].nombre.toLowerCase();
  return h.porEtapa
    .filter((e) => e.ordinarioDeRespaldo)
    .map((e) => `${ETAPA_LABEL[e.etapa]}: horario ordinario, no hay de ${nombre}`);
}

// ─── Grupos y aulas, como se dicen ───────────────────────────────────────────

/** '3INF' + 'A' → '3 años A'; '2PRI' + 'B' → '2º B'; '2ESO' + 'A' → '2º ESO A'; '3ESO' + 'PDC' → '3º PDC'. */
export function etiquetaGrupo(curso: string, letra: string | null, subgrupo?: string | null): string {
  const etapa = etapaDeCurso(curso);
  const n = nivelDeCurso(curso);
  let base: string;
  if (letra === 'PDC' || /PDC/i.test(curso)) base = `${n}º PDC`;
  else if (etapa === 'EI') base = `${n} años${letra ? ` ${letra}` : ''}`;
  else if (etapa === 'EP') base = `${n}º${letra ? ` ${letra}` : ' EP'}`;
  else if (etapa === 'ESO') base = `${n}º ESO${letra ? ` ${letra}` : ''}`;
  else base = letra ? `${curso} ${letra}` : curso;
  return subgrupo ? `${base} (${subgrupo})` : base;
}

/**
 * El aula para decirla: el código de un espacio pasa a su nombre («Música»), y 'A-2ESOB' (el aula
 * propia de un grupo) a «aula de 2º ESO B». Si es el aula propia del ÚNICO grupo de la sesión, no
 * se dice (null): es donde está siempre, y el grupo ya va en el correo.
 */
export function aulaVisible(
  codigo: string | null,
  nombreEspacio: string | null,
  grupos: readonly { curso: string; letra: string | null }[],
): string | null {
  if (!codigo && !nombreEspacio) return null;
  const propia = codigo ? /^A-(\d+(?:INF|PRI|ESO|BACH))(PDC|[A-Z])?$/i.exec(codigo.replace(/\s+/g, '')) : null;
  if (propia) {
    const [, curso, letra] = propia;
    // 'A-3ESOPDC' trae la letra pegada: el curso es '3ESO' y la letra 'PDC'.
    const c = curso.toUpperCase();
    const l = letra?.toUpperCase() ?? null;
    if (grupos.length === 1 && grupos[0].curso.toUpperCase() === c && (grupos[0].letra ?? '').toUpperCase() === (l ?? '')) return null;
    return `aula de ${etiquetaGrupo(c, l)}`;
  }
  return nombreEspacio ?? codigo;
}

// ─── Sesiones de un día ──────────────────────────────────────────────────────

export interface ProfeEnSesion {
  id: string;
  principal: boolean;
  rol: string;
}

/** Una sesión del horario un día concreto (ya con las coberturas por baja aplicadas). */
export interface SesionDia {
  sesionId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tramo: string | null;
  actividad: string;
  actividadNombre?: string | null;
  etiqueta: string | null;
  grupos: string[];
  materia: string | null;
  aula: string | null;
  profes: ProfeEnSesion[];
}

/**
 * Coberturas por baja (decisión 4): mientras una está vigente, el horario del titular PASA al
 * sustituto. El titular desaparece de sus sesiones y entra quien le cubre, con su mismo papel.
 */
export function aplicarCoberturas(sesiones: readonly SesionDia[], coberturas: readonly CoberturaBajaBase[]): SesionDia[] {
  if (coberturas.length === 0) return [...sesiones];
  return sesiones.map((s) => {
    const vigentes = coberturas.filter((c) => esVigente(c, s.fecha));
    if (vigentes.length === 0) return s;
    const profes: ProfeEnSesion[] = [];
    for (const p of s.profes) {
      const suyos = vigentes.filter((c) => c.titularId === p.id).map((c) => c.sustitutoId);
      for (const id of suyos.length > 0 ? suyos : [p.id]) if (!profes.some((x) => x.id === id)) profes.push({ ...p, id });
    }
    return { ...s, profes };
  });
}

/** Los titulares de una baja cubierta vigente ese día: ni se les apunta una ausencia ni se les propone. */
export function titularesDeBaja(fecha: string, coberturas: readonly CoberturaBajaBase[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of coberturas) if (esVigente(c, fecha)) m.set(c.titularId, [...(m.get(c.titularId) ?? []), c.sustitutoId]);
  return m;
}

/** ¿Es esta persona quien responde por la hora? `principal`, o el único profe. */
function esPrincipalEn(s: SesionDia, profeId: string): boolean {
  const p = s.profes.find((x) => x.id === profeId);
  if (!p) return false;
  return p.principal || s.profes.length === 1;
}

export interface SesionAusente extends SesionDia {
  /** El ausente da la clase a un grupo: necesita sustituto (decisión 5). */
  hayQueCubrir: boolean;
  /** Los otros profes de la sesión (codocencia en su clase): se les propone primero. */
  otrosEnAula: string[];
}

/**
 * Las sesiones del ausente ese día, en orden. Hay que cubrir las que tienen grupo (o alumnos aunque
 * el horario no ponga el grupo) y en las que él es el principal (o el único). Las demás (codocencia en clase ajena, reuniones…) salen desmarcadas:
 * cuentan si Jefatura las marca, pero nunca piden sustituto.
 */
export function sesionesDelAusente(sesiones: readonly SesionDia[], profeId: string, cfg: ConfigSustituciones = CFG): SesionAusente[] {
  return sesiones
    .filter((s) => s.profes.some((p) => p.id === profeId))
    .map((s) => ({
      ...s,
      // Con grupo, o una de las horas «con alumnos aunque el horario no ponga el grupo» (el Almuerzo
      // de infantil, el Taller de Pensamiento, el Huerto: `nuncaLiberables`).
      hayQueCubrir: (s.grupos.length > 0 || conAlumnosSinGrupo(s, cfg)) && esPrincipalEn(s, profeId),
      otrosEnAula: s.grupos.length > 0 || conAlumnosSinGrupo(s, cfg) ? s.profes.filter((p) => p.id !== profeId).map((p) => p.id) : [],
    }))
    .sort(ordenSesion);
}

function conAlumnosSinGrupo(s: SesionDia, cfg: ConfigSustituciones): boolean {
  const etiqueta = normalizar(s.etiqueta);
  return cfg.nuncaLiberables.some((t) => etiqueta.includes(t));
}

export function ordenSesion(a: Pick<SesionDia, 'fecha' | 'horaInicio' | 'horaFin'>, b: Pick<SesionDia, 'fecha' | 'horaInicio' | 'horaFin'>): number {
  return a.fecha.localeCompare(b.fecha) || aMin(a.horaInicio) - aMin(b.horaInicio) || aMin(a.horaFin) - aMin(b.horaFin);
}

/** Lo que es esa hora, corto: «Codocencia · 3º A», «Reunión TIC», «At. familias». */
export function describirSesion(s: Pick<SesionDia, 'etiqueta' | 'materia' | 'actividad' | 'actividadNombre' | 'grupos'>): string {
  const que = s.materia ?? s.etiqueta ?? s.actividadNombre ?? s.actividad;
  return s.grupos.length > 0 ? `${que} · ${s.grupos.join(', ')}` : que;
}

// ─── Niveles y disponibilidad (decisiones 7 y 15) ────────────────────────────

function casaNivel(n: NivelSustitucionConfig, s: SesionDia, principal: boolean, etiqueta: string): boolean {
  if (n.actividades && !n.actividades.includes(s.actividad)) return false;
  if (n.etiquetaContiene && !n.etiquetaContiene.some((t) => etiqueta.includes(t))) return false;
  if (n.etiquetaIgual && !n.etiquetaIgual.some((t) => etiqueta === t)) return false;
  if (n.etiquetaEmpieza && !n.etiquetaEmpieza.some((t) => etiqueta.startsWith(t))) return false;
  if (n.noPrincipal && principal) return false;
  if (n.conGrupo && s.grupos.length === 0) return false;
  if (n.sinGrupo && s.grupos.length > 0) return false;
  return true;
}

/**
 * El nivel de lo que un profe tiene en una sesión: la clave del primer nivel de la lista que case, o
 * `null` si esa hora NO se puede liberar (clase o tutoría propia como principal, una hora con grupo
 * que no sea de la lista, un oratorio que no es Godly, o una etiqueta de `nuncaLiberables`).
 */
export function nivelDe(s: SesionDia, profeId: string, cfg: ConfigSustituciones = CFG): string | null {
  const etiqueta = normalizar(s.etiqueta);
  if (cfg.nuncaLiberables.some((t) => etiqueta.includes(t))) return null;
  const principal = esPrincipalEn(s, profeId);
  if (principal && s.grupos.length > 0 && (s.actividad === 'clase' || s.actividad === 'tutoria')) return null;
  for (const n of cfg.niveles) if (casaNivel(n, s, principal, etiqueta)) return n.clave;
  return null;
}

/** Disponibilidad automática de un nivel (lo que no está en la configuración es «No»). */
export function disponibilidadDeNivel(nivel: string | null, cfg: ConfigSustituciones = CFG): Disponibilidad {
  if (!nivel) return 'no';
  return cfg.disponibilidadPorDefecto[nivel] ?? 'no';
}

export interface Retoque {
  profeId: string;
  dia: number;
  horaInicio: string;
  horaFin: string;
  estado: Disponibilidad;
  nota?: string | null;
}

export interface Evaluacion {
  /** Clave del peor nivel (el que manda), `libre`, o null (no liberable / no está). */
  nivel: string | null;
  /** Lo que sale del horario. */
  automatica: Disponibilidad;
  /** Lo que vale de verdad (con el retoque de Jefatura, si lo hay). */
  disponibilidad: Disponibilidad;
  /**
   * Tiene algo que no se libera nunca (una clase propia): de por sí es «No». Jefatura la puede subir
   * a mano igualmente (David, 23-nov-2026: «pueden pasar cosas»), y la pantalla lo señala.
   */
  bloqueada: boolean;
  retocada: boolean;
  /** Qué tiene a esa hora, para enseñarlo («Codocencia · 3º A»). Vacío = nada. */
  ocupacion: string[];
  /** Está en el colegio (tiene algo antes y después) aunque no tenga nada a esa hora. */
  enElColegio: boolean;
}

/**
 * Lo dispuesto que está un profe en una franja de un día (decisiones 6 y 15). `delDia` son todas
 * sus sesiones ese día (para saber si está en el colegio en una hora libre), `mismaSesion` la que se
 * está cubriendo (si es el otro profe de esa clase, nivel «Ya está en el aula»). Si varias
 * ocupaciones solapan, manda la PEOR disponibilidad y el PEOR nivel. Un retoque a mano pisa a lo
 * automático, también en una clase propia (David, 23-nov-2026: lo decide Jefatura).
 */
export function evaluar(
  profeId: string,
  franja: Franja,
  delDia: readonly SesionDia[],
  retoques: readonly Retoque[],
  dia: number,
  opciones: { mismaSesion?: string | null; cfg?: ConfigSustituciones; /** Solo el retoque de esta misma franja (la rejilla), no los que solapan. */ exacto?: boolean } = {},
): Evaluacion {
  const cfg = opciones.cfg ?? CFG;
  const suyas = delDia.filter((s) => s.profes.some((p) => p.id === profeId));
  const solapadas = suyas.filter((s) => solapa(s, franja));
  let nivel: string | null = null;
  let automatica: Disponibilidad;
  let bloqueada = false;
  let enElColegio = false;
  if (solapadas.length === 0) {
    const antes = suyas.some((s) => aMin(s.horaFin) <= aMin(franja.horaInicio));
    const despues = suyas.some((s) => aMin(s.horaInicio) >= aMin(franja.horaFin));
    enElColegio = antes && despues;
    nivel = enElColegio ? NIVEL_LIBRE : null;
    automatica = enElColegio ? disponibilidadDeNivel(NIVEL_LIBRE, cfg) : 'no';
  } else {
    enElColegio = true;
    let peorRango = -2;
    automatica = 'si';
    for (const s of solapadas) {
      const n = opciones.mismaSesion && s.sesionId === opciones.mismaSesion && cfg.enAulaPrimero ? NIVEL_EN_AULA : nivelDe(s, profeId, cfg);
      if (n === null) bloqueada = true;
      const r = n === null ? Infinity : rangoNivel(n, cfg);
      if (r > peorRango) {
        peorRango = r;
        nivel = n;
      }
      automatica = peorDisponibilidad(automatica, disponibilidadDeNivel(n, cfg));
    }
  }
  const suyos = retoques.filter(
    (r) => r.profeId === profeId && r.dia === dia && (opciones.exacto ? r.horaInicio === franja.horaInicio && r.horaFin === franja.horaFin : solapa(r, franja)),
  );
  let disponibilidad = automatica;
  let retocada = false;
  if (suyos.length > 0) {
    disponibilidad = suyos.map((r) => r.estado).reduce(peorDisponibilidad);
    retocada = true;
  }
  return { nivel, automatica, disponibilidad, bloqueada, retocada, ocupacion: solapadas.map(describirSesion), enElColegio };
}

// ─── La propuesta (decisiones 6 y 8) ─────────────────────────────────────────

export interface Persona {
  id: string;
  nombre: string;
}

/** Algo que tiene ocupado a alguien un día a unas horas (otra ausencia, otra sustitución, un Oratorio). */
export interface Bloqueo {
  profeId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface EnCuadro {
  profeId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface Candidato {
  id: string;
  nombre: string;
  nivel: string | null;
  disponibilidad: Disponibilidad;
  ocupacion: string[];
  enCuadro: boolean;
  /** Ya cubre otra hora de esta misma ausencia ese día (el mismo adulto toda la mañana). */
  continua: boolean;
  /** Sesiones cubiertas en los últimos `diasReparto` días (para el desempate). */
  carga: number;
  /** Las que lleva este mes («· 3 este mes»). */
  esteMes: number;
}

/** Clave de una sesión ausente en la propuesta: fecha + sesión del horario. */
export const claveSesion = (s: Pick<SesionDia, 'fecha' | 'sesionId'>) => `${s.fecha}#${s.sesionId}`;

export interface EntradaPropuesta {
  /** Las sesiones del ausente que piden sustituto, de todos los días. */
  sesiones: readonly SesionAusente[];
  ausenteId: string;
  /** El horario de todo el claustro, por fecha (ya con coberturas aplicadas). */
  horario: ReadonlyMap<string, readonly SesionDia[]>;
  profes: readonly Persona[];
  /** Otras ausencias confirmadas (sus horas de cada día). */
  ausencias: readonly Bloqueo[];
  /** Sustituciones ya confirmadas en la BBDD (de otras ausencias). */
  cubriendo: readonly Bloqueo[];
  /** Responsables de Oratorios fechados. */
  oratorios: readonly Bloqueo[];
  /** Titulares de una baja cubierta, por fecha. */
  deBaja: ReadonlyMap<string, readonly string[]>;
  retoques: readonly Retoque[];
  cuadro?: readonly EnCuadro[];
  cargas?: ReadonlyMap<string, number>;
  esteMes?: ReadonlyMap<string, number>;
  /** Lo que Jefatura ya ha elegido a mano en la pantalla (null = «Sin cubrir»). */
  fijados?: Readonly<Record<string, string | null>>;
  cfg?: ConfigSustituciones;
}

export interface PropuestaSesion {
  clave: string;
  candidatos: Candidato[];
  elegido: Candidato | null;
  /** Quién sale en el cuadro del centro a esa hora (para enseñarlo). */
  enCuadro: string[];
  /** Quién está de baja ese día: sale en el desplegable, deshabilitado, para que se vea por qué no está. */
  deBaja: string[];
}

function ordenCandidatos(cfg: ConfigSustituciones) {
  return (a: Candidato, b: Candidato) =>
    RANGO_DISP[a.disponibilidad] - RANGO_DISP[b.disponibilidad] ||
    rangoNivel(a.nivel, cfg) - rangoNivel(b.nivel, cfg) ||
    Number(b.enCuadro) - Number(a.enCuadro) ||
    Number(b.continua) - Number(a.continua) ||
    a.carga - b.carga ||
    a.nombre.localeCompare(b.nombre, 'es');
}

const bloquea = (b: Bloqueo, profeId: string, fecha: string, f: Franja) => b.profeId === profeId && b.fecha === fecha && solapa(b, f);

/**
 * Quién puede cubrir cada sesión, en orden, y a quién se elige. Puro y determinista: el servidor
 * lo llama para la primera propuesta y el cliente otra vez cuando Jefatura cambia un desplegable
 * (`fijados`), para descontar a quien ya se ha elegido. La propuesta va en orden de fecha y hora y
 * descuenta al elegido antes de la siguiente: nadie sale dos veces a la misma hora. «Solo urgencia»
 * y «No» nunca se eligen solos: salen en la lista para que lo decida Jefatura.
 */
export function proponerSustitutos(e: EntradaPropuesta): PropuestaSesion[] {
  const cfg = e.cfg ?? CFG;
  const nombres = new Map(e.profes.map((p) => [p.id, p.nombre]));
  const orden = [...e.sesiones].sort(ordenSesion);
  // Lo elegido en esta propuesta, para no repetir a nadie a la misma hora.
  const elegidos: (Bloqueo & { clave: string })[] = [];
  const fijados = e.fijados ?? {};
  for (const s of orden) {
    const k = claveSesion(s);
    const id = fijados[k];
    if (id) elegidos.push({ profeId: id, fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, clave: k });
  }
  const cargaExtra = new Map<string, number>();
  const salida: PropuestaSesion[] = [];

  for (const s of orden) {
    const k = claveSesion(s);
    const delDia = e.horario.get(s.fecha) ?? [];
    const baja = new Set(e.deBaja.get(s.fecha) ?? []);
    const dia = diaSemana(s.fecha);
    const enCuadroIds = new Set((e.cuadro ?? []).filter((c) => c.fecha === s.fecha && solapa(c, s)).map((c) => c.profeId));
    const candidatos: Candidato[] = [];
    for (const p of e.profes) {
      if (p.id === e.ausenteId || baja.has(p.id)) continue;
      if (e.ausencias.some((b) => bloquea(b, p.id, s.fecha, s))) continue;
      if (e.cubriendo.some((b) => bloquea(b, p.id, s.fecha, s))) continue;
      if (e.oratorios.some((b) => bloquea(b, p.id, s.fecha, s))) continue;
      if (elegidos.some((b) => b.clave !== k && bloquea(b, p.id, s.fecha, s))) continue;
      const ev = evaluar(p.id, s, delDia, e.retoques, dia, { mismaSesion: s.otrosEnAula.includes(p.id) ? s.sesionId : null, cfg });
      candidatos.push({
        id: p.id,
        nombre: p.nombre,
        nivel: ev.nivel,
        disponibilidad: ev.disponibilidad,
        ocupacion: ev.ocupacion,
        enCuadro: enCuadroIds.has(p.id),
        continua: elegidos.some((b) => b.profeId === p.id && b.fecha === s.fecha && b.clave !== k),
        carga: (e.cargas?.get(p.id) ?? 0) + (cargaExtra.get(p.id) ?? 0),
        esteMes: e.esteMes?.get(p.id) ?? 0,
      });
    }
    candidatos.sort(ordenCandidatos(cfg));

    let elegido: Candidato | null = null;
    if (k in fijados) {
      const id = fijados[k];
      elegido = id ? (candidatos.find((c) => c.id === id) ?? manual(id, nombres.get(id) ?? '—', e)) : null;
    } else {
      elegido = candidatos.find((c) => c.disponibilidad === 'si' || c.disponibilidad === 'si_hace_falta') ?? null;
      if (elegido) elegidos.push({ profeId: elegido.id, fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, clave: k });
    }
    if (elegido) cargaExtra.set(elegido.id, (cargaExtra.get(elegido.id) ?? 0) + 1);
    const deBaja = e.profes.filter((p) => p.id !== e.ausenteId && baja.has(p.id)).map((p) => p.nombre);
    salida.push({ clave: k, candidatos, elegido, enCuadro: [...enCuadroIds].map((id) => nombres.get(id) ?? '—'), deBaja });
  }
  return salida;
}

function manual(id: string, nombre: string, e: EntradaPropuesta): Candidato {
  return { id, nombre, nivel: NIVEL_MANUAL, disponibilidad: 'no', ocupacion: [], enCuadro: false, continua: false, carga: e.cargas?.get(id) ?? 0, esteMes: e.esteMes?.get(id) ?? 0 };
}

/**
 * El horario de un día recortado a lo que hace falta para proponer en unas franjas: lo que solapa
 * con ellas y, de cada profe, su primera y su última hora (para saber si está en el colegio en una
 * hora libre). Da lo mismo que el horario entero en `evaluar` y pesa una fracción (viaja a la pantalla).
 */
export function recortarHorario(delDia: readonly SesionDia[], franjas: readonly Franja[]): SesionDia[] {
  const quedan = new Set<SesionDia>();
  const primera = new Map<string, SesionDia>();
  const ultima = new Map<string, SesionDia>();
  for (const s of delDia) {
    if (franjas.some((f) => solapa(s, f))) quedan.add(s);
    for (const p of s.profes) {
      const a = primera.get(p.id);
      if (!a || aMin(s.horaInicio) < aMin(a.horaInicio)) primera.set(p.id, s);
      const b = ultima.get(p.id);
      if (!b || aMin(s.horaFin) > aMin(b.horaFin)) ultima.set(p.id, s);
    }
  }
  const salida = delDia.filter((s) => quedan.has(s));
  // De quien no tiene nada a esas horas basta saber cuándo llega y cuándo se va: una marca mínima.
  const marcas = new Map<string, SesionDia>();
  for (const [id, s] of [...primera, ...ultima]) {
    if (quedan.has(s)) continue;
    const k = `${id}#${s.horaInicio}#${s.horaFin}`;
    if (!marcas.has(k)) marcas.set(k, { sesionId: '', fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, tramo: null, actividad: '', etiqueta: null, grupos: [], materia: null, aula: null, profes: [{ id, principal: false, rol: '' }] });
  }
  return [...salida, ...marcas.values()];
}

export interface ProfeSust extends Persona {
  pila: string;
  email: string | null;
}

/** Todo lo que hace falta para proponer en un rango, sin Maps, para que viaje a la pantalla. */
export interface ContextoPropuesta {
  profes: ProfeSust[];
  horario: [string, SesionDia[]][];
  ausencias: Bloqueo[];
  cubriendo: Bloqueo[];
  oratorios: Bloqueo[];
  deBaja: [string, string[]][];
  retoques: Retoque[];
  cuadro: EnCuadro[];
  cargas: [string, number][];
  esteMes: [string, number][];
}

/** De lo que viaja a la entrada de `proponerSustitutos` (lo usan servidor y pantalla). */
export function entradaDesdeContexto(
  ctx: ContextoPropuesta,
  sesiones: readonly SesionAusente[],
  ausenteId: string,
  fijados?: Record<string, string | null>,
): EntradaPropuesta {
  return {
    sesiones,
    ausenteId,
    horario: new Map(ctx.horario),
    profes: ctx.profes,
    ausencias: ctx.ausencias,
    cubriendo: ctx.cubriendo,
    oratorios: ctx.oratorios,
    deBaja: new Map(ctx.deBaja),
    retoques: ctx.retoques,
    cuadro: ctx.cuadro,
    cargas: new Map(ctx.cargas),
    esteMes: new Map(ctx.esteMes),
    fijados,
  };
}

/**
 * De las horas que cubre alguien, las que caen dentro de lo que falta cada día (de su primera a su
 * última hora de ausencia): si falta a esas horas, esas se quedan sin cubrir.
 */
export function cubreDentro<T extends Franja & { fecha: string }>(cubre: readonly T[], faltas: readonly (Franja & { fecha: string })[]): T[] {
  const ventanas = new Map<string, Franja>();
  for (const f of faltas) {
    const v = ventanas.get(f.fecha);
    if (!v) ventanas.set(f.fecha, { horaInicio: f.horaInicio, horaFin: f.horaFin });
    else {
      if (aMin(f.horaInicio) < aMin(v.horaInicio)) v.horaInicio = f.horaInicio;
      if (aMin(f.horaFin) > aMin(v.horaFin)) v.horaFin = f.horaFin;
    }
  }
  return cubre.filter((c) => {
    const v = ventanas.get(c.fecha);
    return Boolean(v && solapa(v, c));
  });
}

export interface GrupoCandidatos {
  etiqueta: string;
  candidatos: Candidato[];
}

/** Los candidatos en grupos para el `<optgroup>`: «Ya está en el aula», «Sí · Guardia», …, «Solo urgencia», «Todo el claustro (tiene clase)». */
export function agruparCandidatos(candidatos: readonly Candidato[], cfg: ConfigSustituciones = CFG): GrupoCandidatos[] {
  const grupos = new Map<string, Candidato[]>();
  for (const c of candidatos) {
    let etiqueta: string;
    if (c.nivel === NIVEL_EN_AULA && c.disponibilidad !== 'no') etiqueta = 'Ya está en el aula';
    else if (c.disponibilidad === 'urgencia') etiqueta = 'Solo urgencia';
    else if (c.disponibilidad === 'no') etiqueta = c.enCuadro || c.nivel === NIVEL_LIBRE ? 'No disponible' : 'Todo el claustro (tiene clase o no está)';
    else etiqueta = `${DISPONIBILIDAD_INFO[c.disponibilidad].nombre} · ${nombreNivel(c.nivel, cfg)}`;
    grupos.set(etiqueta, [...(grupos.get(etiqueta) ?? []), c]);
  }
  return [...grupos].map(([etiqueta, lista]) => ({ etiqueta, candidatos: lista }));
}

// ─── La rejilla de disponibilidad (decisión 15) ─────────────────────────────

export interface CasillaDisponibilidad extends Franja {
  dia: number;
  nivel: string | null;
  automatica: Disponibilidad;
  disponibilidad: Disponibilidad;
  bloqueada: boolean;
  retocada: boolean;
  ocupacion: string[];
  nota: string | null;
}

/**
 * La semana tipo de un profe: por cada día y franja, lo que tiene y su disponibilidad. `semana` son
 * las sesiones de la semana ordinaria indexadas por día (1-5) y `franjas` las filas de la rejilla.
 */
export function rejillaDisponibilidad(
  profeId: string,
  semana: ReadonlyMap<number, readonly SesionDia[]>,
  franjas: readonly Franja[],
  retoques: readonly Retoque[],
  cfg: ConfigSustituciones = CFG,
): CasillaDisponibilidad[] {
  const casillas: CasillaDisponibilidad[] = [];
  for (let dia = 1; dia <= 5; dia++) {
    const delDia = semana.get(dia) ?? [];
    for (const f of franjas) {
      // En la rejilla, cada casilla con su propio retoque: quien da en dos etapas tiene franjas que
      // empiezan a la misma hora y acaban distinto, y no se pisan.
      const ev = evaluar(profeId, f, delDia, retoques, dia, { cfg, exacto: true });
      const retoque = retoques.find((r) => r.profeId === profeId && r.dia === dia && r.horaInicio === f.horaInicio && r.horaFin === f.horaFin);
      casillas.push({ dia, ...f, ...ev, nota: retoque?.nota ?? null });
    }
  }
  return casillas;
}

/** El orden al tocar una casilla: Sí → Si hace falta → Solo urgencia → No → Automático (null). */
export function siguienteEstado(actual: Disponibilidad | null): Disponibilidad | null {
  if (actual === null) return 'si';
  const i = DISPONIBILIDADES.indexOf(actual);
  return i === DISPONIBILIDADES.length - 1 ? null : DISPONIBILIDADES[i + 1];
}

/** Las franjas (filas) de unas sesiones: sus horas, sin repetir, en orden. */
export function franjasDe(lista: readonly Franja[]): Franja[] {
  const vistas = new Map<string, Franja>();
  for (const f of lista) vistas.set(`${f.horaInicio}-${f.horaFin}`, { horaInicio: f.horaInicio, horaFin: f.horaFin });
  return [...vistas.values()].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio) || aMin(a.horaFin) - aMin(b.horaFin));
}

export interface CasillaSemana extends Franja {
  dia: number;
  cuenta: Record<Disponibilidad, number>;
  /** Quiénes están en Sí o Si hace falta. */
  disponibles: string[];
  enCuadro: string[];
  /** Ni un Sí ni un Si hace falta: ahí va a faltar gente. */
  falta: boolean;
}

/** «La semana»: por día y franja, cuántos hay en cada estado (para ver dónde va a faltar gente). */
export function mapaSemana(
  profes: readonly Persona[],
  semana: ReadonlyMap<number, readonly SesionDia[]>,
  franjas: readonly Franja[],
  retoques: readonly Retoque[],
  cuadro: readonly { profeId: string; dia: number; horaInicio: string; horaFin: string }[] = [],
  cfg: ConfigSustituciones = CFG,
): CasillaSemana[] {
  const nombres = new Map(profes.map((p) => [p.id, p.nombre]));
  const out: CasillaSemana[] = [];
  for (let dia = 1; dia <= 5; dia++) {
    const delDia = semana.get(dia) ?? [];
    for (const f of franjas) {
      const cuenta: Record<Disponibilidad, number> = { si: 0, si_hace_falta: 0, urgencia: 0, no: 0 };
      const disponibles: string[] = [];
      for (const p of profes) {
        const ev = evaluar(p.id, f, delDia, retoques, dia, { cfg });
        // Quien no está en el colegio a esa hora no cuenta: no es «No», es que no está.
        if (!ev.enElColegio && !ev.retocada) continue;
        cuenta[ev.disponibilidad]++;
        if (ev.disponibilidad === 'si' || ev.disponibilidad === 'si_hace_falta') disponibles.push(p.nombre);
      }
      const enCuadro = cuadro.filter((c) => c.dia === dia && solapa(c, f)).map((c) => nombres.get(c.profeId) ?? '—');
      out.push({ dia, ...f, cuenta, disponibles, enCuadro, falta: cuenta.si + cuenta.si_hace_falta === 0 });
    }
  }
  return out;
}

// ─── Enlace de Google Calendar (decisión 18) ─────────────────────────────────

/**
 * Un enlace que abre Google Calendar con el evento ya rellenado. NO es una integración: la app no
 * crea eventos ni pide permisos; cada uno se lo crea si quiere. Hora de Madrid (`ctz`).
 */
export function enlaceGoogleCalendar(e: { titulo: string; fecha: string; horaInicio: string; horaFin: string; lugar?: string | null; detalles?: string | null }): string {
  const f = e.fecha.replaceAll('-', '');
  const h = (x: string) => `${x.replace(':', '').padStart(4, '0')}00`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.titulo, dates: `${f}T${h(e.horaInicio)}/${f}T${h(e.horaFin)}`, ctz: CONFIGURACION.calendario.zonaHoraria });
  if (e.lugar) p.set('location', e.lugar);
  if (e.detalles) p.set('details', e.detalles);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** '2º B · Matemáticas · Música': el grupo, la materia y, si no es la suya, el aula. */
export function lugarDe(s: { aula: string | null; grupos: string | null; materia: string | null }): string {
  const aula = s.aula && normalizar(s.aula) !== normalizar(s.materia) ? mayuscula(s.aula) : null;
  return [s.grupos, s.materia, aula].filter(Boolean).join(' · ');
}

export function mayuscula(t: string): string {
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
}

// ─── Asunto de los correos (decisión 10) ─────────────────────────────────────

export interface HoraCorreo {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  grupos: string | null;
  aula: string | null;
  materia: string | null;
}

/**
 * El cuándo y dónde del asunto, que no se puede quitar: 'mar 17 nov · 10:30 · 2º B (Música)';
 * con varias horas, 'mar 17 nov · 10:30 y 12:30 · 2º B'; con varios días, 'del 17 al 19 nov · 4 horas'.
 */
export function cuandoYDonde(horas: readonly HoraCorreo[]): string {
  if (horas.length === 0) return '';
  const orden = [...horas].sort(ordenSesion);
  const fechas = [...new Set(orden.map((h) => h.fecha))];
  if (fechas.length > 1) return `${rangoCorto(fechas[0], fechas[fechas.length - 1])} · ${orden.length} horas`;
  const grupos = [...new Set(orden.map((h) => h.grupos).filter(Boolean))];
  const aulas = [...new Set(orden.map((h) => h.aula).filter(Boolean))];
  const horasTxt = orden.map((h) => hora(h.horaInicio));
  const listaHoras = horasTxt.length === 1 ? horasTxt[0] : `${horasTxt.slice(0, -1).join(', ')} y ${horasTxt[horasTxt.length - 1]}`;
  let sitio = grupos.join(', ');
  if (orden.length === 1 && aulas.length === 1) sitio = sitio ? `${sitio} (${aulas[0]})` : `${aulas[0]}`;
  return [fechaCorta(fechas[0]), listaHoras, sitio].filter(Boolean).join(' · ');
}

// ─── Plantillas de correo (decisión 17) ──────────────────────────────────────

export const TIPOS_PLANTILLA = ['sustituto', 'en_aula', 'ausente', 'cambio', 'anulacion'] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

export const PLANTILLA_NOMBRE: Record<TipoPlantilla, string> = {
  sustituto: 'Aviso al sustituto',
  en_aula: 'Al codocente que se queda',
  ausente: 'Al ausente',
  cambio: 'Ya no hace falta',
  anulacion: 'Anulación',
};

export interface Plantilla {
  asunto: string;
  antes: string;
  despues: string;
}

export type Plantillas = Record<TipoPlantilla, Plantilla>;

export const VARIABLES_PLANTILLA = ['nombre', 'ausente', 'fecha', 'horas', 'grupo', 'aula', 'quien'] as const;
export type VariablePlantilla = (typeof VARIABLES_PLANTILLA)[number];
export type VariablesCorreo = Record<VariablePlantilla, string>;

export const VARIABLE_AYUDA: Record<VariablePlantilla, string> = {
  nombre: 'A quién va',
  ausente: 'Quién falta',
  fecha: 'El día o los días',
  horas: '«una hora», «3 horas»',
  grupo: 'Los grupos',
  aula: 'Las aulas',
  quien: 'Quién lo manda',
};

/** Los textos de fábrica: de compañero a compañero, sin firmas ni logos (como Oratorios). */
export const PLANTILLAS_DE_FABRICA: Plantillas = {
  sustituto: {
    asunto: 'Sustitución',
    antes: 'Hola, {nombre}:\n\n{ausente} no está {fecha} y te toca cubrir {horas}:',
    despues: 'Si no puedes, dímelo cuanto antes. ¡Gracias!\n\n{quien}',
  },
  en_aula: {
    asunto: 'Te quedas con el grupo',
    antes: 'Hola, {nombre}:\n\nComo {ausente} no está {fecha}, te quedas tú con el grupo en {horas} en las que ya estás en el aula:',
    despues: '¡Gracias!\n\n{quien}',
  },
  ausente: {
    asunto: 'Quién cubre tus horas',
    antes: 'Hola, {nombre}:\n\nYa está organizado quién entra en tus clases {fecha}:',
    despues: 'Si cambia algo, dímelo.\n\n{quien}',
  },
  cambio: {
    asunto: 'Ya no hace falta que cubras',
    antes: 'Hola, {nombre}:\n\nYa no hace falta que cubras a {ausente} en estas horas:',
    despues: '¡Gracias igualmente!\n\n{quien}',
  },
  anulacion: {
    asunto: 'Sustitución anulada',
    antes: 'Hola, {nombre}:\n\nSe ha anulado la ausencia de {ausente} {fecha}. Ya no hace falta cubrir estas horas:',
    despues: 'Gracias.\n\n{quien}',
  },
};

/** Lo guardado en `cfg_ajustes`, completado con lo de fábrica (lo que falte o venga roto). */
export function leerPlantillas(valor: unknown): Plantillas {
  const out = structuredClone(PLANTILLAS_DE_FABRICA);
  if (!valor || typeof valor !== 'object') return out;
  for (const t of TIPOS_PLANTILLA) {
    const p = (valor as Record<string, unknown>)[t];
    if (!p || typeof p !== 'object') continue;
    for (const campo of ['asunto', 'antes', 'despues'] as const) {
      const v = (p as Record<string, unknown>)[campo];
      if (typeof v === 'string' && (campo !== 'asunto' || v.trim())) out[t][campo] = v.slice(0, 2000);
    }
  }
  return out;
}

export function escaparHtml(texto: string): string {
  return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Cambia `{variable}` por su valor. Las desconocidas se quedan tal cual (se ve el fallo en la vista previa). */
export function pintarPlantilla(texto: string, vars: Partial<VariablesCorreo>): string {
  return texto.replace(/\{(\w+)\}/g, (todo, k: string) => (k in vars ? (vars[k as VariablePlantilla] ?? '') : todo));
}

/** Texto plano de plantilla → HTML: se escapa todo y los saltos de línea pasan a párrafos. */
export function textoAHtml(texto: string, estiloParrafo = 'margin:0 0 12px'): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${estiloParrafo}">${escaparHtml(p).replaceAll('\n', '<br>')}</p>`)
    .join('');
}

/** «una hora», «3 horas». */
export function horasTexto(n: number): string {
  return n === 1 ? 'una hora' : `${n} horas`;
}

// ─── Cuentas (decisiones 11 y 19) ────────────────────────────────────────────

export interface FilaCuenta {
  ausenciaId: string;
  profeId: string;
  profeNombre: string;
  motivo: string;
  fecha: string;
  hayQueCubrir: boolean;
  sustitutoId: string | null;
  sustitutoNombre: string | null;
  sustituto2Id?: string | null;
  sustituto2Nombre?: string | null;
  disponibilidad: string | null;
}

export interface Resumen {
  sesiones: number;
  aCubrir: number;
  cubiertas: number;
  sinCubrir: number;
  ausencias: number;
  porAusente: { id: string; nombre: string; escolar: number; personal: number; total: number }[];
  porSustituto: { id: string; nombre: string; total: number; urgencia: number }[];
}

/** Las cifras de unas sesiones de ausencias confirmadas (las anuladas no llegan aquí). */
export function resumir(filas: readonly FilaCuenta[], cfg: ConfigSustituciones = CFG): Resumen {
  const ausentes = new Map<string, Resumen['porAusente'][number]>();
  const sustitutos = new Map<string, Resumen['porSustituto'][number]>();
  let aCubrir = 0;
  let cubiertas = 0;
  for (const f of filas) {
    const a = ausentes.get(f.profeId) ?? { id: f.profeId, nombre: f.profeNombre, escolar: 0, personal: 0, total: 0 };
    a[agruparMotivo(f.motivo, cfg)]++;
    a.total++;
    ausentes.set(f.profeId, a);
    if (f.hayQueCubrir) aCubrir++;
    if (f.sustitutoId || f.sustituto2Id) {
      if (f.hayQueCubrir) cubiertas++;
    }
    for (const [id, nombre] of [[f.sustitutoId, f.sustitutoNombre], [f.sustituto2Id ?? null, f.sustituto2Nombre ?? null]] as const) {
      if (!id) continue;
      const s = sustitutos.get(id) ?? { id, nombre: nombre ?? '—', total: 0, urgencia: 0 };
      s.total++;
      if (id === f.sustitutoId && f.disponibilidad === 'urgencia') s.urgencia++;
      sustitutos.set(id, s);
    }
  }
  const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');
  return {
    sesiones: filas.length,
    aCubrir,
    cubiertas,
    sinCubrir: aCubrir - cubiertas,
    ausencias: new Set(filas.map((f) => f.ausenciaId)).size,
    porAusente: [...ausentes.values()].sort((a, b) => b.total - a.total || porNombre(a, b)),
    porSustituto: [...sustitutos.values()].sort((a, b) => b.total - a.total || porNombre(a, b)),
  };
}

export const PERIODOS_CIFRAS = ['mes', 'trimestre', 'curso'] as const;
export type PeriodoCifras = (typeof PERIODOS_CIFRAS)[number];

/** El rango de fechas de «este mes / este trimestre / este curso» para una fecha. */
export function rangoPeriodo(periodo: PeriodoCifras, hoy: string, trimestres: readonly { inicio: string; fin: string }[]): { desde: string; hasta: string } {
  if (periodo === 'mes') {
    const ini = `${hoy.slice(0, 7)}-01`;
    const sig = mes(hoy) === 12 ? `${Number(hoy.slice(0, 4)) + 1}-01-01` : `${hoy.slice(0, 5)}${String(mes(hoy) + 1).padStart(2, '0')}-01`;
    return { desde: ini, hasta: sumarDias(sig, -1) };
  }
  const curso = cursoDeFecha(hoy);
  const y = Number(curso.slice(0, 4));
  const cursoRango = { desde: `${y}-${String(CONFIGURACION.calendario.mesInicioCurso).padStart(2, '0')}-01`, hasta: sumarDias(`${y + 1}-${String(CONFIGURACION.calendario.mesInicioCurso).padStart(2, '0')}-01`, -1) };
  if (periodo === 'curso') return cursoRango;
  const t = trimestres.find((x) => x.inicio <= hoy && hoy <= x.fin) ?? [...trimestres].reverse().find((x) => x.inicio <= hoy);
  return t ? { desde: t.inicio, hasta: t.fin } : cursoRango;
}

// ─── Quién ve «Mis sustituciones» (decisión 16) ──────────────────────────────

/** Con `misSustitucionesParaTodos` a `false` (prueba de concepto), solo quien tiene el módulo. */
export function puedeVerMisSustituciones(acceso: Acceso | null | undefined, cfg: ConfigSustituciones = CFG): boolean {
  if (!acceso) return false;
  if (cfg.misSustitucionesParaTodos) return acceso.role !== null;
  return canAccess(acceso, 'sustituciones');
}

// ─── Peticiones (Zod, compartidas cliente/servidor) ──────────────────────────

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const uuid = z.string().uuid();
const motivo = z.string().refine((m) => esMotivo(m), 'Motivo no válido');
const textoCorto = (max: number) => z.string().trim().max(max).optional().nullable();

export const PeticionPropuesta = z
  .object({ profeId: uuid, desde: fecha, hasta: fecha, excluirAusencia: uuid.optional() })
  .refine((p) => p.hasta >= p.desde, { message: 'La fecha de fin va después de la de inicio', path: ['hasta'] });

export const SesionElegida = z.object({
  fecha,
  horSesionId: uuid,
  sustitutoId: uuid.nullable(),
  sustituto2Id: uuid.nullable().optional(),
  sustitutoHoraInicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sustitutoHoraFin: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sustituto2HoraInicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sustituto2HoraFin: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const PeticionAusencia = z
  .object({
    profeId: uuid,
    desde: fecha,
    hasta: fecha,
    motivo,
    nota: textoCorto(300),
    indicaciones: textoCorto(1500),
    avisar: z.boolean(),
    avisarAusente: z.boolean().default(true),
    /** Que los correos salgan ya, aunque sea fin de semana o fuera de horas (lo pide Jefatura a mano). */
    enviarYa: z.boolean().default(false),
    sesiones: z.array(SesionElegida).min(1, 'Elige al menos una hora').max(200),
  })
  .refine((p) => p.hasta >= p.desde, { message: 'La fecha de fin va después de la de inicio', path: ['hasta'] })
  .refine((p) => p.motivo !== 'otros' || (p.nota ?? '').trim().length > 0, { message: 'Con «Otros», escribe una nota corta', path: ['nota'] });

export const PeticionCambio = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('cambiar'), sesionId: uuid, sustitutoId: uuid.nullable(), avisar: z.boolean().default(true) }),
  z.object({ accion: z.literal('anadir'), sesiones: z.array(SesionElegida).min(1).max(100), avisar: z.boolean().default(true) }),
  z.object({ accion: z.literal('quitar'), sesionId: uuid, avisar: z.boolean().default(true) }),
  z.object({ accion: z.literal('fechas'), desde: fecha, hasta: fecha, avisar: z.boolean().default(true) }),
  z.object({ accion: z.literal('indicaciones'), indicaciones: textoCorto(1500) }),
  z.object({ accion: z.literal('motivo'), motivo, nota: textoCorto(300) }),
  z.object({ accion: z.literal('anular'), avisar: z.boolean().default(true) }),
]);

export const PeticionRetoque = z.object({
  profeId: uuid,
  dia: z.number().int().min(1).max(5),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  estado: z.enum(DISPONIBILIDADES).nullable(),
  nota: textoCorto(200),
});

const plantilla = z.object({ asunto: z.string().trim().min(1).max(200), antes: z.string().max(2000), despues: z.string().max(2000) });
export const PeticionPlantillas = z.object({
  sustituto: plantilla,
  en_aula: plantilla,
  ausente: plantilla,
  cambio: plantilla,
  anulacion: plantilla,
});

export type EntradaAusencia = z.infer<typeof PeticionAusencia>;
export type EntradaCambio = z.infer<typeof PeticionCambio>;
