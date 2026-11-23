// Salidas (docs/32, decisión 25, David 23-nov-2026): «4º ESO A este día no está; se libera a todos
// los profes de esas horas menos a fulanito y menganito, que se van a la salida, y si tienen clases
// hay que sustituirles». Al guardarla:
//  1. sus grupos quedan fuera esas horas: quien les da clase sale libre en las propuestas (el primero,
//     tras «ya está en el aula») y, si faltaba, esa hora ya no pide sustituto;
//  2. cada acompañante falta: se le prepara una ausencia en BORRADOR (sin avisar a nadie) con sus
//     horas de esa franja y la propuesta de quién entra; Jefatura la revisa y la envía;
//  3. lo que ya estaba apuntado no se pisa: las horas que el acompañante ya tenía en otra ausencia se
//     saltan; lo que él cubría se queda sin cubrir (y se dice); y las sustituciones de esos grupos
//     que ya no hacen falta se señalan para quitarlas con un toque.
import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { eduTeachers, eduTutorias, horAsignaciones, horAsignacionGrupos, horPeriodos, salTripManagers, salTrips, sustAusencias, sustSalidas, sustSesiones } from '@/db/schema';
import { nombreProfeBreve } from '@/lib/profes';
import { etapaDeCurso, type Etapa } from '@/lib/cursos';
import { hoyEnEspana, sumarDias } from '@/lib/oratorios';
import {
  claveGrupo,
  cursoDeFecha,
  entradaDesdeContexto,
  etiquetaGrupo,
  fechaLarga,
  hora,
  normalizar,
  proponerSustitutos,
  solapa,
  type EntradaSalida,
} from '@/lib/sustituciones';
import { cambiarAusencia, confirmarAusencia, ErrorSustitucion, propuesta, type Quien } from '@/lib/sustituciones-server';

async function getProfesBreve(ids: string[]): Promise<{ id: string; nombre: string }[]> {
  if (ids.length === 0) return [];
  const filas = await db
    .select({ id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
    .from(eduTeachers)
    .where(and(inArray(eduTeachers.id, [...new Set(ids)]), eq(eduTeachers.active, true)));
  return filas.map((p) => ({ id: p.id, nombre: nombreProfeBreve(p) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export interface GrupoHorario {
  curso: string;
  letra: string | null;
  etiqueta: string;
  etapa: Etapa;
}

/** Los grupos del horario (para elegir cuáles se van), por etapa y curso. */
export async function gruposDelHorario(): Promise<GrupoHorario[]> {
  const filas = await db
    .selectDistinct({ curso: horAsignacionGrupos.curso, letra: horAsignacionGrupos.letra })
    .from(horAsignacionGrupos)
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horAsignacionGrupos.asignacionId))
    .innerJoin(horPeriodos, eq(horPeriodos.id, horAsignaciones.periodoId))
    .where(and(eq(horAsignaciones.active, true), eq(horPeriodos.active, true)));
  const vistos = new Map<string, GrupoHorario>();
  for (const f of filas) {
    const etapa = etapaDeCurso(f.curso) as Etapa | null;
    if (!etapa) continue;
    const k = claveGrupo(f.curso, f.letra);
    if (!vistos.has(k)) vistos.set(k, { curso: f.curso.toUpperCase(), letra: f.letra?.toUpperCase() ?? null, etiqueta: etiquetaGrupo(f.curso, f.letra), etapa });
  }
  const orden: Record<string, number> = { EI: 0, EP: 1, ESO: 2, BACH: 3 };
  return [...vistos.values()].sort((a, b) => (orden[a.etapa] ?? 9) - (orden[b.etapa] ?? 9) || a.curso.localeCompare(b.curso, 'es', { numeric: true }) || (a.letra ?? '').localeCompare(b.letra ?? ''));
}

export interface AusenciaDeSalida {
  id: string;
  profe: string;
  horas: number;
  aCubrir: number;
  sinCubrir: number;
  borrador: number;
}

export interface SalidaLista {
  id: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  grupos: { curso: string; letra: string | null; etiqueta: string }[];
  acompanantes: { id: string; nombre: string }[];
  descripcion: string;
  creadaPorEmail: string;
  ausencias: AusenciaDeSalida[];
}

/** Las salidas que tocan unas etapas: las de hoy en adelante y las de los últimos 30 días. */
export async function listarSalidas(etapas: readonly Etapa[], hoy = hoyEnEspana()): Promise<{ proximas: SalidaLista[]; pasadas: SalidaLista[] }> {
  const desde = sumarDias(hoy, -30);
  const [salidas, ausencias] = await Promise.all([
    db
      .select()
      .from(sustSalidas)
      .where(and(eq(sustSalidas.estado, 'activa'), gte(sustSalidas.fecha, desde)))
      .orderBy(asc(sustSalidas.fecha), asc(sustSalidas.horaInicio)),
    db
      .select({
        id: sustAusencias.id,
        salidaId: sustAusencias.salidaId,
        profe: sustAusencias.profeNombre,
        hayQueCubrir: sustSesiones.hayQueCubrir,
        sustitutoId: sustSesiones.sustitutoId,
        avisoEstado: sustSesiones.avisoEstado,
      })
      .from(sustAusencias)
      .innerJoin(sustSesiones, eq(sustSesiones.ausenciaId, sustAusencias.id))
      .innerJoin(sustSalidas, eq(sustSalidas.id, sustAusencias.salidaId))
      .where(and(eq(sustAusencias.estado, 'confirmada'), gte(sustSalidas.fecha, desde))),
  ]);
  const de = new Set(etapas);
  const porSalida = new Map<string, Map<string, AusenciaDeSalida>>();
  for (const a of ausencias) {
    if (!a.salidaId) continue;
    const m = porSalida.get(a.salidaId) ?? new Map<string, AusenciaDeSalida>();
    const x = m.get(a.id) ?? { id: a.id, profe: a.profe, horas: 0, aCubrir: 0, sinCubrir: 0, borrador: 0 };
    x.horas++;
    if (a.hayQueCubrir) {
      x.aCubrir++;
      if (!a.sustitutoId) x.sinCubrir++;
      else if (a.avisoEstado === 'no') x.borrador++;
    }
    m.set(a.id, x);
    porSalida.set(a.salidaId, m);
  }
  const lista: SalidaLista[] = salidas
    .filter((s) => s.grupos.some((g) => de.has(etapaDeCurso(g.curso) as Etapa)))
    .map((s) => ({
      id: s.id,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      grupos: s.grupos,
      acompanantes: s.acompanantes,
      descripcion: s.descripcion,
      creadaPorEmail: s.creadaPorEmail,
      ausencias: [...(porSalida.get(s.id)?.values() ?? [])].sort((a, b) => a.profe.localeCompare(b.profe, 'es')),
    }));
  return { proximas: lista.filter((s) => s.fecha >= hoy), pasadas: lista.filter((s) => s.fecha < hoy).reverse() };
}

export interface ResultadoSalida {
  id: string;
  /** Ausencias preparadas en borrador (una por acompañante con horas en esa franja). */
  preparadas: { ausenciaId: string; profe: string; horas: number; sinCubrir: number }[];
  /** Acompañantes sin nada que cubrir a esas horas. */
  sinHoras: string[];
  /** Horas que algún acompañante cubría y se han quedado sin cubrir. */
  liberadas: { profe: string; cuando: string }[];
  /** Sustituciones de estos grupos que ya no hacen falta (se quitan con un toque). */
  yaNoHacenFalta: YaNoHaceFalta[];
}

export interface YaNoHaceFalta {
  sesionId: string;
  ausenciaId: string;
  ausente: string;
  cuando: string;
  grupos: string;
  sustituto: string | null;
}

/** Las sustituciones apuntadas de estos grupos, en estas horas, que con la salida ya no hacen falta. */
export async function sustitucionesQueSobran(s: { id?: string; fecha: string; horaInicio: string | null; horaFin: string | null; grupos: { etiqueta: string }[] }): Promise<YaNoHaceFalta[]> {
  const filas = await db
    .select({ sesionId: sustSesiones.id, ausenciaId: sustSesiones.ausenciaId, ausente: sustAusencias.profeNombre, horaInicio: sustSesiones.horaInicio, horaFin: sustSesiones.horaFin, grupos: sustSesiones.grupos, sustituto: sustSesiones.sustitutoNombre, salidaId: sustAusencias.salidaId })
    .from(sustSesiones)
    .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
    .where(and(eq(sustAusencias.estado, 'confirmada'), eq(sustSesiones.fecha, s.fecha), eq(sustSesiones.hayQueCubrir, true)));
  const fuera = new Set(s.grupos.map((g) => normalizar(g.etiqueta)));
  return filas
    .filter((f) => f.salidaId !== s.id || !s.id)
    .filter((f) => s.horaInicio === null || s.horaFin === null || solapa(f, { horaInicio: s.horaInicio, horaFin: s.horaFin }))
    .filter((f) => {
      const gs = (f.grupos ?? '').split(',').map((g) => normalizar(g.replace(/\s*\(.*\)$/, ''))).filter(Boolean);
      return gs.length > 0 && gs.every((g) => fuera.has(g));
    })
    .map((f) => ({ sesionId: f.sesionId, ausenciaId: f.ausenciaId, ausente: f.ausente, cuando: `${hora(f.horaInicio)}-${hora(f.horaFin)}`, grupos: f.grupos ?? '', sustituto: f.sustituto }));
}

export interface SalidaParaImportar {
  id: string;
  nombre: string;
  fecha: string;
  grupos: { curso: string; letra: string | null; etiqueta: string }[];
  /** Quien recibe los justificantes de pago: se da por hecho que va (menos los tutores). */
  van: { id: string; nombre: string }[];
  /** Los tutores de esos grupos: se eligen a mano si van. */
  tutores: { id: string; nombre: string }[];
}

/**
 * Las salidas del módulo Salidas y pagos de los próximos dos meses, de estas etapas, que aún no se han
 * traído aquí (David, 23-nov-2026: «Portaventura en junio: ¡pam!, importar; una vez importada ya no sale»).
 */
/** Un grupo de Salidas como lo dice el horario: «3ºPPDC» (a mano en Salidas) es 3ESO + PDC. */
export function cursoComoHorario(curso: string, letra: string | null): { curso: string; letra: string | null } {
  const c = curso.toUpperCase().replace(/\s+/g, '');
  const l = letra?.toUpperCase() || null;
  if (/^\d+(INF|PRI|ESO|BACH)$/.test(c)) return { curso: c, letra: l };
  const n = /(\d+)/.exec(c)?.[1];
  if (n && /PDC/.test(c + (l ?? ''))) return { curso: `${n}ESO`, letra: 'PDC' };
  return { curso: c, letra: l };
}

export async function salidasParaImportar(etapas: readonly Etapa[], hoy = hoyEnEspana()): Promise<SalidaParaImportar[]> {
  const hasta = sumarDias(hoy, 61);
  const [trips, ya, managers, tutorias] = await Promise.all([
    db.select({ id: salTrips.id, nombre: salTrips.nombre, fecha: salTrips.fecha, clases: salTrips.clases }).from(salTrips).where(and(isNotNull(salTrips.fecha), gte(salTrips.fecha, hoy), lte(salTrips.fecha, hasta))).orderBy(asc(salTrips.fecha)),
    db.select({ id: sustSalidas.salTripId }).from(sustSalidas).where(and(isNotNull(sustSalidas.salTripId), eq(sustSalidas.estado, 'activa'))),
    db
      .select({ tripId: salTripManagers.tripId, id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
      .from(salTripManagers)
      .innerJoin(eduTeachers, eq(eduTeachers.id, salTripManagers.eduTeacherId)),
    db
      .select({ curso: eduTutorias.curso, letra: eduTutorias.letra, id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
      .from(eduTutorias)
      .innerJoin(eduTeachers, eq(eduTeachers.id, eduTutorias.eduTeacherId))
      .where(eq(eduTutorias.academicYear, cursoDeFecha(hoy))),
  ]);
  const importadas = new Set(ya.map((x) => x.id));
  const de = new Set(etapas);
  return trips
    .filter((t) => t.fecha && !importadas.has(t.id) && t.clases.some((c) => de.has(etapaDeCurso(c.curso) as Etapa)))
    .map((t) => {
      const grupos = t.clases.map((c) => {
        const g = cursoComoHorario(c.curso, c.letra);
        return { ...g, etiqueta: etiquetaGrupo(g.curso, g.letra) };
      });
      const claves = new Set(grupos.map((g) => claveGrupo(g.curso, g.letra)));
      const tutores = new Map<string, string>();
      for (const x of tutorias) if (claves.has(claveGrupo(x.curso, x.letra))) tutores.set(x.id, nombreProfeBreve(x));
      const van = managers.filter((m) => m.tripId === t.id && !tutores.has(m.id)).map((m) => ({ id: m.id, nombre: nombreProfeBreve(m) }));
      return { id: t.id, nombre: t.nombre, fecha: t.fecha!, grupos, van, tutores: [...tutores].map(([id, nombre]) => ({ id, nombre })) };
    });
}

export async function crearSalida(e: EntradaSalida, q: Quien): Promise<ResultadoSalida> {
  const grupos = e.grupos.map((g) => ({ curso: g.curso.toUpperCase(), letra: g.letra?.toUpperCase() || null, etiqueta: etiquetaGrupo(g.curso.toUpperCase(), g.letra?.toUpperCase() || null) }));
  const profes = await getProfesBreve(e.acompanantes);
  if (profes.length !== new Set(e.acompanantes).size) throw new ErrorSustitucion('Algún acompañante no está en el claustro activo.');
  const id = crypto.randomUUID();
  await db.insert(sustSalidas).values({
    id,
    academicYear: cursoDeFecha(e.fecha),
    fecha: e.fecha,
    horaInicio: e.horaInicio,
    horaFin: e.horaFin,
    grupos,
    acompanantes: profes,
    descripcion: e.descripcion.trim(),
    salTripId: e.salTripId ?? null,
    creadaPorEmail: q.firma ?? q.email,
  });

  const franja = { horaInicio: e.horaInicio ?? '00:00', horaFin: e.horaFin ?? '23:59' };
  const resultado: ResultadoSalida = { id, preparadas: [], sinHoras: [], liberadas: [], yaNoHacenFalta: [] };
  // Uno detrás de otro: así ningún acompañante sale propuesto para cubrir a otro (todos están fuera).
  for (const p of profes) {
    const prop = await propuesta(p.id, e.fecha, e.fecha);
    const dia = prop.dias[0];
    if (!dia || prop.excede || prop.bajaCubiertaPor) {
      resultado.sinHoras.push(p.nombre);
      continue;
    }
    const ya = (s: { horaInicio: string; horaFin: string }) => prop.yaApuntadas.some((y) => y.fecha === e.fecha && solapa(y, s));
    // En la franja de la salida, lo que no sea con su propio grupo de salida (con ese está fuera, no falta).
    const horas = dia.sesiones.filter((s) => solapa(s, franja) && !s.grupoFuera && !ya(s));
    if (horas.length === 0) {
      resultado.sinHoras.push(p.nombre);
      continue;
    }
    const otros = profes.filter((x) => x.id !== p.id).map((x) => ({ profeId: x.id, fecha: e.fecha, ...franja }));
    const ctx = { ...prop.contexto, ausencias: [...prop.contexto.ausencias, ...otros] };
    const aCubrir = horas.filter((s) => s.hayQueCubrir);
    const elegidos = new Map(proponerSustitutos(entradaDesdeContexto(ctx, aCubrir, p.id)).map((x) => [x.clave, x.elegido?.id ?? null]));
    const r = await confirmarAusencia(
      {
        profeId: p.id,
        desde: e.fecha,
        hasta: e.fecha,
        motivo: 'actividad_escolar',
        nota: `Salida: ${e.descripcion.trim()}`.slice(0, 300),
        indicaciones: null,
        avisar: false, // borrador: Jefatura lo revisa y lo envía
        avisarAusente: true,
        enviarYa: false,
        sesiones: horas.map((s) => ({ fecha: s.fecha, horSesionId: s.sesionId, sustitutoId: s.hayQueCubrir ? (elegidos.get(`${s.fecha}#${s.sesionId}`) ?? null) : null })),
      },
      q,
    );
    await db.update(sustAusencias).set({ salidaId: id }).where(eq(sustAusencias.id, r.id));
    resultado.preparadas.push({ ausenciaId: r.id, profe: p.nombre, horas: horas.length, sinCubrir: aCubrir.filter((s) => !elegidos.get(`${s.fecha}#${s.sesionId}`)).length });
    for (const l of r.liberadas) resultado.liberadas.push({ profe: p.nombre, cuando: `${fechaLarga(l.fecha)} a las ${hora(l.horaInicio)}${l.grupos ? ` (${l.grupos}), de ${l.cubreA}` : `, de ${l.cubreA}`}` });
  }
  resultado.yaNoHacenFalta = await sustitucionesQueSobran({ id, fecha: e.fecha, horaInicio: e.horaInicio, horaFin: e.horaFin, grupos });
  return resultado;
}

/** Anular una salida: deja de liberar a nadie y se anulan las ausencias de sus acompañantes (avisando a quien ya lo sabía). */
export async function anularSalida(id: string, q: Quien): Promise<{ anuladas: number }> {
  const [s] = await db.select({ estado: sustSalidas.estado }).from(sustSalidas).where(eq(sustSalidas.id, id)).limit(1);
  if (!s) throw new ErrorSustitucion('Esa salida no existe.', 404);
  if (s.estado === 'anulada') return { anuladas: 0 };
  await db.update(sustSalidas).set({ estado: 'anulada', anuladaPorEmail: q.firma ?? q.email, anuladaAt: new Date(), updatedAt: new Date() }).where(eq(sustSalidas.id, id));
  const ausencias = await db.select({ id: sustAusencias.id }).from(sustAusencias).where(and(eq(sustAusencias.salidaId, id), eq(sustAusencias.estado, 'confirmada')));
  for (const a of ausencias) await cambiarAusencia(a.id, { accion: 'anular', avisar: true }, q);
  return { anuladas: ausencias.length };
}

/** Para la ficha de una salida en la pantalla: lo que sobra ahora mismo. */
export async function sobrantesDeSalidas(ids: string[]): Promise<Record<string, YaNoHaceFalta[]>> {
  if (ids.length === 0) return {};
  const salidas = await db.select().from(sustSalidas).where(and(inArray(sustSalidas.id, ids), eq(sustSalidas.estado, 'activa'))).orderBy(desc(sustSalidas.fecha));
  const out: Record<string, YaNoHaceFalta[]> = {};
  await Promise.all(salidas.map(async (s) => (out[s.id] = await sustitucionesQueSobran(s))));
  return out;
}

