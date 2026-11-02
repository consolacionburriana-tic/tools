// Capa de servidor de Sustituciones del profesorado. La lógica pura (vigencia, plan de
// sincronización) está en `sustituciones.ts`; aquí solo las consultas y las escrituras.
// Ficha: docs/02-integracion-educamos.md (sección «Sustituciones»).
import { aliasedTable, and, asc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { eduSustituciones, eduTeachers, type EduSustitucion } from '@/db/schema';
import { nombreProfe } from '@/lib/profes';
import { hoyISO } from '@/lib/tableros';
import {
  aplicarSustituciones,
  candidatoDeExtra,
  COLUMNA_SUSTITUTO,
  COLUMNA_TITULAR,
  estadoSustitucion,
  planSustitucionesEducamos,
  type EstadoSustitucion,
  type PlanSustituciones,
  type ProfeParaTitular,
  type SustitucionBase,
} from '@/lib/sustituciones';

/** El SQL de «vigente hoy»: activa y `hoy` dentro de [desde, hasta] (los dos opcionales, inclusive). */
export function condVigente(hoy: string = hoyISO()): SQL {
  return and(
    eq(eduSustituciones.activa, true),
    or(isNull(eduSustituciones.desde), lte(eduSustituciones.desde, hoy)),
    or(isNull(eduSustituciones.hasta), gte(eduSustituciones.hasta, hoy)),
  ) as SQL;
}

/**
 * Subconsulta: los titulares de las sustituciones vigentes que cumplan `cond` (p. ej. «el
 * sustituto es esta persona»). Se mete tal cual en un `inArray(…)`, sin gastar un viaje a
 * Neon por esto (docs/04: «lo que cuesta es el viaje, no la consulta»).
 */
export function titularesVigentesSub(cond: SQL, hoy: string = hoyISO()) {
  return db
    .select({ id: eduSustituciones.titularId })
    .from(eduSustituciones)
    .where(and(cond, condVigente(hoy)));
}

/** Todas las sustituciones vigentes hoy (la tabla es diminuta: una consulta y a filtrar en memoria). */
export async function sustitucionesVigentes(hoy: string = hoyISO()): Promise<SustitucionBase[]> {
  return db
    .select({
      sustitutoId: eduSustituciones.sustitutoId,
      titularId: eduSustituciones.titularId,
      desde: eduSustituciones.desde,
      hasta: eduSustituciones.hasta,
      activa: eduSustituciones.activa,
    })
    .from(eduSustituciones)
    .where(condVigente(hoy));
}

// ─── Quién cubre a quién, para quien lo necesita ────────────────────────────

export interface TitularCubierto {
  id: string;
  nombre: string;
  desde: string | null;
  hasta: string | null;
}

/** A quién está cubriendo ahora esta persona (con su nombre), para «Mi horario». */
export async function titularesCubiertosPor(sustitutoId: string, hoy: string = hoyISO()): Promise<TitularCubierto[]> {
  const filas = await db
    .select({
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      nombreMostrado: eduTeachers.nombreMostrado,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      desde: eduSustituciones.desde,
      hasta: eduSustituciones.hasta,
    })
    .from(eduSustituciones)
    .innerJoin(eduTeachers, eq(eduSustituciones.titularId, eduTeachers.id))
    .where(and(eq(eduSustituciones.sustitutoId, sustitutoId), condVigente(hoy)));
  return filas.map((f) => ({ id: f.id, nombre: nombreProfe(f), desde: f.desde, hasta: f.hasta }));
}

/** Un profe al que hay que escribir, y si lo es porque cubre a otro. */
export interface ProfeDestino {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  nombreMostrado: string | null;
  /** Si recibe esto porque cubre a alguien (sustitución vigente): el nombre de quien falta. */
  cubreA: string | null;
}

/**
 * A quién hay que escribir HOY por cada profe: a él, o a quien lo sustituye ahora (el
 * sustituto ocupa su sitio; los dos nombres salen en `cubreA`). Un profe sin ficha no sale.
 * Lo usa Oratorios para avisos e invitaciones de Calendar.
 */
export async function destinatariosDeProfes(ids: readonly string[], hoy: string = hoyISO()): Promise<Map<string, ProfeDestino[]>> {
  const salida = new Map<string, ProfeDestino[]>();
  if (ids.length === 0) return salida;
  const vigentes = await sustitucionesVigentes(hoy);
  const efectivos = new Map(ids.map((id) => [id, aplicarSustituciones([id], vigentes, hoy)]));
  const todos = [...new Set([...ids, ...[...efectivos.values()].flat()])];
  const fichas = await db
    .select({
      id: eduTeachers.id,
      email: eduTeachers.email,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      nombreMostrado: eduTeachers.nombreMostrado,
    })
    .from(eduTeachers)
    .where(inArray(eduTeachers.id, todos));
  const porId = new Map(fichas.map((f) => [f.id, f]));
  for (const id of ids) {
    const lista: ProfeDestino[] = [];
    for (const d of efectivos.get(id) ?? []) {
      const f = porId.get(d);
      if (!f) continue;
      lista.push({ ...f, cubreA: d === id ? null : nombreProfe(porId.get(id)) });
    }
    if (lista.length > 0) salida.set(id, lista);
  }
  return salida;
}

// ─── Lista para la pantalla ───────────────────────────────────────────────────

export interface SustitucionFila {
  id: string;
  sustitutoId: string;
  sustitutoNombre: string;
  titularId: string;
  titularNombre: string;
  desde: string | null;
  hasta: string | null;
  activa: boolean;
  origen: 'educamos' | 'manual';
  nota: string | null;
  estado: EstadoSustitucion;
}

const columnasNombre = (t: typeof eduTeachers) => ({
  nombre: t.nombre,
  nombreMostrado: t.nombreMostrado,
  apellido1: t.apellido1,
  apellido2: t.apellido2,
});

/** Todas las sustituciones con el nombre de cada persona (un solo viaje), las vigentes primero. */
export async function listarSustituciones(hoy: string = hoyISO()): Promise<SustitucionFila[]> {
  const sustituto = aliasedTable(eduTeachers, 'sustituto');
  const titular = aliasedTable(eduTeachers, 'titular');
  const filas = await db
    .select({
      s: eduSustituciones,
      sustituto: columnasNombre(sustituto),
      titular: columnasNombre(titular),
    })
    .from(eduSustituciones)
    .innerJoin(sustituto, eq(eduSustituciones.sustitutoId, sustituto.id))
    .innerJoin(titular, eq(eduSustituciones.titularId, titular.id))
    .orderBy(asc(eduSustituciones.createdAt));
  const peso: Record<EstadoSustitucion, number> = { vigente: 0, programada: 1, desactivada: 2, caducada: 3 };
  return filas
    .map(({ s, sustituto: su, titular: ti }): SustitucionFila => ({
      id: s.id,
      sustitutoId: s.sustitutoId,
      sustitutoNombre: nombreProfe(su),
      titularId: s.titularId,
      titularNombre: nombreProfe(ti),
      desde: s.desde,
      hasta: s.hasta,
      activa: s.activa,
      origen: s.origen === 'educamos' ? 'educamos' : 'manual',
      nota: s.nota,
      estado: estadoSustitucion(s, hoy),
    }))
    .sort((a, b) => peso[a.estado] - peso[b.estado]);
}

// ─── Escritura a mano ─────────────────────────────────────────────────────────

export interface DatosSustitucion {
  sustitutoId: string;
  titularId: string;
  desde: string | null;
  hasta: string | null;
  nota?: string | null;
}

export class ErrorSustitucion extends Error {}

function validar(d: Pick<DatosSustitucion, 'desde' | 'hasta'>) {
  if (d.desde && d.hasta && d.hasta < d.desde) {
    throw new ErrorSustitucion('La fecha de fin no puede ser anterior a la de inicio.');
  }
}

export async function crearSustitucion(d: DatosSustitucion): Promise<EduSustitucion> {
  if (d.sustitutoId === d.titularId) throw new ErrorSustitucion('Una persona no puede sustituirse a sí misma.');
  validar(d);
  const existentes = await db
    .select({ id: eduTeachers.id })
    .from(eduTeachers)
    .where(inArray(eduTeachers.id, [d.sustitutoId, d.titularId]));
  if (existentes.length !== 2) throw new ErrorSustitucion('No encuentro a alguno de los dos en el profesorado.');
  const [fila] = await db
    .insert(eduSustituciones)
    .values({ ...d, nota: d.nota?.trim() || null, origen: 'manual' })
    .onConflictDoNothing({ target: [eduSustituciones.sustitutoId, eduSustituciones.titularId] })
    .returning();
  if (!fila) throw new ErrorSustitucion('Ya existe esa sustitución: búscala en la lista y cámbiale las fechas o enciéndela.');
  return fila;
}

export interface CambiosSustitucion {
  activa?: boolean;
  desde?: string | null;
  hasta?: string | null;
  nota?: string | null;
}

/**
 * Cambia una sustitución. Tocar las fechas a mano la hace **manual**: el próximo sync de
 * Educamos ya no las reescribe (si no, deshacería lo que se acaba de decidir). Encender o
 * apagar no cambia el origen: el sync nunca toca el interruptor.
 */
export async function actualizarSustitucion(id: string, c: CambiosSustitucion): Promise<EduSustitucion | null> {
  const [actual] = await db.select().from(eduSustituciones).where(eq(eduSustituciones.id, id)).limit(1);
  if (!actual) return null;
  const desde = c.desde === undefined ? actual.desde : c.desde;
  const hasta = c.hasta === undefined ? actual.hasta : c.hasta;
  validar({ desde, hasta });
  const cambiaFechas = desde !== actual.desde || hasta !== actual.hasta;
  const [fila] = await db
    .update(eduSustituciones)
    .set({
      activa: c.activa ?? actual.activa,
      desde,
      hasta,
      nota: c.nota === undefined ? actual.nota : c.nota?.trim() || null,
      origen: cambiaFechas ? 'manual' : actual.origen,
      updatedAt: new Date(),
    })
    .where(eq(eduSustituciones.id, id))
    .returning();
  return fila ?? null;
}

export async function borrarSustitucion(id: string): Promise<boolean> {
  const borradas = await db.delete(eduSustituciones).where(eq(eduSustituciones.id, id)).returning({ id: eduSustituciones.id });
  return borradas.length > 0;
}

// ─── Lo que dice Educamos ─────────────────────────────────────────────────────

/** Las sentencias que dejan `edu_sustituciones` como dice el plan (para meterlas en un `db.batch`). */
export function sentenciasDePlan(plan: PlanSustituciones, ahora: Date = new Date()): BatchItem<'pg'>[] {
  const out: BatchItem<'pg'>[] = [];
  for (const c of plan.crear) {
    out.push(
      db
        .insert(eduSustituciones)
        .values({ ...c, origen: 'educamos', updatedAt: ahora })
        .onConflictDoNothing({ target: [eduSustituciones.sustitutoId, eduSustituciones.titularId] }),
    );
  }
  for (const a of plan.actualizar) {
    out.push(
      db
        .update(eduSustituciones)
        .set({ desde: a.desde, hasta: a.hasta, updatedAt: ahora })
        .where(and(eq(eduSustituciones.id, a.id), eq(eduSustituciones.origen, 'educamos'))),
    );
  }
  if (plan.apagar.length > 0) {
    out.push(
      db
        .update(eduSustituciones)
        .set({ activa: false, updatedAt: ahora })
        .where(and(inArray(eduSustituciones.id, plan.apagar), eq(eduSustituciones.origen, 'educamos'))),
    );
  }
  return out;
}

export interface ResumenSustituciones {
  nuevas: number;
  actualizadas: number;
  apagadas: number;
  avisos: string[];
}

export const resumenDePlan = (p: PlanSustituciones): ResumenSustituciones => ({
  nuevas: p.crear.length,
  actualizadas: p.actualizar.length,
  apagadas: p.apagar.length,
  avisos: p.avisos,
});

/**
 * Vuelve a leer, de lo que YA está guardado de Educamos (`edu_teachers.extra` y las fechas de
 * alta y baja), quién sustituye a quién. Sirve para estrenar la pieza sin volver a subir el
 * fichero y para rehacerlo si se corrige un nombre. Con `dryRun` solo cuenta.
 */
export async function releerSustitucionesDeEducamos(dryRun = false): Promise<ResumenSustituciones> {
  const [profes, existentes] = await Promise.all([
    db
      .select({
        id: eduTeachers.id,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        active: eduTeachers.active,
        fechaAlta: eduTeachers.fechaAlta,
        fechaBaja: eduTeachers.fechaBaja,
        // Solo las dos claves, no el jsonb entero (ver docs/04: «nunca select() entero con extra»).
        sustituto: sql<string | null>`${eduTeachers.extra}->>${COLUMNA_SUSTITUTO}`,
        titular: sql<string | null>`${eduTeachers.extra}->>${COLUMNA_TITULAR}`,
      })
      .from(eduTeachers),
    db.select().from(eduSustituciones),
  ]);
  const candidatos = profes.map((p) =>
    candidatoDeExtra(
      p.id,
      { [COLUMNA_SUSTITUTO]: p.sustituto ?? '', [COLUMNA_TITULAR]: p.titular ?? '' },
      { fechaAlta: p.fechaAlta, fechaBaja: p.fechaBaja },
    ),
  );
  const paraTitular: ProfeParaTitular[] = profes.map(({ id, nombre, apellido1, apellido2, active }) => ({ id, nombre, apellido1, apellido2, active }));
  const plan = planSustitucionesEducamos(candidatos, paraTitular, existentes, hoyISO());
  if (!dryRun) {
    const sentencias = sentenciasDePlan(plan);
    if (sentencias.length > 0) await db.batch(sentencias as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  }
  return resumenDePlan(plan);
}
