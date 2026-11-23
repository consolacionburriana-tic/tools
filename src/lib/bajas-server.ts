// Bajas del profesorado — consultas y escrituras. La lógica pura está en `bajas.ts`.
// Ficha: docs/32-sustituciones.md, «Bajas» (David, 23-nov-2026).
//
// La baja manda sobre sus coberturas: al guardarla, cada sustituto queda como Cobertura por baja
// (`edu_sustituciones`) con `baja_id`, origen `manual` (el sync de Educamos ya no le cambia las
// fechas: ver `actualizarCoberturaBaja`) y las fechas que salen de la baja (`fechasCobertura`).
// Así todo lo que ya lee las coberturas (tutorías, avisos, Mi horario, Oratorios, Sustituciones)
// sigue funcionando sin cambiar.
import { aliasedTable, and, asc, eq, gt, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { eduBajas, eduCoberturasBaja, eduTeachers } from '@/db/schema';
import { altaPorConfirmar, estadoBaja, fechasCobertura, seSolapan, type BajaBase, type EntradaBaja, type EstadoBaja } from '@/lib/bajas';
import { estadoCoberturaBaja } from '@/lib/coberturas-baja';
import { hoyEnEspana } from '@/lib/oratorios';
import { nombreProfeBreve } from '@/lib/profes';

export class ErrorBaja extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const columnasNombre = (t: typeof eduTeachers) => ({ nombre: t.nombre, nombreMostrado: t.nombreMostrado, apellido1: t.apellido1, apellido2: t.apellido2 });

// ─── Lo que usan las demás pantallas ─────────────────────────────────────────

/** Las bajas que tocan un rango de fechas (para saber quién está de baja cada día). */
export async function bajasEnRango(desde: string, hasta: string): Promise<BajaBase[]> {
  return db
    .select({ profeId: eduBajas.profeId, desde: eduBajas.desde, altaPrevista: eduBajas.altaPrevista, altaReal: eduBajas.altaReal })
    .from(eduBajas)
    .where(and(lte(eduBajas.desde, hasta), or(isNull(eduBajas.altaReal), gt(eduBajas.altaReal, desde))));
}

// ─── La pestaña ──────────────────────────────────────────────────────────────

export interface SustitutoDeBaja {
  coberturaId: string;
  id: string;
  nombre: string;
  desde: string | null;
  hasta: string | null;
  activa: boolean;
}

export interface BajaFila {
  id: string;
  profeId: string;
  profeNombre: string;
  desde: string;
  altaPrevista: string | null;
  altaReal: string | null;
  motivo: string;
  ampliable: boolean;
  nota: string | null;
  estado: EstadoBaja;
  /** Pasó el alta prevista sin alta real: confirmarla o ampliarla. */
  porConfirmar: boolean;
  sustitutos: SustitutoDeBaja[];
}

/** Una cobertura vigente o programada sin baja anotada (casi siempre, de Educamos): faltan sus fechas. */
export interface CoberturaSinBaja {
  id: string;
  sustitutoId: string;
  sustitutoNombre: string;
  titularId: string;
  titularNombre: string;
  desde: string | null;
  hasta: string | null;
  origen: string;
}

export interface DatosBajas {
  hoy: string;
  bajas: BajaFila[];
  sinBaja: CoberturaSinBaja[];
  profes: { id: string; nombre: string }[];
}

export async function datosBajas(hoy: string = hoyEnEspana()): Promise<DatosBajas> {
  const sustituto = aliasedTable(eduTeachers, 'sustituto');
  const titular = aliasedTable(eduTeachers, 'titular');
  const [bajas, coberturas, profes] = await Promise.all([
    db
      .select({ b: eduBajas, p: columnasNombre(eduTeachers) })
      .from(eduBajas)
      .innerJoin(eduTeachers, eq(eduTeachers.id, eduBajas.profeId))
      .orderBy(asc(eduBajas.desde)),
    db
      .select({ c: eduCoberturasBaja, s: columnasNombre(sustituto), t: columnasNombre(titular) })
      .from(eduCoberturasBaja)
      .innerJoin(sustituto, eq(sustituto.id, eduCoberturasBaja.sustitutoId))
      .innerJoin(titular, eq(titular.id, eduCoberturasBaja.titularId)),
    db.select({ id: eduTeachers.id, ...columnasNombre(eduTeachers) }).from(eduTeachers).where(eq(eduTeachers.active, true)),
  ]);
  const filas: BajaFila[] = bajas.map(({ b, p }) => ({
    id: b.id,
    profeId: b.profeId,
    profeNombre: nombreProfeBreve(p),
    desde: b.desde,
    altaPrevista: b.altaPrevista,
    altaReal: b.altaReal,
    motivo: b.motivo,
    ampliable: b.ampliable,
    nota: b.nota,
    estado: estadoBaja(b, hoy),
    porConfirmar: altaPorConfirmar(b, hoy),
    sustitutos: coberturas
      .filter(({ c }) => c.bajaId === b.id)
      .map(({ c, s }) => ({ coberturaId: c.id, id: c.sustitutoId, nombre: nombreProfeBreve(s), desde: c.desde, hasta: c.hasta, activa: c.activa })),
  }));
  const peso: Record<EstadoBaja, number> = { en_curso: 0, proxima: 1, terminada: 2 };
  filas.sort((a, b) => peso[a.estado] - peso[b.estado] || (a.estado === 'terminada' ? b.desde.localeCompare(a.desde) : a.desde.localeCompare(b.desde)));
  const sinBaja = coberturas
    .filter(({ c }) => !c.bajaId && ['vigente', 'programada'].includes(estadoCoberturaBaja(c, hoy)))
    .map(({ c, s, t }) => ({
      id: c.id,
      sustitutoId: c.sustitutoId,
      sustitutoNombre: nombreProfeBreve(s),
      titularId: c.titularId,
      titularNombre: nombreProfeBreve(t),
      desde: c.desde,
      hasta: c.hasta,
      origen: c.origen,
    }));
  return {
    hoy,
    bajas: filas,
    sinBaja,
    profes: profes.map((p) => ({ id: p.id, nombre: nombreProfeBreve(p) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

// ─── Escritura ───────────────────────────────────────────────────────────────

/**
 * Crea (sin `id`) o cambia una baja y deja sus coberturas como dice: cada sustituto, una cobertura
 * con las fechas de la baja; quien deja de estar en la lista, apagado y suelto de la baja. Todo en
 * una sola escritura (`db.batch`).
 */
export async function guardarBaja(id: string | null, e: EntradaBaja, email: string): Promise<{ id: string }> {
  const ids = [...new Set([e.profeId, ...e.sustitutos.map((s) => s.id)])];
  const [personas, otras, enlazadas] = await Promise.all([
    db.select({ id: eduTeachers.id }).from(eduTeachers).where(inArray(eduTeachers.id, ids)),
    db
      .select({ id: eduBajas.id, desde: eduBajas.desde, altaReal: eduBajas.altaReal })
      .from(eduBajas)
      .where(and(eq(eduBajas.profeId, e.profeId), id ? ne(eduBajas.id, id) : undefined)),
    id ? db.select({ id: eduCoberturasBaja.id, sustitutoId: eduCoberturasBaja.sustitutoId }).from(eduCoberturasBaja).where(eq(eduCoberturasBaja.bajaId, id)) : Promise.resolve([]),
  ]);
  if (personas.length !== ids.length) throw new ErrorBaja('No encuentro a alguna de esas personas en el profesorado.', 404);
  if (id) {
    const [actual] = await db.select({ profeId: eduBajas.profeId }).from(eduBajas).where(eq(eduBajas.id, id)).limit(1);
    if (!actual) throw new ErrorBaja('Esa baja no existe.', 404);
    if (actual.profeId !== e.profeId) throw new ErrorBaja('Una baja no cambia de persona: bórrala y apunta otra.');
  }
  if (otras.some((o) => seSolapan(o, e))) throw new ErrorBaja('Ya tiene otra baja en esas fechas: cámbiala o dale el alta antes.', 409);

  const ahora = new Date();
  const bajaId = id ?? crypto.randomUUID();
  const valores = {
    desde: e.desde,
    altaPrevista: e.altaPrevista,
    altaReal: e.altaReal,
    motivo: e.motivo,
    ampliable: e.ampliable,
    nota: e.nota?.trim() || null,
    updatedByEmail: email,
    updatedAt: ahora,
  };
  const sentencias: BatchItem<'pg'>[] = [
    id
      ? db.update(eduBajas).set(valores).where(eq(eduBajas.id, id))
      : db.insert(eduBajas).values({ id: bajaId, profeId: e.profeId, createdByEmail: email, ...valores }),
  ];
  for (const s of e.sustitutos) {
    const f = fechasCobertura(e, s.desde);
    sentencias.push(
      db
        .insert(eduCoberturasBaja)
        .values({ sustitutoId: s.id, titularId: e.profeId, bajaId, desde: f.desde, hasta: f.hasta, activa: true, origen: 'manual', updatedAt: ahora })
        .onConflictDoUpdate({
          target: [eduCoberturasBaja.sustitutoId, eduCoberturasBaja.titularId],
          set: { bajaId, desde: f.desde, hasta: f.hasta, activa: true, origen: 'manual', updatedAt: ahora },
        }),
    );
  }
  const fuera = enlazadas.filter((c) => !e.sustitutos.some((s) => s.id === c.sustitutoId)).map((c) => c.id);
  if (fuera.length > 0) sentencias.push(db.update(eduCoberturasBaja).set({ activa: false, bajaId: null, updatedAt: ahora }).where(inArray(eduCoberturasBaja.id, fuera)));
  await db.batch(sentencias as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  return { id: bajaId };
}

/** «Ha vuelto»: alta real ese día (el primero de vuelta) y sus coberturas se cierran el día antes. */
export async function darAlta(id: string, alta: string, email: string): Promise<void> {
  const [b] = await db.select().from(eduBajas).where(eq(eduBajas.id, id)).limit(1);
  if (!b) throw new ErrorBaja('Esa baja no existe.', 404);
  if (alta <= b.desde) throw new ErrorBaja('El alta va después del primer día de baja.');
  const sustitutos = await db.select({ id: eduCoberturasBaja.sustitutoId, desde: eduCoberturasBaja.desde }).from(eduCoberturasBaja).where(and(eq(eduCoberturasBaja.bajaId, id), eq(eduCoberturasBaja.activa, true)));
  await guardarBaja(id, { profeId: b.profeId, desde: b.desde, altaPrevista: b.altaPrevista, altaReal: alta, motivo: b.motivo, ampliable: b.ampliable, nota: b.nota, sustitutos: sustitutos.map((s) => ({ id: s.id, desde: s.desde })) }, email);
}

/** Borra una baja apuntada por error. Sus coberturas se quedan como estaban, sin baja (vuelven a «Falta anotar la baja»). */
export async function borrarBaja(id: string): Promise<boolean> {
  // `baja_id` tiene ON DELETE SET NULL: las coberturas se sueltan solas.
  const fuera = await db.delete(eduBajas).where(eq(eduBajas.id, id)).returning({ id: eduBajas.id });
  return fuera.length > 0;
}
