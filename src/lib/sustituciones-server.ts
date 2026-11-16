// Capa de servidor de Sustituciones. Ficha: docs/32-sustituciones.md (§4.5).
//
// Lo que tiene criterio está en `sustituciones.ts` (puro, con tests); aquí solo se lee en UNA tanda
// (`Promise.all`: lo que cuesta es el viaje, docs/04) y se escribe. El horario se carga entero
// (≈1.600 sesiones, todas las rejillas) y se resuelve por fecha en memoria, con el periodo elegido
// POR ETAPA y el ordinario de respaldo (decisión 4).
import { aliasedTable, and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  cfgAjustes,
  eduCoberturasBaja,
  eduTeachers,
  horActividades,
  horAsignaciones,
  horAsignacionGrupos,
  horAsignacionProfes,
  horCuadroSustituciones,
  horEspacios,
  horFestivos,
  horMaterias,
  horPeriodos,
  horRejillaAmbitos,
  horRejillas,
  horSesiones,
  horTramos,
  oraSesiones,
  sustAusencias,
  sustDisponibilidad,
  sustInformes,
  sustSesiones,
  type NewSustSesion,
  type SustAusencia,
  type SustSesion,
} from '@/db/schema';
import { COLEGIO } from '@/lib/colegio';
import { CONFIGURACION } from '@/lib/configuracion';
import { appBaseUrl } from '@/lib/constants';
import { enviar } from '@/lib/email';
import { hoyEnEspana, sumarDias, diaSemana } from '@/lib/oratorios';
import { getAjustes as getAjustesOratorios } from '@/lib/oratorios-server';
import { nombreProfeBreve, pilaProfe } from '@/lib/profes';
import type { CoberturaBajaBase } from '@/lib/coberturas-baja';
import {
  aplicarCoberturas,
  aulaVisible,
  claveSesion,
  cursoDeFecha,
  diasLectivos,
  etiquetaGrupo,
  evaluar,
  excedeTope,
  fechaLarga,
  franjasDe,
  hora,
  horarioDeFecha,
  leerPlantillas,
  mapaSemana,
  mesAnterior,
  NIVEL_MANUAL,
  notasDeHorario,
  ordenSesion,
  proponerSustitutos,
  rangoPeriodo,
  recortarHorario,
  cubreDentro,
  rejillaDisponibilidad,
  resumir,
  sesionesDelAusente,
  solapa,
  titularesDeBaja,
  type Bloqueo,
  type CasillaDisponibilidad,
  type CasillaSemana,
  type DiaSaltado,
  type Disponibilidad,
  type EnCuadro,
  type EntradaAusencia,
  type EntradaCambio,
  type FilaCuenta,
  type Franja,
  type PeriodoCifras,
  type PeriodoHorario,
  type Plantillas,
  type PropuestaSesion,
  type ContextoPropuesta,
  type ProfeSust,
  entradaDesdeContexto,
  type RejillaHorario,
  type Resumen,
  type Retoque,
  type SesionAusente,
  type SesionDia,
  type TipoPlantilla,
} from '@/lib/sustituciones';
import { correoAviso, correoInforme, type HoraBloque } from '@/lib/sustituciones-email';
import type { Etapa } from '@/lib/cursos';

const CFG = CONFIGURACION.sustituciones;
const CLAVE_PLANTILLAS = 'sustituciones.correos';

/** Un error por algo que ha enviado la persona: va a la pantalla tal cual (400, o 409 si es un choque). */
export class ErrorSustitucion extends Error {
  constructor(
    mensaje: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(mensaje);
  }
}

/** Quien hace algo: su correo y su nombre (y si está emulando, no se manda «como» él). */
export interface Quien {
  email: string;
  nombre: string;
  emulando?: boolean;
  /** Lo que se apunta como «hecho por» (`autorDe`: la persona real y a quién emulaba). */
  firma?: string;
}

// ─── El claustro ─────────────────────────────────────────────────────────────


async function getProfes(): Promise<ProfeSust[]> {
  const filas = await db
    .select({
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      nombreMostrado: eduTeachers.nombreMostrado,
      email: eduTeachers.email,
    })
    .from(eduTeachers)
    .where(eq(eduTeachers.active, true));
  return filas
    .map((p) => ({ id: p.id, nombre: nombreProfeBreve(p), pila: pilaProfe(p), email: p.email?.toLowerCase() ?? null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// ─── El horario de todo el centro ────────────────────────────────────────────

interface SesionBase {
  sesionId: string;
  rejillaId: string;
  periodoId: string;
  dia: number;
  tramo: string | null;
  horaInicio: string;
  horaFin: string;
  actividad: string;
  actividadNombre: string;
  etiqueta: string | null;
  materia: string | null;
  grupos: string[];
  aula: string | null;
  profes: { id: string; principal: boolean; rol: string }[];
}

interface TramoBase extends Franja {
  rejillaId: string;
  dia: number;
}

interface HorarioBase {
  periodos: PeriodoHorario[];
  rejillas: RejillaHorario[];
  sesiones: SesionBase[];
  tramos: TramoBase[];
  cuadro: { periodoId: string; dia: number; horaInicio: string; horaFin: string; profeId: string }[];
}

/** Todo el horario (periodos, rejillas, sesiones con grupos y profes, tramos y cuadro) en una tanda. */
async function getHorarioBase(): Promise<HorarioBase> {
  const espSesion = aliasedTable(horEspacios, 'esp_sesion');
  const espAsig = aliasedTable(horEspacios, 'esp_asig');
  const activas = db
    .select({ id: horAsignaciones.id })
    .from(horAsignaciones)
    .innerJoin(horPeriodos, eq(horPeriodos.id, horAsignaciones.periodoId))
    .where(and(eq(horAsignaciones.active, true), eq(horPeriodos.active, true)));
  const [periodos, rejillas, ambitos, filas, grupos, profes, tramos, cuadro] = await Promise.all([
    db
      .select({ id: horPeriodos.id, nombre: horPeriodos.nombre, fechaInicio: horPeriodos.fechaInicio, fechaFin: horPeriodos.fechaFin, prioridad: horPeriodos.prioridad, esOrdinario: horPeriodos.esOrdinario })
      .from(horPeriodos)
      .where(eq(horPeriodos.active, true)),
    db.select({ id: horRejillas.id, periodoId: horRejillas.periodoId }).from(horRejillas).where(eq(horRejillas.active, true)),
    db.select({ rejillaId: horRejillaAmbitos.rejillaId, etapa: horRejillaAmbitos.etapa, curso: horRejillaAmbitos.curso }).from(horRejillaAmbitos),
    db
      .select({
        sesionId: horSesiones.id,
        asignacionId: horAsignaciones.id,
        rejillaId: horTramos.rejillaId,
        periodoId: horAsignaciones.periodoId,
        dia: horSesiones.diaSemana,
        tramo: horTramos.etiqueta,
        tipo: horTramos.tipo,
        horaInicio: horTramos.horaInicio,
        horaFin: horTramos.horaFin,
        actividad: horActividades.codigo,
        actividadNombre: horActividades.nombre,
        etiqueta: horAsignaciones.etiqueta,
        materia: horMaterias.nombre,
        aulaSesion: horSesiones.aula,
        aulaAsig: horAsignaciones.aula,
        espSesionCodigo: espSesion.codigo,
        espSesionNombre: espSesion.nombre,
        espAsigCodigo: espAsig.codigo,
        espAsigNombre: espAsig.nombre,
      })
      .from(horSesiones)
      .innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId))
      .innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId))
      .innerJoin(horActividades, eq(horActividades.id, horAsignaciones.actividadId))
      .leftJoin(horMaterias, eq(horMaterias.id, horAsignaciones.materiaId))
      .leftJoin(espSesion, eq(espSesion.id, horSesiones.espacioId))
      .leftJoin(espAsig, eq(espAsig.id, horAsignaciones.espacioId))
      .where(inArray(horAsignaciones.id, activas)),
    db
      .select({ asignacionId: horAsignacionGrupos.asignacionId, curso: horAsignacionGrupos.curso, letra: horAsignacionGrupos.letra, subgrupo: horAsignacionGrupos.subgrupo })
      .from(horAsignacionGrupos)
      .where(inArray(horAsignacionGrupos.asignacionId, activas)),
    db
      .select({ asignacionId: horAsignacionProfes.asignacionId, id: horAsignacionProfes.eduTeacherId, principal: horAsignacionProfes.principal, rol: horAsignacionProfes.rol })
      .from(horAsignacionProfes)
      .where(inArray(horAsignacionProfes.asignacionId, activas)),
    db
      .select({ rejillaId: horTramos.rejillaId, dia: horTramos.diaSemana, horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin })
      .from(horTramos)
      .where(eq(horTramos.tipo, 'sesion')),
    db
      .select({ periodoId: horCuadroSustituciones.periodoId, dia: horCuadroSustituciones.diaSemana, horaInicio: horCuadroSustituciones.horaInicio, horaFin: horCuadroSustituciones.horaFin, profeId: horCuadroSustituciones.eduTeacherId })
      .from(horCuadroSustituciones)
      .where(isNotNull(horCuadroSustituciones.eduTeacherId)),
  ]);

  const gruposPor = new Map<string, { curso: string; letra: string | null; subgrupo: string | null }[]>();
  for (const g of grupos) gruposPor.set(g.asignacionId, [...(gruposPor.get(g.asignacionId) ?? []), g]);
  const profesPor = new Map<string, SesionBase['profes']>();
  for (const p of profes) profesPor.set(p.asignacionId, [...(profesPor.get(p.asignacionId) ?? []), { id: p.id, principal: p.principal, rol: p.rol }]);
  const ambitosPor = new Map<string, RejillaHorario['ambitos']>();
  for (const a of ambitos) ambitosPor.set(a.rejillaId, [...(ambitosPor.get(a.rejillaId) ?? []), { etapa: a.etapa, curso: a.curso }]);

  const sesiones: SesionBase[] = filas
    .filter((f) => f.tipo === 'sesion')
    .map((f) => {
      const gs = (gruposPor.get(f.asignacionId) ?? []).sort((a, b) => `${a.curso}${a.letra}`.localeCompare(`${b.curso}${b.letra}`));
      const codigo = f.aulaSesion ?? f.espSesionCodigo ?? f.aulaAsig ?? f.espAsigCodigo;
      const nombreEsp = codigo === f.espSesionCodigo ? f.espSesionNombre : codigo === f.espAsigCodigo ? f.espAsigNombre : null;
      return {
        sesionId: f.sesionId,
        rejillaId: f.rejillaId,
        periodoId: f.periodoId,
        dia: f.dia,
        tramo: f.tramo,
        horaInicio: f.horaInicio,
        horaFin: f.horaFin,
        actividad: f.actividad,
        actividadNombre: f.actividadNombre,
        etiqueta: f.etiqueta,
        materia: f.materia,
        grupos: gs.map((g) => etiquetaGrupo(g.curso, g.letra, g.subgrupo)),
        aula: aulaVisible(codigo, nombreEsp, gs),
        profes: profesPor.get(f.asignacionId) ?? [],
      };
    });

  return {
    periodos,
    rejillas: rejillas.map((r) => ({ id: r.id, periodoId: r.periodoId, ambitos: ambitosPor.get(r.id) ?? [] })),
    sesiones,
    tramos,
    cuadro: cuadro.filter((c): c is typeof c & { profeId: string } => Boolean(c.profeId)),
  };
}

function aSesionDia(s: SesionBase, fecha: string): SesionDia {
  return {
    sesionId: s.sesionId,
    fecha,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    tramo: s.tramo,
    actividad: s.actividad,
    actividadNombre: s.actividadNombre,
    etiqueta: s.etiqueta,
    grupos: s.grupos,
    materia: s.materia,
    aula: s.aula,
    profes: s.profes,
  };
}

/** Las sesiones de todo el claustro una fecha (rejillas que mandan ese día, con coberturas aplicadas). */
function sesionesDeFecha(base: HorarioBase, fecha: string, coberturas: readonly CoberturaBajaBase[]): { sesiones: SesionDia[]; notas: string[]; periodos: Set<string> } {
  const h = horarioDeFecha(fecha, base.periodos, base.rejillas);
  const dia = diaSemana(fecha);
  const sesiones = base.sesiones.filter((s) => s.dia === dia && h.rejillas.has(s.rejillaId)).map((s) => aSesionDia(s, fecha));
  const periodos = new Set(h.porEtapa.map((e) => e.periodo?.id).filter((x): x is string => Boolean(x)));
  return { sesiones: aplicarCoberturas(sesiones, coberturas), notas: notasDeHorario(h, base.periodos, fecha), periodos };
}

// ─── El contexto de una propuesta (una tanda para todo el rango) ─────────────

interface Cargado {
  base: HorarioBase;
  ctx: ContextoPropuesta;
  lectivos: string[];
  saltados: DiaSaltado[];
  notasPorDia: Map<string, string[]>;
  coberturas: CoberturaBajaBase[];
}

/** Ventanas de otras ausencias: de la primera a la última hora de cada una cada día. */
function ventanasDeAusencias(filas: { ausenciaId: string; profeId: string; fecha: string; horaInicio: string; horaFin: string }[]): Bloqueo[] {
  const por = new Map<string, Bloqueo>();
  for (const f of filas) {
    const k = `${f.ausenciaId}#${f.fecha}`;
    const b = por.get(k);
    if (!b) por.set(k, { profeId: f.profeId, fecha: f.fecha, horaInicio: f.horaInicio, horaFin: f.horaFin });
    else {
      if (f.horaInicio < b.horaInicio) b.horaInicio = f.horaInicio;
      if (f.horaFin > b.horaFin) b.horaFin = f.horaFin;
    }
  }
  return [...por.values()];
}

async function cargar(desde: string, hasta: string, excluirAusencia?: string | null): Promise<Cargado> {
  const academicYear = cursoDeFecha(desde);
  const inicioReparto = sumarDias(desde, -CFG.diasReparto);
  const inicioMes = `${desde.slice(0, 7)}-01`;
  const otra = excluirAusencia ? ne(sustAusencias.id, excluirAusencia) : undefined;
  const [base, profes, festivos, coberturas, sustFilas, oratorios, retoques, cargas, esteMes] = await Promise.all([
    getHorarioBase(),
    getProfes(),
    db
      .select({ inicio: horFestivos.fechaInicio, fin: horFestivos.fechaFin, nombre: horFestivos.nombre })
      .from(horFestivos)
      .where(and(lte(horFestivos.fechaInicio, hasta), gte(horFestivos.fechaFin, desde))),
    db
      .select({ sustitutoId: eduCoberturasBaja.sustitutoId, titularId: eduCoberturasBaja.titularId, desde: eduCoberturasBaja.desde, hasta: eduCoberturasBaja.hasta, activa: eduCoberturasBaja.activa })
      .from(eduCoberturasBaja)
      .where(eq(eduCoberturasBaja.activa, true)),
    db
      .select({
        ausenciaId: sustSesiones.ausenciaId,
        profeId: sustAusencias.profeId,
        fecha: sustSesiones.fecha,
        horaInicio: sustSesiones.horaInicio,
        horaFin: sustSesiones.horaFin,
        sustitutoId: sustSesiones.sustitutoId,
      })
      .from(sustSesiones)
      .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
      .where(and(eq(sustAusencias.estado, 'confirmada'), gte(sustSesiones.fecha, desde), lte(sustSesiones.fecha, hasta), otra)),
    db
      .select({ email: oraSesiones.responsableEmail, fecha: oraSesiones.fecha, horaInicio: oraSesiones.horaInicio, horaFin: oraSesiones.horaFin })
      .from(oraSesiones)
      .where(and(gte(oraSesiones.fecha, desde), lte(oraSesiones.fecha, hasta), ne(oraSesiones.estado, 'anulado'))),
    db
      .select({ profeId: sustDisponibilidad.profeId, dia: sustDisponibilidad.diaSemana, horaInicio: sustDisponibilidad.horaInicio, horaFin: sustDisponibilidad.horaFin, estado: sustDisponibilidad.estado, nota: sustDisponibilidad.nota })
      .from(sustDisponibilidad)
      .where(eq(sustDisponibilidad.academicYear, academicYear)),
    contarCubiertas(inicioReparto, sumarDias(desde, -1)),
    contarCubiertas(inicioMes, finDeMes(desde)),
  ]);

  const { lectivos, saltados } = diasLectivos(desde, hasta, festivos);
  const porEmail = new Map(profes.filter((p) => p.email).map((p) => [p.email!, p.id]));
  const horario: [string, SesionDia[]][] = [];
  const notasPorDia = new Map<string, string[]>();
  const cuadro: EnCuadro[] = [];
  const deBaja: [string, string[]][] = [];
  for (const f of lectivos) {
    const d = sesionesDeFecha(base, f, coberturas);
    horario.push([f, d.sesiones]);
    notasPorDia.set(f, d.notas);
    const dia = diaSemana(f);
    for (const c of base.cuadro) if (c.dia === dia && d.periodos.has(c.periodoId)) cuadro.push({ profeId: c.profeId, fecha: f, horaInicio: c.horaInicio, horaFin: c.horaFin });
    deBaja.push([f, [...titularesDeBaja(f, coberturas).keys()]]);
  }

  return {
    base,
    lectivos,
    saltados,
    notasPorDia,
    coberturas,
    ctx: {
      profes,
      horario,
      ausencias: ventanasDeAusencias(sustFilas),
      cubriendo: sustFilas.filter((s) => s.sustitutoId).map((s) => ({ profeId: s.sustitutoId!, fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin })),
      oratorios: oratorios
        .map((o) => ({ profeId: porEmail.get(o.email.toLowerCase()) ?? '', fecha: o.fecha, horaInicio: o.horaInicio, horaFin: o.horaFin }))
        .filter((o) => o.profeId),
      deBaja,
      retoques: retoques.map((r) => ({ ...r, estado: r.estado as Disponibilidad })),
      cuadro,
      cargas: [...cargas],
      esteMes: [...esteMes],
    },
  };
}

function finDeMes(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const sig = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return sumarDias(sig, -1);
}

/** Sesiones cubiertas por cada sustituto en un rango (ausencias confirmadas). */
async function contarCubiertas(desde: string, hasta: string): Promise<Map<string, number>> {
  if (hasta < desde) return new Map();
  const filas = await db
    .select({ id: sustSesiones.sustitutoId, n: sql<number>`count(*)::int` })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(and(eq(sustAusencias.estado, 'confirmada'), isNotNull(sustSesiones.sustitutoId), gte(sustSesiones.fecha, desde), lte(sustSesiones.fecha, hasta)))
    .groupBy(sustSesiones.sustitutoId);
  return new Map(filas.filter((f) => f.id).map((f) => [f.id!, Number(f.n)]));
}

// ─── La propuesta (no escribe) ───────────────────────────────────────────────

export interface DiaPropuesta {
  fecha: string;
  sesiones: SesionAusente[];
  notas: string[];
}

export interface RespuestaPropuesta {
  profe: { id: string; nombre: string };
  desde: string;
  hasta: string;
  dias: DiaPropuesta[];
  saltados: DiaSaltado[];
  /** Pasa del tope de días lectivos: es una cobertura por baja. */
  excede: boolean;
  /** Su baja la cubre alguien (no se le apunta una ausencia). */
  bajaCubiertaPor: string | null;
  /** Ya tiene otras ausencias en esas fechas (sus horas no se pueden repetir). */
  yaApuntadas: { fecha: string; horaInicio: string; horaFin: string }[];
  /** Horas en las que esta persona ya cubre a otra (si falta a esa hora, esas se quedan sin cubrir). */
  cubreYa: HoraQueCubre[];
  /** Con esto la pantalla calcula la propuesta (`proponerSustitutos`) y la rehace al cambiar algo. */
  contexto: ContextoPropuesta;
}

export async function propuesta(profeId: string, desde: string, hasta: string, excluirAusencia?: string | null): Promise<RespuestaPropuesta> {
  const c = await cargar(desde, hasta, excluirAusencia);
  const profe = c.ctx.profes.find((p) => p.id === profeId);
  if (!profe) throw new ErrorSustitucion('Ese profe no está en el claustro activo.', 404);
  const dias: DiaPropuesta[] = c.ctx.horario.map(([fecha, sesiones]) => ({ fecha, sesiones: sesionesDelAusente(sesiones, profeId), notas: c.notasPorDia.get(fecha) ?? [] }));
  const cubre = c.coberturas.find((x) => x.titularId === profeId && c.lectivos.some((f) => (!x.desde || x.desde <= f) && (!x.hasta || f <= x.hasta)));
  // Lo que ya está apuntado de este profe (otra ausencia): esas horas no se pueden repetir.
  const [yaApuntadas, cubreYa] = await Promise.all([horasApuntadas(profeId, desde, hasta, excluirAusencia), horasQueCubre(profeId, desde, hasta)]);
  const excede = excedeTope(c.lectivos);
  const bajaCubiertaPor = cubre ? (c.ctx.profes.find((p) => p.id === cubre.sustitutoId)?.nombre ?? 'otra persona') : null;
  // Lo que viaja a la pantalla: solo lo que hace falta para volver a proponer allí (recortado).
  const porDia = new Map(dias.map((d) => [d.fecha, d.sesiones]));
  const contexto: ContextoPropuesta = { ...c.ctx, horario: c.ctx.horario.map(([f, delDia]) => [f, recortarHorario(delDia, porDia.get(f) ?? [])]) };
  const base = { profe: { id: profe.id, nombre: profe.nombre }, desde, hasta, saltados: c.saltados, excede, bajaCubiertaPor, yaApuntadas, cubreYa };
  if (excede || bajaCubiertaPor) return { ...base, dias: [], contexto: { ...contexto, horario: [] } };
  return { ...base, dias, contexto };
}

export interface HoraQueCubre {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  grupos: string | null;
  /** A quién cubre. */
  cubreA: string;
}

/** Las horas en las que alguien cubre a otra persona en un rango (ausencias confirmadas). */
async function horasQueCubre(profeId: string, desde: string, hasta: string): Promise<HoraQueCubre[]> {
  return db
    .select({ id: sustSesiones.id, fecha: sustSesiones.fecha, horaInicio: sustSesiones.horaInicio, horaFin: sustSesiones.horaFin, grupos: sustSesiones.grupos, cubreA: sustAusencias.profeNombre })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(and(eq(sustSesiones.sustitutoId, profeId), eq(sustAusencias.estado, 'confirmada'), gte(sustSesiones.fecha, desde), lte(sustSesiones.fecha, hasta)))
    .orderBy(asc(sustSesiones.fecha), asc(sustSesiones.horaInicio));
}

// ─── Que dos personas no guarden lo mismo a la vez (decisión 9) ──────────────

/**
 * Dos sentencias que van al principio de la transacción (`db.batch`) de cada escritura que pone
 * sustitutos: un cerrojo que pone en fila las escrituras de Sustituciones y una guarda que REVIENTA
 * (división por cero → se deshace todo el lote) si, releído dentro de la transacción, alguno de los
 * elegidos ya cubre o falta a esa hora (`s`), o el ausente ya tiene otra ausencia a esa hora (`a`).
 * La comprobación amable de antes (`comprobarSustitutos`) da el mensaje con nombre y hora; esta es
 * la que cierra el hueco entre leer y escribir cuando dos personas de Jefatura confirman a la vez.
 */
function guardaSinChoques(filas: { tipo: 's' | 'a'; profeId: string; fecha: string; horaInicio: string; horaFin: string }[], excluirAusencia: string | null) {
  const cerrojo = db.execute(sql`select pg_advisory_xact_lock(hashtext('sust_sesiones'))`);
  if (filas.length === 0) return [cerrojo] as const;
  const valores = sql.join(
    filas.map((f) => sql`(${f.tipo}::text, ${f.profeId}::uuid, ${f.fecha}::date, ${f.horaInicio}::text, ${f.horaFin}::text)`),
    sql`, `,
  );
  const guarda = db.execute(sql`
    select 1 / (case when exists (
      select 1
      from (values ${valores}) as v(tipo, pid, f, hi, hf)
      join ${sustSesiones} s on s.fecha = v.f and s.hora_inicio < v.hf and v.hi < s.hora_fin
      join ${sustAusencias} a on a.id = s.ausencia_id and a.estado = 'confirmada'
      where (a.profe_id = v.pid or (v.tipo = 's' and s.sustituto_id = v.pid))
        ${excluirAusencia ? sql`and a.id <> ${excluirAusencia}::uuid` : sql``}
    ) then 0 else 1 end) as sin_choques`);
  return [cerrojo, guarda] as const;
}

/** Ejecuta el lote; si la guarda ha saltado, un 409 entendible. */
async function lote(sentencias: Parameters<typeof db.batch>[0]): Promise<void> {
  try {
    await db.batch(sentencias);
  } catch (e) {
    const texto = `${e instanceof Error ? e.message : ''} ${(e as { cause?: { message?: string; code?: string } })?.cause?.message ?? ''} ${(e as { cause?: { code?: string } })?.cause?.code ?? ''}`;
    if (/division by zero|22012/i.test(texto)) {
      throw new ErrorSustitucion('Alguien ha guardado otra sustitución a la vez con alguna de estas personas. Vuelve a cargar y revisa.', 409);
    }
    throw e;
  }
}

async function horasApuntadas(profeId: string, desde: string, hasta: string, excluir?: string | null) {
  return db
    .select({ fecha: sustSesiones.fecha, horaInicio: sustSesiones.horaInicio, horaFin: sustSesiones.horaFin })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(
      and(
        eq(sustAusencias.profeId, profeId),
        eq(sustAusencias.estado, 'confirmada'),
        gte(sustSesiones.fecha, desde),
        lte(sustSesiones.fecha, hasta),
        excluir ? ne(sustAusencias.id, excluir) : undefined,
      ),
    );
}

// ─── Plantillas (cfg_ajustes) ────────────────────────────────────────────────

export async function getPlantillas(): Promise<Plantillas & { _meta: { updatedAt: Date | null; updatedByEmail: string | null } }> {
  const [fila] = await db.select().from(cfgAjustes).where(eq(cfgAjustes.clave, CLAVE_PLANTILLAS));
  return { ...leerPlantillas(fila?.valor), _meta: { updatedAt: fila?.updatedAt ?? null, updatedByEmail: fila?.updatedByEmail ?? null } };
}

export async function guardarPlantillas(p: Plantillas | null, email: string): Promise<void> {
  if (p === null) {
    await db.delete(cfgAjustes).where(eq(cfgAjustes.clave, CLAVE_PLANTILLAS));
    return;
  }
  const valor = leerPlantillas(p);
  await db
    .insert(cfgAjustes)
    .values({ clave: CLAVE_PLANTILLAS, valor, updatedByEmail: email, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cfgAjustes.clave, set: { valor, updatedByEmail: email, updatedAt: new Date() } });
}

// ─── Correos ─────────────────────────────────────────────────────────────────

interface ResultadoAvisos {
  enviados: number;
  fallidos: { nombre: string; error: string }[];
}

const vacio = (): ResultadoAvisos => ({ enviados: 0, fallidos: [] });
function sumar(a: ResultadoAvisos, b: ResultadoAvisos): ResultadoAvisos {
  return { enviados: a.enviados + b.enviados, fallidos: [...a.fallidos, ...b.fallidos] };
}

function aHora(s: SustSesion, profes?: Map<string, ProfeSust>): HoraBloque {
  return {
    fecha: s.fecha,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    grupos: s.grupos,
    aula: s.aula,
    materia: s.materia,
    quien: s.sustitutoId ? (profes?.get(s.sustitutoId)?.pila ?? s.sustitutoNombre) : null,
    noHaceFalta: !s.hayQueCubrir,
  };
}

async function mandar(para: string, d: Parameters<typeof correoAviso>[0], q: Quien): Promise<string | null> {
  const { subject, html } = correoAviso(d);
  try {
    await enviar('sustituciones', { to: para, subject, html, replyTo: q.email });
    return null;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('Sustituciones · correo:', m);
    return m.slice(0, 300);
  }
}

/**
 * Avisa a los sustitutos de unas sesiones (uno por persona, con todas sus horas) y apunta en cada
 * sesión si salió o falló. Un correo que falla NO deshace nada: la ficha enseña el error y «Reenviar».
 */
async function avisarSustitutos(a: SustAusencia, sesiones: SustSesion[], q: Quien, plantillas: Plantillas, profes: Map<string, ProfeSust>, tipo?: 'cambio' | 'anulacion'): Promise<ResultadoAvisos> {
  const res = vacio();
  const grupos = new Map<string, SustSesion[]>();
  for (const s of sesiones) {
    if (!s.sustitutoId) continue;
    const t: TipoPlantilla = tipo ?? (s.nivel === 'en_aula' ? 'en_aula' : 'sustituto');
    const k = `${s.sustitutoId}#${t}`;
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  const ausente = profes.get(a.profeId);
  for (const [k, lista] of grupos) {
    const [sustitutoId, t] = k.split('#') as [string, TipoPlantilla];
    const p = profes.get(sustitutoId);
    const email = p?.email ?? lista[0].sustitutoEmail;
    const token = !tipo ? crypto.randomUUID() : null;
    if (token) await db.update(sustSesiones).set({ confirmacionToken: token, confirmacionEstado: 'pendiente', confirmacionAt: null }).where(inArray(sustSesiones.id, lista.map((s) => s.id)));
    let error: string | null;
    if (!email) error = 'No tiene correo en la BBDD central';
    else {
      const fechas = lista.map((s) => s.fecha).sort();
      error = await mandar(
        email,
        {
          tipo: t,
          plantilla: plantillas[t],
          para: p?.pila ?? lista[0].sustitutoNombre ?? '',
          ausente: ausente?.nombre ?? a.profeNombre,
          quien: q.nombre,
          desde: fechas[0],
          hasta: fechas[fechas.length - 1],
          horas: lista.map((s) => aHora(s)),
          indicaciones: a.indicaciones,
          confirmacionUrl: token ? `${appBaseUrl()}/sustituciones/confirmar/${token}` : undefined,
        },
        q,
      );
    }
    if (error) res.fallidos.push({ nombre: p?.nombre ?? lista[0].sustitutoNombre ?? '—', error });
    else res.enviados++;
    // «Ya no hace falta» y anulación no cambian el estado del aviso de la sesión (ya no tiene a esa persona).
    if (!tipo) {
      const ids = lista.map((s) => s.id);
      await db
        .update(sustSesiones)
        .set(error ? { avisoEstado: 'error', avisoError: error, updatedAt: new Date() } : { avisoEstado: 'enviado', avisoError: null, avisoEnviadoAt: new Date(), updatedAt: new Date() })
        .where(inArray(sustSesiones.id, ids));
    }
  }
  return res;
}

/** Al ausente: qué horas se cubren y quién entra (o la anulación). Sin motivo. */
async function avisarAusente(a: SustAusencia, sesiones: SustSesion[], q: Quien, plantillas: Plantillas, profes: Map<string, ProfeSust>, tipo: 'ausente' | 'anulacion' = 'ausente'): Promise<ResultadoAvisos> {
  if (!a.avisarAusente) return vacio();
  const p = profes.get(a.profeId);
  if (!p?.email) return { enviados: 0, fallidos: [{ nombre: a.profeNombre, error: 'No tiene correo en la BBDD central' }] };
  if (sesiones.length === 0) return vacio();
  const error = await mandar(
    p.email,
    { tipo, plantilla: plantillas[tipo], para: p.pila, ausente: p.nombre, quien: q.nombre, desde: a.desde, hasta: a.hasta, horas: sesiones.map((s) => aHora(s, profes)) },
    q,
  );
  return error ? { enviados: 0, fallidos: [{ nombre: p.nombre, error }] } : { enviados: 1, fallidos: [] };
}

/** Confirmación pública por enlace aleatorio enviado al sustituto. */
export async function confirmarPorEnlace(token: string): Promise<'confirmada' | 'ya_confirmada' | 'no_encontrada'> {
  const [s] = await db.select({ id: sustSesiones.id, estado: sustSesiones.confirmacionEstado }).from(sustSesiones).innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId)).where(and(eq(sustSesiones.confirmacionToken, token), eq(sustAusencias.estado, 'confirmada'), isNotNull(sustSesiones.sustitutoId))).limit(1);
  if (!s) return 'no_encontrada';
  if (s.estado === 'confirmada') return 'ya_confirmada';
  await db.update(sustSesiones).set({ confirmacionEstado: 'confirmada', confirmacionAt: new Date(), updatedAt: new Date() }).where(and(eq(sustSesiones.confirmacionToken, token), eq(sustSesiones.confirmacionEstado, 'pendiente')));
  return 'confirmada';
}

async function profesPorId(): Promise<Map<string, ProfeSust>> {
  return new Map((await getProfes()).map((p) => [p.id, p]));
}

// ─── Confirmar (decisión 9) ──────────────────────────────────────────────────

/** Comprueba que los sustitutos elegidos siguen libres, releyendo la BBDD. Lanza 409 si alguno choca. */
function comprobarSustitutos(
  elegidas: { fecha: string; horaInicio: string; horaFin: string; sustitutoId: string | null }[],
  ausenteId: string,
  ctx: ContextoPropuesta,
) {
  const nombre = (id: string) => ctx.profes.find((p) => p.id === id)?.nombre ?? 'Esa persona';
  const deBaja = new Map(ctx.deBaja);
  for (const [i, s] of elegidas.entries()) {
    if (!s.sustitutoId) continue;
    const cuando = `el ${fechaLarga(s.fecha)} a las ${hora(s.horaInicio)}`;
    if (s.sustitutoId === ausenteId) throw new ErrorSustitucion('Quien falta no puede cubrirse a sí mismo.');
    if (!ctx.profes.some((p) => p.id === s.sustitutoId)) throw new ErrorSustitucion(`${nombre(s.sustitutoId)} no está en el claustro activo.`);
    if ((deBaja.get(s.fecha) ?? []).includes(s.sustitutoId)) throw new ErrorSustitucion(`${nombre(s.sustitutoId)} está de baja ${cuando}.`, 409);
    const choca = (b: Bloqueo) => b.profeId === s.sustitutoId && b.fecha === s.fecha && solapa(b, s);
    if (ctx.ausencias.some(choca)) throw new ErrorSustitucion(`${nombre(s.sustitutoId)} también falta ${cuando}.`, 409);
    if (ctx.cubriendo.some(choca)) throw new ErrorSustitucion(`${nombre(s.sustitutoId)} ya cubre a otra persona ${cuando}. Vuelve a cargar la propuesta.`, 409);
    if (ctx.oratorios.some(choca)) throw new ErrorSustitucion(`${nombre(s.sustitutoId)} lleva un Oratorio ${cuando}.`, 409);
    if (elegidas.some((o, j) => j !== i && o.sustitutoId === s.sustitutoId && o.fecha === s.fecha && solapa(o, s)))
      throw new ErrorSustitucion(`${nombre(s.sustitutoId)} sale dos veces a la misma hora ${cuando}.`, 409);
  }
}

/** La foto de una sesión del horario para guardarla. */
function filaSesion(
  ausenciaId: string,
  s: SesionAusente,
  sustitutoId: string | null,
  ctx: ContextoPropuesta,
  delDia: readonly SesionDia[],
): NewSustSesion {
  const p = sustitutoId ? ctx.profes.find((x) => x.id === sustitutoId) : null;
  let nivel: string | null = null;
  let disponibilidad: string | null = null;
  if (sustitutoId) {
    const ev = evaluar(sustitutoId, s, delDia, ctx.retoques, diaSemana(s.fecha), { mismaSesion: s.otrosEnAula.includes(sustitutoId) ? s.sesionId : null });
    nivel = ev.nivel ?? NIVEL_MANUAL;
    disponibilidad = ev.disponibilidad;
  }
  return {
    ausenciaId,
    fecha: s.fecha,
    horSesionId: s.sesionId,
    tramo: s.tramo,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    grupos: s.grupos.join(', ') || null,
    materia: s.materia ?? s.etiqueta ?? s.actividadNombre ?? null,
    aula: s.aula,
    actividad: s.actividad,
    hayQueCubrir: s.hayQueCubrir,
    sustitutoId: s.hayQueCubrir ? sustitutoId : null,
    sustitutoNombre: s.hayQueCubrir ? (p?.nombre ?? null) : null,
    sustitutoEmail: s.hayQueCubrir ? (p?.email ?? null) : null,
    nivel: s.hayQueCubrir ? nivel : null,
    disponibilidad: s.hayQueCubrir ? disponibilidad : null,
    avisoEstado: 'no',
  };
}

/** Resuelve las sesiones pedidas contra el horario de esos días (y que no repitan horas ya apuntadas). */
function resolverPedidas(
  pedidas: { fecha: string; horSesionId: string; sustitutoId: string | null }[],
  profeId: string,
  c: Cargado,
  yaApuntadas: { fecha: string; horaInicio: string; horaFin: string }[],
): { s: SesionAusente; sustitutoId: string | null; delDia: readonly SesionDia[] }[] {
  const horario = new Map(c.ctx.horario);
  const vistas = new Set<string>();
  return pedidas.map((p) => {
    const delDia = horario.get(p.fecha);
    if (!delDia) throw new ErrorSustitucion(`El ${fechaLarga(p.fecha)} no es lectivo.`);
    const s = sesionesDelAusente(delDia, profeId).find((x) => x.sesionId === p.horSesionId);
    if (!s) throw new ErrorSustitucion(`Una de las horas del ${fechaLarga(p.fecha)} ya no está en su horario. Vuelve a cargar la propuesta.`);
    const k = claveSesion(s);
    if (vistas.has(k)) throw new ErrorSustitucion('Hay una hora repetida.');
    vistas.add(k);
    if (yaApuntadas.some((y) => y.fecha === s.fecha && solapa(y, s)))
      throw new ErrorSustitucion(`Ya hay otra ausencia suya el ${fechaLarga(s.fecha)} a las ${hora(s.horaInicio)}: dos ausencias no pueden solaparse.`, 409);
    return { s, sustitutoId: s.hayQueCubrir ? p.sustitutoId : null, delDia };
  });
}

export interface ResultadoConfirmar {
  id: string;
  avisos: ResultadoAvisos | null;
  /** Horas que esta persona cubría a otros y se han quedado sin cubrir. */
  liberadas: HoraQueCubre[];
}

/**
 * Crea la ausencia y sus sesiones en UNA escritura (`db.batch`), después de volver a comprobar en el
 * servidor que ningún sustituto se ha ocupado mientras tanto (dos personas de Jefatura a la vez: 409
 * con el nombre, el día y la hora, y no se guarda nada). Luego, si toca, los correos.
 */
export async function confirmarAusencia(e: EntradaAusencia, q: Quien): Promise<ResultadoConfirmar> {
  const c = await cargar(e.desde, e.hasta);
  const profe = c.ctx.profes.find((p) => p.id === e.profeId);
  if (!profe) throw new ErrorSustitucion('Ese profe no está en el claustro activo.', 404);
  if (excedeTope(c.lectivos)) throw new ErrorSustitucion(`Son más de ${CFG.maxDiasAusencia} días lectivos: es una cobertura por baja (Profesorado y tutorías).`);
  if (c.ctx.deBaja.some(([, ids]) => ids.includes(e.profeId))) throw new ErrorSustitucion('Su baja ya la cubre alguien (Coberturas por baja): no se le apunta una ausencia.');
  for (const s of e.sesiones) if (s.fecha < e.desde || s.fecha > e.hasta) throw new ErrorSustitucion('Hay una hora fuera de las fechas de la ausencia.');
  const yaApuntadas = await horasApuntadas(e.profeId, e.desde, e.hasta);
  const elegidas = resolverPedidas(e.sesiones, e.profeId, c, yaApuntadas);
  comprobarSustitutos(
    elegidas.map((x) => ({ fecha: x.s.fecha, horaInicio: x.s.horaInicio, horaFin: x.s.horaFin, sustitutoId: x.sustitutoId })),
    e.profeId,
    c.ctx,
  );

  const id = crypto.randomUUID();
  const ahora = new Date();
  const filas = elegidas.map((x) => ({ ...filaSesion(id, x.s, x.sustitutoId, c.ctx, x.delDia), id: crypto.randomUUID() }));
  // Si quien falta estaba cubriendo a otra persona a esas horas, esas horas se quedan sin cubrir (y se ven en ámbar en «Hoy»).
  const liberadas = cubreDentro(await horasQueCubre(e.profeId, e.desde, e.hasta), filas);
  const guardas = guardaSinChoques(
    [
      ...filas.map((f) => ({ tipo: 'a' as const, profeId: e.profeId, fecha: f.fecha, horaInicio: f.horaInicio, horaFin: f.horaFin })),
      ...filas.filter((f) => f.sustitutoId).map((f) => ({ tipo: 's' as const, profeId: f.sustitutoId!, fecha: f.fecha, horaInicio: f.horaInicio, horaFin: f.horaFin })),
    ],
    null,
  );
  await lote([
    ...guardas,
    ...(liberadas.length > 0 ? [soltar(liberadas.map((l) => l.id), ahora)] : []),
    db.insert(sustAusencias).values({
      id,
      academicYear: cursoDeFecha(e.desde),
      desde: e.desde,
      hasta: e.hasta,
      profeId: profe.id,
      profeNombre: profe.nombre,
      etapa: await etapaProfe(profe.id),
      avisarAusente: e.avisarAusente,
      motivo: e.motivo,
      nota: e.nota?.trim() || null,
      indicaciones: e.indicaciones?.trim() || null,
      estado: 'confirmada',
      creadaPorEmail: q.firma ?? q.email,
      createdAt: ahora,
      updatedAt: ahora,
    }),
    db.insert(sustSesiones).values(filas),
  ]);

  if (!e.avisar) return { id, avisos: null, liberadas };
  return { id, avisos: await avisarTodo(id, q), liberadas };
}

async function etapaProfe(profeId: string): Promise<string> {
  const [p] = await db.select({ etapa: eduTeachers.etapa, etapas: eduTeachers.etapas }).from(eduTeachers).where(eq(eduTeachers.id, profeId)).limit(1);
  const etapas = [...new Set([...(p?.etapa ? [p.etapa] : []), ...(p?.etapas ?? [])])];
  return etapas.find((x) => (CONFIGURACION.sustituciones.etapas as readonly string[]).includes(x)) ?? 'EP';
}

/** Deja sin sustituto unas horas (quien las cubría ahora falta). */
function soltar(ids: string[], ahora: Date) {
  return db
    .update(sustSesiones)
    .set({ sustitutoId: null, sustitutoNombre: null, sustitutoEmail: null, nivel: null, disponibilidad: null, avisoEstado: 'no', avisoError: null, avisoEnviadoAt: null, confirmacionToken: null, confirmacionEstado: 'pendiente', confirmacionAt: null, updatedAt: ahora })
    .where(inArray(sustSesiones.id, ids));
}

/** Avisa a los sustitutos (los que aún no lo están, o todos) y al ausente. */
async function avisarTodo(id: string, q: Quien, soloPendientes = false): Promise<ResultadoAvisos> {
  const [{ a, sesiones }, plantillas, profes] = await Promise.all([leerAusencia(id), getPlantillas(), profesPorId()]);
  const aSustitutos = sesiones.filter((s) => s.sustitutoId && (!soloPendientes || s.avisoEstado !== 'enviado'));
  const r1 = await avisarSustitutos(a, aSustitutos, q, plantillas, profes);
  const r2 = soloPendientes || !a.avisarAusente ? vacio() : await avisarAusente(a, sesiones, q, plantillas, profes);
  return sumar(r1, r2);
}

async function leerAusencia(id: string): Promise<{ a: SustAusencia; sesiones: SustSesion[] }> {
  const [[a], sesiones] = await Promise.all([
    db.select().from(sustAusencias).where(eq(sustAusencias.id, id)).limit(1),
    db.select().from(sustSesiones).where(eq(sustSesiones.ausenciaId, id)).orderBy(asc(sustSesiones.fecha), asc(sustSesiones.horaInicio)),
  ]);
  if (!a) throw new ErrorSustitucion('Esa ausencia no existe.', 404);
  return { a, sesiones };
}

// ─── Después de confirmar (decisión 9) ───────────────────────────────────────

export async function reenviarAvisos(id: string, todos: boolean, q: Quien): Promise<ResultadoAvisos> {
  const { a } = await leerAusencia(id);
  if (a.estado === 'anulada') throw new ErrorSustitucion('Esa ausencia está anulada.');
  return avisarTodo(id, q, !todos);
}

/** Cambiar sustituto, añadir o quitar horas, fechas, indicaciones, motivo o anular. */
export async function cambiarAusencia(id: string, cambio: EntradaCambio, q: Quien): Promise<{ avisos: ResultadoAvisos | null }> {
  const { a, sesiones } = await leerAusencia(id);
  if (a.estado === 'anulada') throw new ErrorSustitucion('Esa ausencia está anulada: ya no se puede cambiar.');
  const ahora = new Date();
  const tocar = () => db.update(sustAusencias).set({ updatedAt: ahora }).where(eq(sustAusencias.id, id));

  if (cambio.accion === 'indicaciones') {
    await db.update(sustAusencias).set({ indicaciones: cambio.indicaciones?.trim() || null, updatedAt: ahora }).where(eq(sustAusencias.id, id));
    return { avisos: null };
  }
  if (cambio.accion === 'motivo') {
    if (cambio.motivo === 'otros' && !cambio.nota?.trim()) throw new ErrorSustitucion('Con «Otros», escribe una nota corta.');
    await db.update(sustAusencias).set({ motivo: cambio.motivo, nota: cambio.nota?.trim() || null, updatedAt: ahora }).where(eq(sustAusencias.id, id));
    return { avisos: null };
  }

  const [plantillas, profes] = await Promise.all([getPlantillas(), profesPorId()]);

  if (cambio.accion === 'anular') {
    await db.update(sustAusencias).set({ estado: 'anulada', anuladaPorEmail: q.firma ?? q.email, anuladaAt: ahora, updatedAt: ahora }).where(eq(sustAusencias.id, id));
    if (!cambio.avisar) return { avisos: null };
    const hoy = hoyEnEspana();
    const futuras = sesiones.filter((s) => s.fecha >= hoy);
    const r1 = await avisarSustitutos(a, futuras.filter((s) => s.avisoEstado === 'enviado'), q, plantillas, profes, 'anulacion');
    const r2 = futuras.length > 0 ? await avisarAusente(a, futuras, q, plantillas, profes, 'anulacion') : vacio();
    return { avisos: sumar(r1, r2) };
  }

  if (cambio.accion === 'quitar') {
    const s = sesiones.find((x) => x.id === cambio.sesionId);
    if (!s) throw new ErrorSustitucion('Esa hora no es de esta ausencia.', 404);
    if (sesiones.length === 1) throw new ErrorSustitucion('Es la única hora: si al final no falta, anula la ausencia.');
    await db.batch([db.delete(sustSesiones).where(eq(sustSesiones.id, s.id)), tocar()]);
    if (!cambio.avisar) return { avisos: null };
    const resto = sesiones.filter((x) => x.id !== s.id);
    const r1 = s.sustitutoId && s.avisoEstado === 'enviado' ? await avisarSustitutos(a, [s], q, plantillas, profes, 'cambio') : vacio();
    return { avisos: sumar(r1, await avisarAusente(a, resto, q, plantillas, profes)) };
  }

  if (cambio.accion === 'fechas') {
    if (cambio.hasta < cambio.desde) throw new ErrorSustitucion('La fecha de fin va después de la de inicio.');
    const fuera = sesiones.filter((s) => s.fecha < cambio.desde || s.fecha > cambio.hasta);
    if (fuera.length === sesiones.length) throw new ErrorSustitucion('Con esas fechas no le queda ninguna hora: si al final no falta, anula la ausencia.');
    const { lectivos } = diasLectivos(cambio.desde, cambio.hasta, await festivosEntre(cambio.desde, cambio.hasta));
    if (excedeTope(lectivos)) throw new ErrorSustitucion(`Son más de ${CFG.maxDiasAusencia} días lectivos: es una cobertura por baja.`);
    // Si alarga, los días nuevos no traen horas solas: se añaden después desde la ficha («Añadir horas»),
    // que es donde se comprueba que no se solapen con otra ausencia suya.
    const fechas = db.update(sustAusencias).set({ desde: cambio.desde, hasta: cambio.hasta, academicYear: cursoDeFecha(cambio.desde), updatedAt: ahora }).where(eq(sustAusencias.id, id));
    if (fuera.length > 0) await db.batch([db.delete(sustSesiones).where(inArray(sustSesiones.id, fuera.map((s) => s.id))), fechas]);
    else await fechas;
    if (!cambio.avisar || fuera.length === 0) return { avisos: null };
    const r1 = await avisarSustitutos(a, fuera.filter((s) => s.avisoEstado === 'enviado'), q, plantillas, profes, 'cambio');
    const a2 = { ...a, desde: cambio.desde, hasta: cambio.hasta };
    return { avisos: sumar(r1, await avisarAusente(a2, sesiones.filter((s) => !fuera.includes(s)), q, plantillas, profes)) };
  }

  if (cambio.accion === 'cambiar') {
    const s = sesiones.find((x) => x.id === cambio.sesionId);
    if (!s) throw new ErrorSustitucion('Esa hora no es de esta ausencia.', 404);
    if (!s.hayQueCubrir) throw new ErrorSustitucion('Esa hora solo cuenta: no lleva sustituto.');
    if (s.sustitutoId === cambio.sustitutoId) return { avisos: null };
    const c = await cargar(s.fecha, s.fecha, id);
    // Las demás horas de esta misma ausencia también cuentan como ocupadas.
    const otrasMias = sesiones.filter((x) => x.id !== s.id && x.sustitutoId).map((x) => ({ profeId: x.sustitutoId!, fecha: x.fecha, horaInicio: x.horaInicio, horaFin: x.horaFin }));
    comprobarSustitutos([{ fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, sustitutoId: cambio.sustitutoId }], a.profeId, { ...c.ctx, cubriendo: [...c.ctx.cubriendo, ...otrasMias] });
    const delDia = new Map(c.ctx.horario).get(s.fecha) ?? [];
    const enHorario = s.horSesionId ? sesionesDelAusente(delDia, a.profeId).find((x) => x.sesionId === s.horSesionId) : undefined;
    const p = cambio.sustitutoId ? profes.get(cambio.sustitutoId) : null;
    let nivel: string | null = null;
    let disponibilidad: string | null = null;
    if (cambio.sustitutoId) {
      const ev = evaluar(cambio.sustitutoId, s, delDia, c.ctx.retoques, diaSemana(s.fecha), { mismaSesion: enHorario?.otrosEnAula.includes(cambio.sustitutoId) ? enHorario.sesionId : null });
      nivel = ev.nivel ?? NIVEL_MANUAL;
      disponibilidad = ev.disponibilidad;
    }
    const nueva: SustSesion = {
      ...s,
      sustitutoId: cambio.sustitutoId,
      sustitutoNombre: p?.nombre ?? null,
      sustitutoEmail: p?.email ?? null,
      nivel,
      disponibilidad,
      avisoEstado: 'no',
      avisoError: null,
      avisoEnviadoAt: null,
      confirmacionToken: null,
      confirmacionEstado: 'pendiente',
      confirmacionAt: null,
      updatedAt: ahora,
    };
    // Las demás horas de ESTA ausencia no entran en la guarda (se excluye entera): ya se comprobaron arriba.
    const guardas = guardaSinChoques(cambio.sustitutoId ? [{ tipo: 's', profeId: cambio.sustitutoId, fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin }] : [], id);
    await lote([
      ...guardas,
      db
        .update(sustSesiones)
        .set({ sustitutoId: nueva.sustitutoId, sustitutoNombre: nueva.sustitutoNombre, sustitutoEmail: nueva.sustitutoEmail, nivel, disponibilidad, avisoEstado: 'no', avisoError: null, avisoEnviadoAt: null, confirmacionToken: null, confirmacionEstado: 'pendiente', confirmacionAt: null, updatedAt: ahora })
        .where(eq(sustSesiones.id, s.id)),
      tocar(),
    ]);
    if (!cambio.avisar) return { avisos: null };
    const r0 = s.sustitutoId && s.avisoEstado === 'enviado' ? await avisarSustitutos(a, [s], q, plantillas, profes, 'cambio') : vacio();
    const r1 = nueva.sustitutoId ? await avisarSustitutos(a, [nueva], q, plantillas, profes) : vacio();
    const todas = sesiones.map((x) => (x.id === s.id ? nueva : x));
    return { avisos: sumar(sumar(r0, r1), await avisarAusente(a, todas, q, plantillas, profes)) };
  }

  // anadir
  for (const p of cambio.sesiones) if (p.fecha < a.desde || p.fecha > a.hasta) throw new ErrorSustitucion('Esa hora cae fuera de las fechas de la ausencia: cambia antes las fechas.');
  const fechas = cambio.sesiones.map((x) => x.fecha).sort();
  const c = await cargar(fechas[0], fechas[fechas.length - 1], id);
  const yaApuntadas = [
    ...(await horasApuntadas(a.profeId, fechas[0], fechas[fechas.length - 1], id)),
    ...sesiones.map((s) => ({ fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin })),
  ];
  const elegidas = resolverPedidas(cambio.sesiones, a.profeId, c, yaApuntadas);
  const otrasMias = sesiones.filter((x) => x.sustitutoId).map((x) => ({ profeId: x.sustitutoId!, fecha: x.fecha, horaInicio: x.horaInicio, horaFin: x.horaFin }));
  comprobarSustitutos(
    elegidas.map((x) => ({ fecha: x.s.fecha, horaInicio: x.s.horaInicio, horaFin: x.s.horaFin, sustitutoId: x.sustitutoId })),
    a.profeId,
    { ...c.ctx, cubriendo: [...c.ctx.cubriendo, ...otrasMias] },
  );
  const filas = elegidas.map((x) => ({ ...filaSesion(id, x.s, x.sustitutoId, c.ctx, x.delDia), id: crypto.randomUUID() }));
  const guardas = guardaSinChoques(
    [
      ...filas.map((f) => ({ tipo: 'a' as const, profeId: a.profeId, fecha: f.fecha, horaInicio: f.horaInicio, horaFin: f.horaFin })),
      ...filas.filter((f) => f.sustitutoId).map((f) => ({ tipo: 's' as const, profeId: f.sustitutoId!, fecha: f.fecha, horaInicio: f.horaInicio, horaFin: f.horaFin })),
    ],
    id,
  );
  await lote([...guardas, db.insert(sustSesiones).values(filas), tocar()]);
  if (!cambio.avisar) return { avisos: null };
  const nuevas = (await leerAusencia(id)).sesiones;
  const r1 = await avisarSustitutos(a, nuevas.filter((s) => filas.some((f) => f.id === s.id)), q, plantillas, profes);
  return { avisos: sumar(r1, await avisarAusente(a, nuevas, q, plantillas, profes)) };
}

async function festivosEntre(desde: string, hasta: string) {
  return db
    .select({ inicio: horFestivos.fechaInicio, fin: horFestivos.fechaFin, nombre: horFestivos.nombre })
    .from(horFestivos)
    .where(and(lte(horFestivos.fechaInicio, hasta), gte(horFestivos.fechaFin, desde)));
}

// ─── La ficha de una ausencia ────────────────────────────────────────────────

export interface FichaAusencia {
  ausencia: SustAusencia;
  sesiones: SustSesion[];
  /** Por sesión a cubrir, los candidatos (para cambiar el sustituto en el sitio). */
  candidatos: Record<string, PropuestaSesion>;
  /** Horas de su horario en esas fechas que aún no están en la ausencia (para «Añadir hora»). */
  sinApuntar: SesionAusente[];
  saltados: DiaSaltado[];
}

export async function fichaAusencia(id: string): Promise<FichaAusencia> {
  const { a, sesiones } = await leerAusencia(id);
  if (a.estado === 'anulada') return { ausencia: a, sesiones, candidatos: {}, sinApuntar: [], saltados: [] };
  const c = await cargar(a.desde, a.hasta, id);
  const horario = new Map(c.ctx.horario);
  const delAusente = new Map<string, SesionAusente>();
  for (const [, dia] of horario) for (const s of sesionesDelAusente(dia, a.profeId)) delAusente.set(claveSesion(s), s);
  // Las sesiones de la ficha como entrada de la propuesta: con lo elegido fijado, cada una ve a quién más puede poner.
  const aCubrir: SesionAusente[] = [];
  const fijados: Record<string, string | null> = {};
  const porClave = new Map<string, string>();
  for (const s of sesiones) {
    if (!s.hayQueCubrir || !s.horSesionId) continue;
    const enHorario = delAusente.get(`${s.fecha}#${s.horSesionId}`);
    const ses: SesionAusente = enHorario ?? {
      sesionId: s.horSesionId,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      tramo: s.tramo,
      actividad: s.actividad ?? 'clase',
      etiqueta: null,
      grupos: s.grupos ? [s.grupos] : [],
      materia: s.materia,
      aula: s.aula,
      profes: [],
      hayQueCubrir: true,
      otrosEnAula: [],
    };
    aCubrir.push(ses);
    fijados[claveSesion(ses)] = s.sustitutoId;
    porClave.set(claveSesion(ses), s.id);
  }
  const prop = proponerSustitutos(entradaDesdeContexto(c.ctx, aCubrir, a.profeId, fijados));
  const candidatos: Record<string, PropuestaSesion> = {};
  for (const p of prop) {
    const sid = porClave.get(p.clave);
    if (sid) candidatos[sid] = p;
  }
  const apuntadas = new Set(sesiones.map((s) => `${s.fecha}#${s.horSesionId}`));
  const sinApuntar = [...delAusente.values()].filter((s) => !apuntadas.has(claveSesion(s)) && !sesiones.some((x) => x.fecha === s.fecha && solapa(x, s))).sort(ordenSesion);
  return { ausencia: a, sesiones, candidatos, sinApuntar, saltados: c.saltados };
}

/** Los candidatos para añadir unas horas a una ausencia ya confirmada (la ficha los pide al abrir «Añadir hora»). */
export async function propuestaParaAnadir(id: string, claves: string[]): Promise<PropuestaSesion[]> {
  const { a, sesiones } = await leerAusencia(id);
  const fechas = claves.map((k) => k.split('#')[0]).sort();
  if (fechas.length === 0) return [];
  const c = await cargar(fechas[0], fechas[fechas.length - 1], id);
  const horario = new Map(c.ctx.horario);
  const elegidas = claves
    .map((k) => {
      const [fecha, sesionId] = k.split('#');
      return sesionesDelAusente(horario.get(fecha) ?? [], a.profeId).find((s) => s.sesionId === sesionId);
    })
    .filter((s): s is SesionAusente => Boolean(s && s.hayQueCubrir));
  const otrasMias = sesiones.filter((x) => x.sustitutoId).map((x) => ({ profeId: x.sustitutoId!, fecha: x.fecha, horaInicio: x.horaInicio, horaFin: x.horaFin }));
  return proponerSustitutos(entradaDesdeContexto({ ...c.ctx, cubriendo: [...c.ctx.cubriendo, ...otrasMias] }, elegidas, a.profeId));
}

// ─── Listas ──────────────────────────────────────────────────────────────────

export interface FilaHoy {
  sesionId: string;
  ausenciaId: string;
  profe: string;
  tramo: string | null;
  horaInicio: string;
  horaFin: string;
  grupos: string | null;
  materia: string | null;
  aula: string | null;
  hayQueCubrir: boolean;
  sustituto: string | null;
  nivel: string | null;
  avisoEstado: string;
}

export interface DatosHoy {
  fecha: string;
  filas: FilaHoy[];
  aCubrir: number;
  cubiertas: number;
  sinCubrir: number;
  conError: number;
}

/** Las horas de un día, por hora (es como lo piensa Jefatura a las 8:45), de ausencias confirmadas. */
export async function listarDia(fecha: string): Promise<DatosHoy> {
  const filas = await db
    .select({
      sesionId: sustSesiones.id,
      ausenciaId: sustSesiones.ausenciaId,
      profe: sustAusencias.profeNombre,
      tramo: sustSesiones.tramo,
      horaInicio: sustSesiones.horaInicio,
      horaFin: sustSesiones.horaFin,
      grupos: sustSesiones.grupos,
      materia: sustSesiones.materia,
      aula: sustSesiones.aula,
      hayQueCubrir: sustSesiones.hayQueCubrir,
      sustituto: sustSesiones.sustitutoNombre,
      nivel: sustSesiones.nivel,
      avisoEstado: sustSesiones.avisoEstado,
    })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(and(eq(sustAusencias.estado, 'confirmada'), eq(sustSesiones.fecha, fecha)))
    .orderBy(asc(sustSesiones.horaInicio), asc(sustSesiones.horaFin), asc(sustAusencias.profeNombre));
  const aCubrir = filas.filter((f) => f.hayQueCubrir);
  const cubiertas = aCubrir.filter((f) => f.sustituto).length;
  return { fecha, filas, aCubrir: aCubrir.length, cubiertas, sinCubrir: aCubrir.length - cubiertas, conError: filas.filter((f) => f.avisoEstado === 'error').length };
}

/** Para el escritorio: horas a cubrir hoy y cuántas siguen sin cubrir. */
export async function resumenHoy(): Promise<{ aCubrir: number; sinCubrir: number }> {
  const [r] = await db
    .select({
      aCubrir: sql<number>`count(*) filter (where ${sustSesiones.hayQueCubrir})::int`,
      sinCubrir: sql<number>`count(*) filter (where ${sustSesiones.hayQueCubrir} and ${sustSesiones.sustitutoId} is null)::int`,
    })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(and(eq(sustAusencias.estado, 'confirmada'), eq(sustSesiones.fecha, hoyEnEspana())));
  return { aCubrir: Number(r?.aCubrir ?? 0), sinCubrir: Number(r?.sinCubrir ?? 0) };
}

export interface FilaHistorial {
  id: string;
  desde: string;
  hasta: string;
  profeId: string;
  profe: string;
  motivo: string;
  estado: string;
  horas: number;
  aCubrir: number;
  cubiertas: number;
  conError: number;
  createdAt: Date;
}

/** Las ausencias que tocan un mes (o las últimas), con sus cuentas. */
export async function listarHistorial(f: { mes?: string | null; profeId?: string | null }): Promise<FilaHistorial[]> {
  const conds = [];
  if (f.mes) conds.push(lte(sustAusencias.desde, finDeMes(`${f.mes}-01`)), gte(sustAusencias.hasta, `${f.mes}-01`));
  if (f.profeId) conds.push(eq(sustAusencias.profeId, f.profeId));
  const filas = await db
    .select({
      id: sustAusencias.id,
      desde: sustAusencias.desde,
      hasta: sustAusencias.hasta,
      profeId: sustAusencias.profeId,
      profe: sustAusencias.profeNombre,
      motivo: sustAusencias.motivo,
      estado: sustAusencias.estado,
      createdAt: sustAusencias.createdAt,
      horas: sql<number>`count(${sustSesiones.id})::int`,
      aCubrir: sql<number>`count(${sustSesiones.id}) filter (where ${sustSesiones.hayQueCubrir})::int`,
      cubiertas: sql<number>`count(${sustSesiones.id}) filter (where ${sustSesiones.hayQueCubrir} and ${sustSesiones.sustitutoId} is not null)::int`,
      conError: sql<number>`count(${sustSesiones.id}) filter (where ${sustSesiones.avisoEstado} = 'error')::int`,
    })
    .from(sustAusencias)
    .leftJoin(sustSesiones, eq(sustSesiones.ausenciaId, sustAusencias.id))
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(sustAusencias.id)
    .orderBy(desc(sustAusencias.desde), desc(sustAusencias.createdAt))
    .limit(f.mes || f.profeId ? 500 : 100);
  return filas.map((x) => ({ ...x, horas: Number(x.horas), aCubrir: Number(x.aCubrir), cubiertas: Number(x.cubiertas), conError: Number(x.conError) }));
}

/** Los profes que ya tienen alguna ausencia (para el filtro del historial). */
export async function profesConAusencias(): Promise<{ id: string; nombre: string }[]> {
  const filas = await db.selectDistinct({ id: sustAusencias.profeId, nombre: sustAusencias.profeNombre }).from(sustAusencias);
  const vistos = new Map<string, string>();
  for (const f of filas) if (!vistos.has(f.id)) vistos.set(f.id, f.nombre);
  return [...vistos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function filasCuenta(desde: string, hasta: string, etapas?: readonly string[]): Promise<FilaCuenta[]> {
  return db
    .select({
      ausenciaId: sustSesiones.ausenciaId,
      profeId: sustAusencias.profeId,
      profeNombre: sustAusencias.profeNombre,
      motivo: sustAusencias.motivo,
      fecha: sustSesiones.fecha,
      hayQueCubrir: sustSesiones.hayQueCubrir,
      sustitutoId: sustSesiones.sustitutoId,
      sustitutoNombre: sustSesiones.sustitutoNombre,
      disponibilidad: sustSesiones.disponibilidad,
    })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(and(eq(sustAusencias.estado, 'confirmada'), gte(sustSesiones.fecha, desde), lte(sustSesiones.fecha, hasta), etapas ? inArray(sustAusencias.etapa, [...etapas]) : undefined));
}

export async function cifras(periodo: PeriodoCifras, hoy = hoyEnEspana(), etapa?: string): Promise<{ periodo: PeriodoCifras; etapa: string; desde: string; hasta: string; resumen: Resumen }> {
  const { trimestres } = await getAjustesOratorios(cursoDeFecha(hoy));
  const r = rangoPeriodo(periodo, hoy, trimestres);
  const filtro = (CONFIGURACION.sustituciones.etapas as readonly string[]).includes(etapa ?? '') ? etapa : undefined;
  return { periodo, etapa: filtro ?? 'todas', ...r, resumen: resumir(await filasCuenta(r.desde, r.hasta, filtro ? [filtro] : undefined)) };
}

// ─── Informe mensual (decisión 12) ───────────────────────────────────────────

export interface Informe {
  mes: string;
  delMes: Resumen;
  delCurso: Resumen;
  curso: string;
  destinatarios: string[];
  enviado: { at: Date; destinatarios: string[] } | null;
}

/** Un informe por etapa y uno conjunto (`CONFIGURACION.sustituciones.informes`), cada uno a su buzón. */
const DESTINATARIOS_INFORME = CONFIGURACION.sustituciones.informes.map((d) => ({ ...d, email: String(COLEGIO[d.buzon]) }));

function inicioDeCurso(curso: string): string {
  return `${curso.slice(0, 4)}-${String(CONFIGURACION.calendario.mesInicioCurso).padStart(2, '0')}-01`;
}

export async function informeMes(mes: string): Promise<Informe> {
  const desde = `${mes}-01`;
  const hasta = finDeMes(desde);
  const curso = cursoDeFecha(desde);
  const inicioCurso = inicioDeCurso(curso);
  const [delMes, delCurso, [ya]] = await Promise.all([
    filasCuenta(desde, hasta),
    filasCuenta(inicioCurso, hasta),
    db.select().from(sustInformes).where(eq(sustInformes.mes, mes)).limit(1),
  ]);
  return {
    mes,
    delMes: resumir(delMes),
    delCurso: resumir(delCurso),
    curso,
    destinatarios: DESTINATARIOS_INFORME.map((d) => d.email),
    enviado: ya?.enviadoAt ? { at: ya.enviadoAt, destinatarios: ya.destinatarios } : null,
  };
}

/**
 * Manda el informe de un mes. Idempotente: si ya se mandó, no repite (salvo `forzar`, el botón
 * «Enviarlo ahora» cuando ya había salido). Se reserva el mes ANTES de mandar, para que dos
 * llamadas a la vez (el cron y alguien con el botón) no lo manden dos veces.
 */
export async function enviarInforme(mes: string, opciones: { forzar?: boolean; quien?: Quien } = {}): Promise<{ enviado: boolean; destinatarios: string[]; motivo?: string; fallidos: string[] }> {
  const inf = await informeMes(mes);
  if (inf.destinatarios.length === 0) return { enviado: false, destinatarios: [], motivo: 'No hay destinatarios configurados', fallidos: [] };
  if (inf.enviado && !opciones.forzar && DESTINATARIOS_INFORME.every((d) => inf.enviado!.destinatarios.includes(d.email))) return { enviado: false, destinatarios: inf.enviado.destinatarios, motivo: 'Ya se mandó', fallidos: [] };
  if (!opciones.forzar) {
    const reservado = await db.insert(sustInformes).values({ mes, destinatarios: [] }).onConflictDoNothing({ target: sustInformes.mes }).returning({ id: sustInformes.id });
    if (reservado.length === 0) {
      const [fila] = await db.select().from(sustInformes).where(eq(sustInformes.mes, mes)).limit(1);
      // Reservado por otra llamada que aún no ha terminado, o que falló sin mandar nada: solo se reintenta lo segundo.
      const completo = DESTINATARIOS_INFORME.every((d) => fila?.destinatarios.includes(d.email));
      if ((fila?.enviadoAt && completo) || (fila && !fila.enviadoAt && Date.now() - fila.createdAt.getTime() < 10 * 60_000)) return { enviado: false, destinatarios: fila?.destinatarios ?? [], motivo: 'Ya se está mandando', fallidos: [] };
    }
  }
  const ok: string[] = [];
  const fallidos: string[] = [];
  for (const destino of DESTINATARIOS_INFORME) {
    if (inf.enviado?.destinatarios.includes(destino.email) && !opciones.forzar) { ok.push(destino.email); continue; }
    const finMes = finDeMes(`${mes}-01`);
    const [delMesFilas, delCursoFilas] = await Promise.all([
      filasCuenta(`${mes}-01`, finMes, destino.etapas),
      filasCuenta(inicioDeCurso(inf.curso), finMes, destino.etapas),
    ]);
    const { subject, html } = correoInforme({ mes, delMes: resumir(delMesFilas), delCurso: resumir(delCursoFilas), curso: inf.curso, enlace: `${appBaseUrl()}/gestion/sustituciones/numeros`, etapa: destino.nombre });
    try {
      await enviar('sustituciones', { to: destino.email, subject, html, ...(opciones.quien ? { replyTo: opciones.quien.email } : {}) });
      ok.push(destino.email);
    } catch (e) {
      console.error('Sustituciones · informe:', e instanceof Error ? e.message : e);
      fallidos.push(destino.email);
    }
  }
  const resumen = { ausencias: inf.delMes.ausencias, sesiones: inf.delMes.sesiones, cubiertas: inf.delMes.cubiertas, sinCubrir: inf.delMes.sinCubrir };
  // Si no ha salido a nadie, no se pisa el registro de un envío anterior que sí salió.
  if (ok.length === 0) return { enviado: false, destinatarios: [], motivo: 'No ha salido a nadie', fallidos };
  await db
    .insert(sustInformes)
    .values({ mes, destinatarios: ok, resumen, enviadoAt: new Date() })
    .onConflictDoUpdate({ target: sustInformes.mes, set: { destinatarios: ok, resumen, enviadoAt: new Date() } });
  return { enviado: true, destinatarios: ok, fallidos };
}

/** El cron del día 1: el informe del mes anterior. */
export async function enviarInformeDelMesPasado(): Promise<Awaited<ReturnType<typeof enviarInforme>> & { mes: string }> {
  const mes = mesAnterior(hoyEnEspana());
  return { mes, ...(await enviarInforme(mes)) };
}

// ─── Disponibilidad (decisión 15) ────────────────────────────────────────────

export interface SemanaTipo {
  academicYear: string;
  profes: ProfeSust[];
  /** Por etapa, sus franjas (filas de la rejilla). */
  franjasPorEtapa: Partial<Record<Etapa, Franja[]>>;
  /** Por profe, en qué etapas tiene horario. */
  etapasDe: Record<string, Etapa[]>;
  semana: Map<number, SesionDia[]>;
  retoques: Retoque[];
  cuadro: { profeId: string; dia: number; horaInicio: string; horaFin: string }[];
}

/**
 * La semana ordinaria de todo el claustro (el periodo ordinario de cada etapa en una fecha del curso
 * en que no haya especiales), para la rejilla de disponibilidad. Sin fecha concreta: es la semana tipo.
 */
async function semanaTipo(academicYear: string): Promise<SemanaTipo> {
  const [base, profes, retoques, coberturas] = await Promise.all([
    getHorarioBase(),
    getProfes(),
    db
      .select({ profeId: sustDisponibilidad.profeId, dia: sustDisponibilidad.diaSemana, horaInicio: sustDisponibilidad.horaInicio, horaFin: sustDisponibilidad.horaFin, estado: sustDisponibilidad.estado, nota: sustDisponibilidad.nota })
      .from(sustDisponibilidad)
      .where(eq(sustDisponibilidad.academicYear, academicYear)),
    db
      .select({ sustitutoId: eduCoberturasBaja.sustitutoId, titularId: eduCoberturasBaja.titularId, desde: eduCoberturasBaja.desde, hasta: eduCoberturasBaja.hasta, activa: eduCoberturasBaja.activa })
      .from(eduCoberturasBaja)
      .where(eq(eduCoberturasBaja.activa, true)),
  ]);
  const ordinarios = base.periodos.filter((p) => p.esOrdinario && cursoDeFecha(p.fechaInicio) === academicYear);
  const ordIds = new Set(ordinarios.map((p) => p.id));
  const rejillas = base.rejillas.filter((r) => ordIds.has(r.periodoId));
  const rejIds = new Set(rejillas.map((r) => r.id));
  const hoy = hoyEnEspana();
  const semana = new Map<number, SesionDia[]>();
  for (let dia = 1; dia <= 5; dia++) {
    const del = base.sesiones.filter((s) => s.dia === dia && rejIds.has(s.rejillaId)).map((s) => aSesionDia(s, hoy));
    semana.set(dia, aplicarCoberturas(del, coberturas));
  }
  const etapaDeRejilla = new Map<string, Etapa[]>();
  for (const r of rejillas) {
    const etapas = r.ambitos.length === 0 || r.ambitos.some((a) => !a.etapa && !a.curso) ? [...CFG.etapas] : CFG.etapas.filter((e) => r.ambitos.some((a) => a.etapa === e));
    etapaDeRejilla.set(r.id, etapas);
  }
  const franjasPorEtapa: Partial<Record<Etapa, Franja[]>> = {};
  for (const e of CFG.etapas) {
    // Las rejillas propias de la etapa (no la de centro entero, que no trae tramos de todas).
    const suyas = rejillas.filter((r) => r.ambitos.some((a) => a.etapa === e)).map((r) => r.id);
    franjasPorEtapa[e] = franjasDe(base.tramos.filter((t) => suyas.includes(t.rejillaId)));
  }
  const etapasDe: Record<string, Etapa[]> = {};
  for (const s of base.sesiones) {
    if (!rejIds.has(s.rejillaId)) continue;
    const r = rejillas.find((x) => x.id === s.rejillaId);
    const propias = r && r.ambitos.some((a) => a.etapa) ? (etapaDeRejilla.get(r.id) ?? []) : [];
    for (const p of s.profes) etapasDe[p.id] = [...new Set([...(etapasDe[p.id] ?? []), ...propias])];
  }
  for (const id of Object.keys(etapasDe)) etapasDe[id].sort((a, b) => CFG.etapas.indexOf(a) - CFG.etapas.indexOf(b));
  const cuadro = base.cuadro.filter((c) => ordIds.has(c.periodoId)).map((c) => ({ profeId: c.profeId, dia: c.dia, horaInicio: c.horaInicio, horaFin: c.horaFin }));
  return { academicYear, profes, franjasPorEtapa, etapasDe, semana, retoques: retoques.map((r) => ({ ...r, estado: r.estado as Disponibilidad })), cuadro };
}

export interface DatosDisponibilidadProfe {
  profe: ProfeSust;
  /** Una rejilla por etapa en la que tiene horario (cada etapa con sus horas: no se mezclan). */
  bloques: { etapa: Etapa; franjas: Franja[]; casillas: CasillaDisponibilidad[] }[];
}

export interface DatosDisponibilidad {
  academicYear: string;
  profes: { id: string; nombre: string; etapas: Etapa[] }[];
  porProfe: DatosDisponibilidadProfe | null;
  semana: { etapa: Etapa; franjas: Franja[]; casillas: CasillaSemana[] }[];
}

export async function disponibilidad(academicYear: string, profeId: string | null): Promise<DatosDisponibilidad> {
  const t = await semanaTipo(academicYear);
  const conHorario = t.profes.filter((p) => (t.etapasDe[p.id] ?? []).length > 0);
  let porProfe: DatosDisponibilidadProfe | null = null;
  const profe = profeId ? t.profes.find((p) => p.id === profeId) : null;
  if (profe) {
    const bloques = (t.etapasDe[profe.id] ?? []).map((etapa) => {
      const franjas = t.franjasPorEtapa[etapa] ?? [];
      return { etapa, franjas, casillas: rejillaDisponibilidad(profe.id, t.semana, franjas, t.retoques) };
    });
    porProfe = { profe, bloques };
  }
  const semana = CFG.etapas.map((etapa) => {
    const franjas = t.franjasPorEtapa[etapa] ?? [];
    // Todo el claustro con horario: un candidato puede ser de cualquier etapa (decisión 1).
    return { etapa, franjas, casillas: mapaSemana(conHorario, t.semana, franjas, t.retoques, t.cuadro) };
  });
  return { academicYear, profes: conHorario.map((p) => ({ id: p.id, nombre: p.nombre, etapas: t.etapasDe[p.id] ?? [] })), porProfe, semana };
}

/** Guarda (o borra, con `estado` null = «Automático») un retoque. Una clase propia no se sube de «No». */
export async function guardarRetoque(
  academicYear: string,
  r: { profeId: string; dia: number; horaInicio: string; horaFin: string; estado: Disponibilidad | null; nota?: string | null },
  email: string,
): Promise<void> {
  if (r.estado === null) {
    await db
      .delete(sustDisponibilidad)
      .where(
        and(
          eq(sustDisponibilidad.profeId, r.profeId),
          eq(sustDisponibilidad.academicYear, academicYear),
          eq(sustDisponibilidad.diaSemana, r.dia),
          eq(sustDisponibilidad.horaInicio, r.horaInicio),
          eq(sustDisponibilidad.horaFin, r.horaFin),
        ),
      );
    return;
  }
  const valores = { profeId: r.profeId, academicYear, diaSemana: r.dia, horaInicio: r.horaInicio, horaFin: r.horaFin, estado: r.estado, nota: r.nota?.trim() || null, updatedByEmail: email, updatedAt: new Date() };
  await db
    .insert(sustDisponibilidad)
    .values(valores)
    .onConflictDoUpdate({
      target: [sustDisponibilidad.profeId, sustDisponibilidad.academicYear, sustDisponibilidad.diaSemana, sustDisponibilidad.horaInicio, sustDisponibilidad.horaFin],
      set: { estado: valores.estado, nota: valores.nota, updatedByEmail: email, updatedAt: valores.updatedAt },
    });
}

/** «Volver a lo del horario»: borra los retoques de un profe en el curso. */
export async function borrarRetoques(academicYear: string, profeId: string): Promise<number> {
  const borrados = await db
    .delete(sustDisponibilidad)
    .where(and(eq(sustDisponibilidad.profeId, profeId), eq(sustDisponibilidad.academicYear, academicYear)))
    .returning({ id: sustDisponibilidad.id });
  return borrados.length;
}

// ─── «Mis sustituciones» (decisión 16) ───────────────────────────────────────

export interface MiSustitucion {
  id: string;
  fecha: string;
  tramo: string | null;
  horaInicio: string;
  horaFin: string;
  grupos: string | null;
  materia: string | null;
  aula: string | null;
  /** A quién cubre (sin motivo). */
  cubreA: string;
  indicaciones: string | null;
  enAula: boolean;
}

export interface TeCubren {
  ausenciaId: string;
  desde: string;
  hasta: string;
  horas: { fecha: string; horaInicio: string; horaFin: string; grupos: string | null; materia: string | null; quien: string | null; hayQueCubrir: boolean }[];
}

export interface DatosMias {
  profeId: string | null;
  proximas: MiSustitucion[];
  pasadas: MiSustitucion[];
  teCubren: TeCubren[];
}

/** Solo lo de esta persona, casado por su correo. Nada de nadie más, y nunca el motivo. */
export async function misSustituciones(email: string, hoy = hoyEnEspana()): Promise<DatosMias> {
  const yo = await db
    .select({ id: eduTeachers.id })
    .from(eduTeachers)
    .where(and(sql`lower(${eduTeachers.email}) = ${email.toLowerCase()}`, eq(eduTeachers.active, true)))
    .limit(1);
  const profeId = yo[0]?.id ?? null;
  if (!profeId) return { profeId: null, proximas: [], pasadas: [], teCubren: [] };
  const desde = sumarDias(hoy, -30);
  const [cubro, mias] = await Promise.all([
    db
      .select({
        id: sustSesiones.id,
        fecha: sustSesiones.fecha,
        tramo: sustSesiones.tramo,
        horaInicio: sustSesiones.horaInicio,
        horaFin: sustSesiones.horaFin,
        grupos: sustSesiones.grupos,
        materia: sustSesiones.materia,
        aula: sustSesiones.aula,
        nivel: sustSesiones.nivel,
        cubreA: sustAusencias.profeNombre,
        indicaciones: sustAusencias.indicaciones,
      })
      .from(sustSesiones)
      .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
      .where(and(eq(sustSesiones.sustitutoId, profeId), eq(sustAusencias.estado, 'confirmada'), gte(sustSesiones.fecha, desde)))
      .orderBy(asc(sustSesiones.fecha), asc(sustSesiones.horaInicio)),
    db
      .select({
        ausenciaId: sustAusencias.id,
        desde: sustAusencias.desde,
        hasta: sustAusencias.hasta,
        fecha: sustSesiones.fecha,
        horaInicio: sustSesiones.horaInicio,
        horaFin: sustSesiones.horaFin,
        grupos: sustSesiones.grupos,
        materia: sustSesiones.materia,
        quien: sustSesiones.sustitutoNombre,
        hayQueCubrir: sustSesiones.hayQueCubrir,
      })
      .from(sustSesiones)
      .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
      .where(and(eq(sustAusencias.profeId, profeId), eq(sustAusencias.estado, 'confirmada'), gte(sustAusencias.hasta, hoy)))
      .orderBy(asc(sustSesiones.fecha), asc(sustSesiones.horaInicio)),
  ]);
  const a = (x: (typeof cubro)[number]): MiSustitucion => ({ ...x, enAula: x.nivel === 'en_aula' });
  const teCubren = new Map<string, TeCubren>();
  for (const m of mias) {
    const t = teCubren.get(m.ausenciaId) ?? { ausenciaId: m.ausenciaId, desde: m.desde, hasta: m.hasta, horas: [] };
    t.horas.push({ fecha: m.fecha, horaInicio: m.horaInicio, horaFin: m.horaFin, grupos: m.grupos, materia: m.materia, quien: m.quien, hayQueCubrir: m.hayQueCubrir });
    teCubren.set(m.ausenciaId, t);
  }
  return {
    profeId,
    proximas: cubro.filter((x) => x.fecha >= hoy).map(a),
    pasadas: cubro.filter((x) => x.fecha < hoy).map(a).reverse(),
    teCubren: [...teCubren.values()],
  };
}

/** Consulta ligera para «Tus sustituciones» (escritorio) y la franja de Mi horario: hoy y los próximos días. */
export async function avisoMisSustituciones(email: string, hoy = hoyEnEspana()): Promise<MiSustitucion[]> {
  const hasta = sumarDias(hoy, CFG.avisoProximosDias);
  const filas = await db
    .select({
      id: sustSesiones.id,
      fecha: sustSesiones.fecha,
      tramo: sustSesiones.tramo,
      horaInicio: sustSesiones.horaInicio,
      horaFin: sustSesiones.horaFin,
      grupos: sustSesiones.grupos,
      materia: sustSesiones.materia,
      aula: sustSesiones.aula,
      nivel: sustSesiones.nivel,
      cubreA: sustAusencias.profeNombre,
      indicaciones: sustAusencias.indicaciones,
    })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .innerJoin(eduTeachers, eq(eduTeachers.id, sustSesiones.sustitutoId))
    .where(
      and(
        sql`lower(${eduTeachers.email}) = ${email.toLowerCase()}`,
        eq(sustAusencias.estado, 'confirmada'),
        gte(sustSesiones.fecha, hoy),
        lte(sustSesiones.fecha, hasta),
      ),
    )
    .orderBy(asc(sustSesiones.fecha), asc(sustSesiones.horaInicio));
  return filas.map((x) => ({ ...x, enAula: x.nivel === 'en_aula' }));
}

// ─── Para los selectores ─────────────────────────────────────────────────────

/** El claustro con horario (para «Profe que falta»), por nombre. */
export async function profesConHorario(): Promise<{ id: string; nombre: string }[]> {
  const [profes, conHorario] = await Promise.all([
    getProfes(),
    db
      .selectDistinct({ id: horAsignacionProfes.eduTeacherId })
      .from(horAsignacionProfes)
      .innerJoin(horAsignaciones, eq(horAsignaciones.id, horAsignacionProfes.asignacionId))
      .innerJoin(horPeriodos, eq(horPeriodos.id, horAsignaciones.periodoId))
      .where(and(eq(horAsignaciones.active, true), eq(horPeriodos.active, true))),
  ]);
  const ids = new Set(conHorario.map((x) => x.id));
  return profes.filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, nombre: p.nombre }));
}

/** El profe de una cuenta (para saber de quién es «Mis sustituciones»), sin cargar todo su horario. */
export async function nombreDe(email: string): Promise<string> {
  const [p] = await db
    .select({ nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
    .from(eduTeachers)
    .where(sql`lower(${eduTeachers.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return p ? nombreProfeBreve(p) : email;
}
