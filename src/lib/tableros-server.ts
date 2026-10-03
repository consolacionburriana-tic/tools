// Tableros (kanban por equipos): queries. Ficha: docs/27-tableros.md.
//
// TODO lo que lee o escribe pasa antes por «¿esta persona es miembro del equipo?». No hay
// atajo por rol: ni dirección ni TIC entran en un tablero ajeno. Cuando alguien no es miembro
// se contesta igual que si no existiera (404), para no ir contando qué tableros hay.
import { and, asc, count, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import {
  authUsers,
  eduTeachers,
  tabColumnas,
  tabEquipos,
  tabMiembros,
  tabPreferencias,
  tabSeguimiento,
  tabTableros,
  tabTarjetas,
  type TabTarjeta,
} from '@/db/schema';
import { COLEGIO } from '@/lib/colegio';
import { appBaseUrl } from '@/lib/constants';
import { emailConfigurado, enviar } from '@/lib/email';
import { mayusculasBellas } from '@/lib/personas';
import { nombreProfe } from '@/lib/profes';
import {
  avisoQueToca,
  COLUMNAS_INICIALES,
  diaCorto,
  hoyISO,
  nombreDe,
  pilaDe,
  PASO_ORDEN,
  PRIORIDAD_LABELS,
  sumarDias,
  type AccionEquipo,
  type AccionTablero,
  type AccionTarjeta,
  type ColorEtiqueta,
  type ColorTablero,
  type CrearEquipo,
  type DatosTablero,
  type Equipo,
  type Miembro,
  type Persona,
  type Preferencias,
  type Prioridad,
  type RolEquipo,
  type Seguimiento,
  type Tarjeta,
  type TarjetaMia,
} from '@/lib/tableros';
import { correoAsignacion, correoEquipo, correoVencimientos, type ItemVencimiento } from '@/lib/tableros-email';

export interface Yo {
  email: string;
  nombre: string | null;
}

/** Error con su código HTTP: los route handlers lo traducen tal cual. */
export class ErrorTableros extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const NO_EXISTE = () => new ErrorTableros(404, 'No existe o no estás en este equipo');
const SOLO_ADMIN = () => new ErrorTableros(403, 'Eso solo lo puede hacer quien administra el equipo');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un id que no es un uuid no existe (y así Postgres no protesta por el formato). */
export function esId(id: string): boolean {
  return UUID.test(id);
}

type Batch = [BatchItem<'pg'>, ...BatchItem<'pg'>[]];

// ─── Personas del claustro ───────────────────────────────────────────────────

/**
 * A quién se puede meter en un equipo: el profesorado activo y las cuentas dadas de alta en
 * Usuarios y roles, todas del dominio del colegio. «Personas de dentro», nunca correos de fuera.
 */
export async function personasClaustro(): Promise<Persona[]> {
  const [profes, usuarios] = await Promise.all([
    db
      .select({
        email: eduTeachers.email,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        nombreMostrado: eduTeachers.nombreMostrado,
      })
      .from(eduTeachers)
      .where(eq(eduTeachers.active, true)),
    db.select({ email: authUsers.email, nombre: authUsers.nombre }).from(authUsers).where(eq(authUsers.active, true)),
  ]);
  const dominio = `@${COLEGIO.dominio}`;
  const porEmail = new Map<string, Persona>();
  for (const p of profes) {
    const email = (p.email ?? '').trim().toLowerCase();
    if (!email.endsWith(dominio) || porEmail.has(email)) continue;
    porEmail.set(email, { email, nombre: nombreProfe(p) || email.split('@')[0] });
  }
  for (const u of usuarios) {
    const email = u.email.trim().toLowerCase();
    if (!email.endsWith(dominio) || porEmail.has(email)) continue;
    porEmail.set(email, { email, nombre: mayusculasBellas(u.nombre) || email.split('@')[0] });
  }
  return [...porEmail.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Solo correos del colegio entran en un equipo, vengan de donde vengan. */
function soloDelColegio<T extends { email: string }>(lista: T[]): T[] {
  const dominio = `@${COLEGIO.dominio}`;
  return lista.filter((p) => p.email.toLowerCase().endsWith(dominio));
}

// ─── Mapeos ──────────────────────────────────────────────────────────────────

function aTarjeta(f: TabTarjeta, comentarios = 0): Tarjeta {
  return {
    id: f.id,
    tableroId: f.tableroId,
    columnaId: f.columnaId,
    titulo: f.titulo,
    descripcion: f.descripcion,
    prioridad: (f.prioridad as Prioridad | null) ?? null,
    vence: f.vence,
    orden: f.orden,
    responsables: f.responsables ?? [],
    etiquetas: f.etiquetas ?? [],
    checklist: f.checklist ?? [],
    enlaces: f.enlaces ?? [],
    completadaAt: f.completadaAt?.toISOString() ?? null,
    archivadaAt: f.archivadaAt?.toISOString() ?? null,
    createdBy: f.createdBy,
    createdByNombre: f.createdByNombre,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    comentarios,
  };
}

function aMiembro(m: { email: string; nombre: string | null; rol: string }): Miembro {
  return { email: m.email, nombre: m.nombre || m.email.split('@')[0], rol: m.rol === 'admin' ? 'admin' : 'miembro' };
}

function aSeguimiento(s: typeof tabSeguimiento.$inferSelect): Seguimiento {
  return {
    id: s.id,
    tipo: s.tipo === 'actividad' ? 'actividad' : 'comentario',
    texto: s.texto,
    autorEmail: s.autorEmail,
    autorNombre: s.autorNombre,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Los equipos de alguien, como subconsulta (sirve para filtrar sin un viaje previo). */
function misEquipos(email: string) {
  return db.select({ id: tabMiembros.equipoId }).from(tabMiembros).where(eq(tabMiembros.email, email));
}

// ─── Inicio: mis equipos, sus tableros y lo mío ──────────────────────────────

export async function datosInicio(email: string): Promise<{ equipos: Equipo[]; mias: TarjetaMia[]; hoy: string }> {
  const hoy = hoyISO();
  const [equipos, miembros, tableros, cuentas, mias] = await Promise.all([
    db
      .select({ equipo: tabEquipos, miRol: tabMiembros.rol })
      .from(tabEquipos)
      .innerJoin(tabMiembros, and(eq(tabMiembros.equipoId, tabEquipos.id), eq(tabMiembros.email, email)))
      .orderBy(asc(tabEquipos.nombre)),
    db
      .select({ equipoId: tabMiembros.equipoId, email: tabMiembros.email, nombre: tabMiembros.nombre, rol: tabMiembros.rol })
      .from(tabMiembros)
      .where(inArray(tabMiembros.equipoId, misEquipos(email)))
      .orderBy(asc(tabMiembros.nombre)),
    db
      .select({
        id: tabTableros.id,
        equipoId: tabTableros.equipoId,
        nombre: tabTableros.nombre,
        emoji: tabTableros.emoji,
        color: tabTableros.color,
        descripcion: tabTableros.descripcion,
        archivado: tabTableros.archivado,
        orden: tabTableros.orden,
      })
      .from(tabTableros)
      .where(inArray(tabTableros.equipoId, misEquipos(email)))
      .orderBy(asc(tabTableros.orden), asc(tabTableros.createdAt)),
    db
      .select({
        tableroId: tabTarjetas.tableroId,
        abiertas: count(),
        vencidas: sql<number>`count(*) filter (where ${tabTarjetas.vence} < ${hoy})`.mapWith(Number),
      })
      .from(tabTarjetas)
      .innerJoin(tabColumnas, eq(tabColumnas.id, tabTarjetas.columnaId))
      .where(
        and(
          isNull(tabTarjetas.archivadaAt),
          eq(tabColumnas.hecho, false),
          inArray(
            tabTarjetas.tableroId,
            db.select({ id: tabTableros.id }).from(tabTableros).where(inArray(tabTableros.equipoId, misEquipos(email))),
          ),
        ),
      )
      .groupBy(tabTarjetas.tableroId),
    misTarjetas(email),
  ]);
  const cuentaDe = new Map(cuentas.map((c) => [c.tableroId, c]));
  return {
    hoy,
    mias,
    equipos: equipos.map(({ equipo, miRol }) => ({
      id: equipo.id,
      nombre: equipo.nombre,
      emoji: equipo.emoji,
      color: equipo.color as ColorTablero,
      descripcion: equipo.descripcion,
      miRol: miRol === 'admin' ? 'admin' : 'miembro',
      miembros: miembros.filter((m) => m.equipoId === equipo.id).map(aMiembro),
      tableros: tableros
        .filter((t) => t.equipoId === equipo.id)
        .map((t) => ({
          ...t,
          color: t.color as ColorTablero,
          abiertas: cuentaDe.get(t.id)?.abiertas ?? 0,
          vencidas: cuentaDe.get(t.id)?.vencidas ?? 0,
        })),
    })),
  };
}

/**
 * Lo que tengo asignado y sin terminar, en los equipos en los que sigo estando. Si a alguien
 * le sacan de un equipo, sus tarjetas de allí dejan de salirle (aunque se quiten igualmente
 * de sus responsables al sacarle).
 */
export async function misTarjetas(email: string): Promise<TarjetaMia[]> {
  const filas = await db
    .select({
      id: tabTarjetas.id,
      titulo: tabTarjetas.titulo,
      prioridad: tabTarjetas.prioridad,
      vence: tabTarjetas.vence,
      checklist: tabTarjetas.checklist,
      tableroId: tabTableros.id,
      tableroNombre: tabTableros.nombre,
      tableroEmoji: tabTableros.emoji,
      equipoNombre: tabEquipos.nombre,
      columnaNombre: tabColumnas.nombre,
    })
    .from(tabTarjetas)
    .innerJoin(tabColumnas, eq(tabColumnas.id, tabTarjetas.columnaId))
    .innerJoin(tabTableros, eq(tabTableros.id, tabTarjetas.tableroId))
    .innerJoin(tabEquipos, eq(tabEquipos.id, tabTableros.equipoId))
    .innerJoin(tabMiembros, and(eq(tabMiembros.equipoId, tabEquipos.id), eq(tabMiembros.email, email)))
    .where(
      and(
        sql`${tabTarjetas.responsables} @> ${JSON.stringify([email])}::jsonb`,
        isNull(tabTarjetas.archivadaAt),
        eq(tabColumnas.hecho, false),
        eq(tabTableros.archivado, false),
        eq(tabEquipos.archivado, false),
      ),
    );
  return filas.map((f) => ({
    id: f.id,
    titulo: f.titulo,
    prioridad: (f.prioridad as Prioridad | null) ?? null,
    vence: f.vence,
    tableroId: f.tableroId,
    tableroNombre: f.tableroNombre,
    tableroEmoji: f.tableroEmoji,
    equipoNombre: f.equipoNombre,
    columnaNombre: f.columnaNombre,
    checklistHechos: (f.checklist ?? []).filter((i) => i.hecho).length,
    checklistTotal: (f.checklist ?? []).length,
  }));
}

// ─── Equipos ─────────────────────────────────────────────────────────────────

/** Quien crea un equipo queda de admin; los demás que añada, de miembros. */
export async function crearEquipo(datos: CrearEquipo, yo: Yo): Promise<{ id: string; nuevos: Persona[] }> {
  const id = crypto.randomUUID();
  const otros = soloDelColegio(datos.miembros).filter((m) => m.email !== yo.email);
  const unicos = [...new Map(otros.map((m) => [m.email, m])).values()];
  const nombreYo = await nombreEnClaustro(yo);
  const lote: BatchItem<'pg'>[] = [
    db.insert(tabEquipos).values({
      id,
      nombre: datos.nombre,
      emoji: datos.emoji,
      color: datos.color,
      descripcion: datos.descripcion ?? null,
      createdBy: yo.email,
    }),
    db.insert(tabMiembros).values([
      { equipoId: id, email: yo.email, nombre: nombreYo, rol: 'admin', addedBy: yo.email },
      ...unicos.map((m) => ({ equipoId: id, email: m.email, nombre: m.nombre || null, rol: 'miembro', addedBy: yo.email })),
    ]),
  ];
  await db.batch(lote as Batch);
  return { id, nuevos: unicos };
}

/** El nombre de quien está en la pantalla tal como sale en el claustro (no el de Google). */
async function nombreEnClaustro(yo: Yo): Promise<string> {
  const [profe] = await db
    .select({
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      nombreMostrado: eduTeachers.nombreMostrado,
    })
    .from(eduTeachers)
    .where(and(eq(eduTeachers.email, yo.email), eq(eduTeachers.active, true)))
    .limit(1);
  return (profe && nombreProfe(profe)) || mayusculasBellas(yo.nombre) || yo.email.split('@')[0];
}

async function miembrosDe(equipoId: string): Promise<Miembro[]> {
  const filas = await db
    .select({ email: tabMiembros.email, nombre: tabMiembros.nombre, rol: tabMiembros.rol })
    .from(tabMiembros)
    .where(eq(tabMiembros.equipoId, equipoId))
    .orderBy(asc(tabMiembros.nombre));
  return filas.map(aMiembro);
}

export type ResultadoEquipo = {
  /** Personas recién añadidas, para avisarles por correo. */
  nuevos?: Persona[];
  equipoNombre?: string;
  tableroId?: string;
  miembros?: Miembro[];
};

export async function accionEquipo(equipoId: string, a: AccionEquipo, yo: Yo): Promise<ResultadoEquipo> {
  if (!esId(equipoId)) throw NO_EXISTE();
  const [equipo] = await db.select().from(tabEquipos).where(eq(tabEquipos.id, equipoId));
  const miembros = equipo ? await miembrosDe(equipoId) : [];
  const yoMiembro = miembros.find((m) => m.email === yo.email);
  if (!equipo || !yoMiembro) throw NO_EXISTE();
  const esAdmin = yoMiembro.rol === 'admin';
  const admins = miembros.filter((m) => m.rol === 'admin');

  switch (a.accion) {
    case 'editar': {
      if (!esAdmin) throw SOLO_ADMIN();
      const cambios: Partial<typeof tabEquipos.$inferInsert> = { updatedAt: new Date() };
      if (a.nombre !== undefined) cambios.nombre = a.nombre;
      if (a.emoji !== undefined) cambios.emoji = a.emoji;
      if (a.color !== undefined) cambios.color = a.color;
      if (a.descripcion !== undefined) cambios.descripcion = a.descripcion;
      if (a.archivado !== undefined) cambios.archivado = a.archivado;
      await db.update(tabEquipos).set(cambios).where(eq(tabEquipos.id, equipoId));
      return {};
    }
    case 'anadirMiembros': {
      if (!esAdmin) throw SOLO_ADMIN();
      const ya = new Set(miembros.map((m) => m.email));
      const nuevos = [...new Map(soloDelColegio(a.miembros).map((m) => [m.email, m])).values()].filter((m) => !ya.has(m.email));
      if (nuevos.length) {
        await db
          .insert(tabMiembros)
          .values(nuevos.map((m) => ({ equipoId, email: m.email, nombre: m.nombre || null, rol: 'miembro', addedBy: yo.email })))
          .onConflictDoNothing();
      }
      return { nuevos, equipoNombre: equipo.nombre, miembros: await miembrosDe(equipoId) };
    }
    case 'quitarMiembro':
    case 'salir': {
      const email = a.accion === 'salir' ? yo.email : a.email;
      if (a.accion === 'quitarMiembro' && !esAdmin && email !== yo.email) throw SOLO_ADMIN();
      const quien = miembros.find((m) => m.email === email);
      if (!quien) return { miembros };
      if (miembros.length === 1) throw new ErrorTableros(400, 'Eres la única persona del equipo: si ya no hace falta, bórralo');
      if (quien.rol === 'admin' && admins.length === 1) {
        throw new ErrorTableros(400, 'El equipo se quedaría sin nadie que lo administre: haz admin a otra persona antes');
      }
      // Fuera del equipo y fuera de las tarjetas que tenía asignadas allí: si no, seguirían
      // saliendo a su nombre tareas de un tablero que ya no puede abrir.
      await db.batch([
        db.delete(tabMiembros).where(and(eq(tabMiembros.equipoId, equipoId), eq(tabMiembros.email, email))),
        db
          .update(tabTarjetas)
          .set({ responsables: sql`${tabTarjetas.responsables} - ${email}::text` })
          .where(
            and(
              inArray(tabTarjetas.tableroId, db.select({ id: tabTableros.id }).from(tabTableros).where(eq(tabTableros.equipoId, equipoId))),
              sql`${tabTarjetas.responsables} @> ${JSON.stringify([email])}::jsonb`,
            ),
          ),
      ]);
      return { miembros: miembros.filter((m) => m.email !== email) };
    }
    case 'rolMiembro': {
      if (!esAdmin) throw SOLO_ADMIN();
      const quien = miembros.find((m) => m.email === a.email);
      if (!quien) throw NO_EXISTE();
      if (quien.rol === 'admin' && a.rol === 'miembro' && admins.length === 1) {
        throw new ErrorTableros(400, 'Tiene que quedar al menos una persona que administre el equipo');
      }
      await db.update(tabMiembros).set({ rol: a.rol }).where(and(eq(tabMiembros.equipoId, equipoId), eq(tabMiembros.email, a.email)));
      return { miembros: miembros.map((m) => (m.email === a.email ? { ...m, rol: a.rol } : m)) };
    }
    case 'crearTablero': {
      const tableroId = crypto.randomUUID();
      await db.batch([
        db.insert(tabTableros).values({
          id: tableroId,
          equipoId,
          nombre: a.nombre,
          emoji: a.emoji,
          color: a.color,
          descripcion: a.descripcion ?? null,
          orden: sql`coalesce((select max(${tabTableros.orden}) + 1 from ${tabTableros} where ${tabTableros.equipoId} = ${equipoId}), 0)`,
          createdBy: yo.email,
        }),
        db.insert(tabColumnas).values(COLUMNAS_INICIALES.map((c, i) => ({ tableroId, nombre: c.nombre, hecho: c.hecho, orden: i }))),
      ]);
      return { tableroId };
    }
    case 'ordenTableros': {
      if (a.ids.length === 0) return {};
      await db.batch(
        a.ids.map((id, i) =>
          db.update(tabTableros).set({ orden: i }).where(and(eq(tabTableros.id, id), eq(tabTableros.equipoId, equipoId))),
        ) as unknown as Batch,
      );
      return {};
    }
  }
}

export async function borrarEquipo(equipoId: string, yo: Yo): Promise<void> {
  if (!esId(equipoId)) throw NO_EXISTE();
  const [m] = await db
    .select({ rol: tabMiembros.rol })
    .from(tabMiembros)
    .where(and(eq(tabMiembros.equipoId, equipoId), eq(tabMiembros.email, yo.email)));
  if (!m) throw NO_EXISTE();
  if (m.rol !== 'admin') throw SOLO_ADMIN();
  // Las tarjetas apuntan a columnas sin cascada: se borran antes que el equipo (que arrastra
  // tableros, columnas y miembros), en el mismo lote.
  const tableros = db.select({ id: tabTableros.id }).from(tabTableros).where(eq(tabTableros.equipoId, equipoId));
  await db.batch([
    db.delete(tabTarjetas).where(inArray(tabTarjetas.tableroId, tableros)),
    db.delete(tabEquipos).where(eq(tabEquipos.id, equipoId)),
  ]);
}

// ─── Tableros ────────────────────────────────────────────────────────────────

async function accesoTablero(email: string, tableroId: string) {
  if (!esId(tableroId)) return null;
  const [fila] = await db
    .select({ tablero: tabTableros, equipo: tabEquipos, rol: tabMiembros.rol })
    .from(tabTableros)
    .innerJoin(tabEquipos, eq(tabEquipos.id, tabTableros.equipoId))
    .innerJoin(tabMiembros, and(eq(tabMiembros.equipoId, tabTableros.equipoId), eq(tabMiembros.email, email)))
    .where(eq(tabTableros.id, tableroId));
  return fila ? { ...fila, rol: (fila.rol === 'admin' ? 'admin' : 'miembro') as RolEquipo } : null;
}

/** El tablero entero: columnas, tarjetas (sin las archivadas), miembros y tableros hermanos. */
export async function datosTablero(email: string, tableroId: string): Promise<DatosTablero | null> {
  if (!esId(tableroId)) return null;
  const delTablero = db.select({ id: tabTarjetas.id }).from(tabTarjetas).where(eq(tabTarjetas.tableroId, tableroId));
  const equipoDelTablero = db.select({ id: tabTableros.equipoId }).from(tabTableros).where(eq(tabTableros.id, tableroId));
  // Todo en una tanda: el acceso va en la primera consulta y, si no lo hay, el resto se tira.
  const [acceso, columnas, tarjetas, miembros, hermanos, comentarios] = await Promise.all([
    accesoTablero(email, tableroId),
    db.select().from(tabColumnas).where(eq(tabColumnas.tableroId, tableroId)).orderBy(asc(tabColumnas.orden)),
    db
      .select()
      .from(tabTarjetas)
      .where(and(eq(tabTarjetas.tableroId, tableroId), isNull(tabTarjetas.archivadaAt))),
    db
      .select({ email: tabMiembros.email, nombre: tabMiembros.nombre, rol: tabMiembros.rol })
      .from(tabMiembros)
      .where(inArray(tabMiembros.equipoId, equipoDelTablero))
      .orderBy(asc(tabMiembros.nombre)),
    db
      .select({ id: tabTableros.id, nombre: tabTableros.nombre, emoji: tabTableros.emoji })
      .from(tabTableros)
      .where(and(inArray(tabTableros.equipoId, equipoDelTablero), eq(tabTableros.archivado, false)))
      .orderBy(asc(tabTableros.orden), asc(tabTableros.createdAt)),
    db
      .select({ tarjetaId: tabSeguimiento.tarjetaId, n: count() })
      .from(tabSeguimiento)
      .where(and(eq(tabSeguimiento.tipo, 'comentario'), inArray(tabSeguimiento.tarjetaId, delTablero)))
      .groupBy(tabSeguimiento.tarjetaId),
  ]);
  if (!acceso) return null;
  const n = new Map(comentarios.map((c) => [c.tarjetaId, c.n]));
  const t = acceso.tablero;
  return {
    tablero: {
      id: t.id,
      equipoId: t.equipoId,
      nombre: t.nombre,
      emoji: t.emoji,
      color: t.color as ColorTablero,
      descripcion: t.descripcion,
      etiquetas: (t.etiquetas ?? []).map((e) => ({ ...e, color: e.color as ColorEtiqueta })),
      archivado: t.archivado,
    },
    equipo: {
      id: acceso.equipo.id,
      nombre: acceso.equipo.nombre,
      emoji: acceso.equipo.emoji,
      color: acceso.equipo.color as ColorTablero,
      miRol: acceso.rol,
    },
    columnas: columnas.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden, hecho: c.hecho })),
    tarjetas: tarjetas.map((f) => aTarjeta(f, n.get(f.id) ?? 0)),
    miembros: miembros.map(aMiembro),
    hermanos,
    yo: email,
    hoy: hoyISO(),
  };
}

/** Las archivadas de un tablero, para el cajón de «Archivadas». */
export async function tarjetasArchivadas(email: string, tableroId: string): Promise<Tarjeta[]> {
  const [acceso, filas] = await Promise.all([
    accesoTablero(email, tableroId),
    esId(tableroId)
      ? db
          .select()
          .from(tabTarjetas)
          .where(and(eq(tabTarjetas.tableroId, tableroId), sql`${tabTarjetas.archivadaAt} is not null`))
          .orderBy(desc(tabTarjetas.archivadaAt))
          .limit(200)
      : Promise.resolve([] as TabTarjeta[]),
  ]);
  if (!acceso) throw NO_EXISTE();
  return filas.map((f) => aTarjeta(f));
}

export type ResultadoTablero = {
  tarjeta?: Tarjeta;
  columnaId?: string;
  /** Al crear una tarjeta ya asignada, a quién avisar. */
  avisar?: { tarjeta: Tarjeta; emails: string[]; contexto: ContextoAviso };
};

export async function accionTablero(tableroId: string, a: AccionTablero, yo: Yo): Promise<ResultadoTablero> {
  const acceso = await accesoTablero(yo.email, tableroId);
  if (!acceso) throw NO_EXISTE();

  switch (a.accion) {
    case 'editar': {
      // Archivar o recuperar un tablero entero es cosa de admin; renombrarlo, de cualquiera.
      if (a.archivado !== undefined && acceso.rol !== 'admin') throw SOLO_ADMIN();
      const cambios: Partial<typeof tabTableros.$inferInsert> = { updatedAt: new Date() };
      if (a.nombre !== undefined) cambios.nombre = a.nombre;
      if (a.emoji !== undefined) cambios.emoji = a.emoji;
      if (a.color !== undefined) cambios.color = a.color;
      if (a.descripcion !== undefined) cambios.descripcion = a.descripcion;
      if (a.archivado !== undefined) cambios.archivado = a.archivado;
      await db.update(tabTableros).set(cambios).where(eq(tabTableros.id, tableroId));
      return {};
    }
    case 'etiquetas': {
      const etiquetas = a.etiquetas.filter((e) => e.nombre || e.color);
      await db.update(tabTableros).set({ etiquetas, updatedAt: new Date() }).where(eq(tabTableros.id, tableroId));
      return {};
    }
    case 'crearColumna': {
      const id = crypto.randomUUID();
      await db.insert(tabColumnas).values({
        id,
        tableroId,
        nombre: a.nombre,
        hecho: a.hecho,
        orden: sql`coalesce((select max(${tabColumnas.orden}) + 1 from ${tabColumnas} where ${tabColumnas.tableroId} = ${tableroId}), 0)`,
      });
      return { columnaId: id };
    }
    case 'editarColumna': {
      if (!esId(a.columnaId)) throw NO_EXISTE();
      const cambios: Partial<typeof tabColumnas.$inferInsert> = {};
      if (a.nombre !== undefined) cambios.nombre = a.nombre;
      if (a.hecho !== undefined) cambios.hecho = a.hecho;
      const enColumna = and(eq(tabTarjetas.columnaId, a.columnaId), eq(tabTarjetas.tableroId, tableroId));
      const lote: BatchItem<'pg'>[] = [
        db.update(tabColumnas).set(cambios).where(and(eq(tabColumnas.id, a.columnaId), eq(tabColumnas.tableroId, tableroId))),
      ];
      // Si una lista pasa a ser (o deja de ser) «la de terminado», sus tarjetas cambian con ella.
      if (a.hecho === true) lote.push(db.update(tabTarjetas).set({ completadaAt: new Date() }).where(and(enColumna, isNull(tabTarjetas.completadaAt))));
      if (a.hecho === false) lote.push(db.update(tabTarjetas).set({ completadaAt: null }).where(enColumna));
      await db.batch(lote as Batch);
      return {};
    }
    case 'borrarColumna': {
      if (!esId(a.columnaId)) throw NO_EXISTE();
      const columnas = await db.select().from(tabColumnas).where(eq(tabColumnas.tableroId, tableroId)).orderBy(asc(tabColumnas.orden));
      const borrar = columnas.find((c) => c.id === a.columnaId);
      if (!borrar) throw NO_EXISTE();
      const destino = columnas.find((c) => c.id !== a.columnaId && !c.hecho) ?? columnas.find((c) => c.id !== a.columnaId);
      if (!destino) throw new ErrorTableros(400, 'Un tablero necesita al menos una lista');
      // Las tarjetas no se pierden: pasan, al final, a la primera lista que quede.
      await db.batch([
        db
          .update(tabTarjetas)
          .set({
            columnaId: destino.id,
            orden: sql`${tabTarjetas.orden} + coalesce((select max(t2.orden) from ${tabTarjetas} t2 where t2.columna_id = ${destino.id}), 0) + ${PASO_ORDEN}`,
            completadaAt: destino.hecho ? sql`coalesce(${tabTarjetas.completadaAt}, now())` : null,
          })
          .where(eq(tabTarjetas.columnaId, borrar.id)),
        db.delete(tabColumnas).where(eq(tabColumnas.id, borrar.id)),
      ]);
      return { columnaId: destino.id };
    }
    case 'ordenColumnas': {
      await db.batch(
        a.ids.map((id, i) =>
          db.update(tabColumnas).set({ orden: i }).where(and(eq(tabColumnas.id, id), eq(tabColumnas.tableroId, tableroId))),
        ) as unknown as Batch,
      );
      return {};
    }
    case 'crearTarjeta': {
      if (!esId(a.columnaId)) throw NO_EXISTE();
      const [columna, miembros] = await Promise.all([
        db
          .select()
          .from(tabColumnas)
          .where(and(eq(tabColumnas.id, a.columnaId), eq(tabColumnas.tableroId, tableroId)))
          .then((f) => f[0]),
        miembrosDe(acceso.equipo.id),
      ]);
      if (!columna) throw NO_EXISTE();
      const yoNombre = miembros.find((m) => m.email === yo.email)?.nombre ?? yo.nombre;
      const emailsMiembros = new Set(miembros.map((m) => m.email));
      const responsables = [...new Set(a.responsables)].filter((e) => emailsMiembros.has(e));
      const [fila] = await db
        .insert(tabTarjetas)
        .values({
          tableroId,
          columnaId: columna.id,
          titulo: a.titulo,
          prioridad: a.prioridad,
          vence: a.vence,
          responsables,
          orden: sql`coalesce((select max(${tabTarjetas.orden}) from ${tabTarjetas} where ${tabTarjetas.columnaId} = ${columna.id}), 0) + ${PASO_ORDEN}`,
          completadaAt: columna.hecho ? new Date() : null,
          createdBy: yo.email,
          createdByNombre: yoNombre,
        })
        .returning();
      const tarjeta = aTarjeta(fila);
      const emails = responsables.filter((e) => e !== yo.email);
      return {
        tarjeta,
        avisar: emails.length
          ? { tarjeta, emails, contexto: contextoAviso(acceso.tablero, acceso.equipo, miembros, yoNombre ?? yo.email) }
          : undefined,
      };
    }
  }
}

export async function borrarTablero(tableroId: string, yo: Yo): Promise<void> {
  const acceso = await accesoTablero(yo.email, tableroId);
  if (!acceso) throw NO_EXISTE();
  if (acceso.rol !== 'admin') throw SOLO_ADMIN();
  await db.batch([
    db.delete(tabTarjetas).where(eq(tabTarjetas.tableroId, tableroId)),
    db.delete(tabTableros).where(eq(tabTableros.id, tableroId)),
  ]);
}

// ─── Tarjetas ────────────────────────────────────────────────────────────────

async function accesoTarjeta(email: string, tarjetaId: string) {
  if (!esId(tarjetaId)) return null;
  const [fila] = await db
    .select({ tarjeta: tabTarjetas, tablero: tabTableros, equipo: tabEquipos, columna: tabColumnas })
    .from(tabTarjetas)
    .innerJoin(tabTableros, eq(tabTableros.id, tabTarjetas.tableroId))
    .innerJoin(tabEquipos, eq(tabEquipos.id, tabTableros.equipoId))
    .innerJoin(tabColumnas, eq(tabColumnas.id, tabTarjetas.columnaId))
    .innerJoin(tabMiembros, and(eq(tabMiembros.equipoId, tabTableros.equipoId), eq(tabMiembros.email, email)))
    .where(eq(tabTarjetas.id, tarjetaId));
  return fila ?? null;
}

export async function seguimientoDe(email: string, tarjetaId: string): Promise<Seguimiento[]> {
  if (!esId(tarjetaId)) throw NO_EXISTE();
  const [acceso, filas] = await Promise.all([
    accesoTarjeta(email, tarjetaId),
    db.select().from(tabSeguimiento).where(eq(tabSeguimiento.tarjetaId, tarjetaId)).orderBy(desc(tabSeguimiento.createdAt)).limit(200),
  ]);
  if (!acceso) throw NO_EXISTE();
  return filas.map(aSeguimiento);
}

export interface ContextoAviso {
  tableroNombre: string;
  tableroEmoji: string;
  equipoNombre: string;
  miembros: Persona[];
  quien: string;
}

function contextoAviso(
  tablero: { nombre: string; emoji: string },
  equipo: { nombre: string },
  miembros: Persona[],
  quien: string,
): ContextoAviso {
  return { tableroNombre: tablero.nombre, tableroEmoji: tablero.emoji, equipoNombre: equipo.nombre, miembros, quien };
}

export type ResultadoTarjeta = {
  tarjeta?: Tarjeta;
  seguimiento?: Seguimiento[];
  avisar?: { tarjeta: Tarjeta; emails: string[]; contexto: ContextoAviso };
};

export async function accionTarjeta(tarjetaId: string, a: AccionTarjeta, yo: Yo): Promise<ResultadoTarjeta> {
  const acceso = await accesoTarjeta(yo.email, tarjetaId);
  if (!acceso) throw NO_EXISTE();
  const antes = acceso.tarjeta;
  const necesitaMiembros = a.accion === 'editar' || a.accion === 'mover' || a.accion === 'archivar' || a.accion === 'comentar';
  const miembros = necesitaMiembros ? await miembrosDe(acceso.equipo.id) : [];
  const yoNombre = miembros.find((m) => m.email === yo.email)?.nombre ?? yo.nombre ?? yo.email;
  const actividad = (texto: string) =>
    db.insert(tabSeguimiento).values({ tarjetaId, tipo: 'actividad', texto, autorEmail: yo.email, autorNombre: yoNombre });

  switch (a.accion) {
    case 'editar': {
      const cambios: Partial<typeof tabTarjetas.$inferInsert> = { updatedAt: new Date() };
      const notas: string[] = [];
      let nuevos: string[] = [];
      if (a.titulo !== undefined) cambios.titulo = a.titulo;
      if (a.descripcion !== undefined) cambios.descripcion = a.descripcion;
      if (a.checklist !== undefined) cambios.checklist = a.checklist;
      if (a.enlaces !== undefined) cambios.enlaces = a.enlaces;
      if (a.etiquetas !== undefined) {
        const validas = new Set((acceso.tablero.etiquetas ?? []).map((e) => e.id));
        cambios.etiquetas = [...new Set(a.etiquetas)].filter((e) => validas.has(e));
      }
      if (a.prioridad !== undefined && a.prioridad !== antes.prioridad) {
        cambios.prioridad = a.prioridad;
        notas.push(a.prioridad ? `puso prioridad ${PRIORIDAD_LABELS[a.prioridad].toLowerCase()}` : 'quitó la prioridad');
      }
      if (a.vence !== undefined && a.vence !== antes.vence) {
        cambios.vence = a.vence;
        // Fecha nueva, avisos nuevos.
        cambios.avisoProximoPara = null;
        cambios.avisoVencidoPara = null;
        notas.push(a.vence ? `puso fecha límite: ${diaCorto(a.vence)}` : 'quitó la fecha límite');
      }
      if (a.responsables !== undefined) {
        const validos = new Set(miembros.map((m) => m.email));
        const despues = [...new Set(a.responsables)].filter((e) => validos.has(e));
        const previos = antes.responsables ?? [];
        nuevos = despues.filter((e) => !previos.includes(e));
        const quitados = previos.filter((e) => !despues.includes(e));
        cambios.responsables = despues;
        if (nuevos.length) notas.push(`asignó a ${nuevos.map((e) => nombreDe(e, miembros)).join(', ')}`);
        if (quitados.length) notas.push(`quitó a ${quitados.map((e) => nombreDe(e, miembros)).join(', ')}`);
      }
      const lote: BatchItem<'pg'>[] = [db.update(tabTarjetas).set(cambios).where(eq(tabTarjetas.id, tarjetaId)).returning()];
      for (const n of notas) lote.push(actividad(n));
      const [filas] = (await db.batch(lote as Batch)) as unknown as [TabTarjeta[]];
      const tarjeta = aTarjeta(filas[0]);
      const emails = nuevos.filter((e) => e !== yo.email);
      return {
        tarjeta,
        avisar: emails.length
          ? { tarjeta, emails, contexto: contextoAviso(acceso.tablero, acceso.equipo, miembros, yoNombre) }
          : undefined,
      };
    }
    case 'mover': {
      if (!esId(a.columnaId)) throw NO_EXISTE();
      const [columna] = await db
        .select()
        .from(tabColumnas)
        .where(and(eq(tabColumnas.id, a.columnaId), eq(tabColumnas.tableroId, antes.tableroId)));
      if (!columna) throw NO_EXISTE();
      const cambia = columna.id !== antes.columnaId;
      const completadaAt = columna.hecho ? (antes.completadaAt ?? new Date()) : null;
      const lote: BatchItem<'pg'>[] = [
        db
          .update(tabTarjetas)
          .set({ columnaId: columna.id, orden: a.orden, completadaAt, updatedAt: new Date() })
          .where(eq(tabTarjetas.id, tarjetaId))
          .returning(),
      ];
      if (cambia) lote.push(actividad(`la movió a «${columna.nombre}»`));
      const [filas] = (await db.batch(lote as Batch)) as unknown as [TabTarjeta[]];
      return { tarjeta: aTarjeta(filas[0]) };
    }
    case 'archivar': {
      const [filas] = (await db.batch([
        db
          .update(tabTarjetas)
          .set({ archivadaAt: a.archivada ? new Date() : null, updatedAt: new Date() })
          .where(eq(tabTarjetas.id, tarjetaId))
          .returning(),
        actividad(a.archivada ? 'la archivó' : 'la sacó del archivo'),
      ])) as unknown as [TabTarjeta[]];
      return { tarjeta: aTarjeta(filas[0]) };
    }
    case 'comentar': {
      await db.insert(tabSeguimiento).values({ tarjetaId, tipo: 'comentario', texto: a.texto, autorEmail: yo.email, autorNombre: yoNombre });
      return { seguimiento: await seguimientoDe(yo.email, tarjetaId) };
    }
    case 'borrarComentario': {
      if (!esId(a.comentarioId)) throw NO_EXISTE();
      // Cada uno borra lo suyo, y solo comentarios (la actividad es el registro de lo que pasó).
      await db
        .delete(tabSeguimiento)
        .where(
          and(
            eq(tabSeguimiento.id, a.comentarioId),
            eq(tabSeguimiento.tarjetaId, tarjetaId),
            eq(tabSeguimiento.tipo, 'comentario'),
            eq(tabSeguimiento.autorEmail, yo.email),
          ),
        );
      return { seguimiento: await seguimientoDe(yo.email, tarjetaId) };
    }
  }
}

export async function borrarTarjeta(tarjetaId: string, yo: Yo): Promise<void> {
  const acceso = await accesoTarjeta(yo.email, tarjetaId);
  if (!acceso) throw NO_EXISTE();
  await db.delete(tabTarjetas).where(eq(tabTarjetas.id, tarjetaId));
}

// ─── Preferencias de correo ──────────────────────────────────────────────────

export async function preferencias(email: string): Promise<Preferencias> {
  const [p] = await db.select().from(tabPreferencias).where(eq(tabPreferencias.email, email));
  return { correoAsignacion: p?.correoAsignacion ?? true, correoVencimientos: p?.correoVencimientos ?? true };
}

export async function guardarPreferencias(email: string, p: Preferencias): Promise<Preferencias> {
  await db
    .insert(tabPreferencias)
    .values({ email, ...p, updatedAt: new Date() })
    .onConflictDoUpdate({ target: tabPreferencias.email, set: { ...p, updatedAt: new Date() } });
  return p;
}

async function quienesNoQuieren(emails: string[], campo: 'correoAsignacion' | 'correoVencimientos'): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const filas = await db
    .select({ email: tabPreferencias.email, asig: tabPreferencias.correoAsignacion, venc: tabPreferencias.correoVencimientos })
    .from(tabPreferencias)
    .where(inArray(tabPreferencias.email, emails));
  return new Set(filas.filter((f) => (campo === 'correoAsignacion' ? !f.asig : !f.venc)).map((f) => f.email));
}

// ─── Correos ─────────────────────────────────────────────────────────────────

export function urlTarjeta(tableroId: string, tarjetaId: string): string {
  return `${appBaseUrl()}/gestion/tableros/${tableroId}?t=${tarjetaId}`;
}

/**
 * Avisa a quien le acaban de asignar una tarjeta. Se lanza con `after()` desde el route: el
 * que asigna no espera al correo, y si el correo falla la asignación ya está guardada.
 */
export async function avisarAsignacion(av: NonNullable<ResultadoTarjeta['avisar']>, yo: Yo): Promise<void> {
  if (!emailConfigurado() || av.emails.length === 0) return;
  const noQuieren = await quienesNoQuieren(av.emails, 'correoAsignacion');
  const hoy = hoyISO();
  for (const email of av.emails) {
    if (noQuieren.has(email)) continue;
    const nombre = nombreDe(email, av.contexto.miembros);
    const { subject, html } = correoAsignacion({
      saludo: pilaDe(nombre),
      quien: av.contexto.quien,
      hoy,
      tarjeta: {
        titulo: av.tarjeta.titulo,
        tablero: `${av.contexto.tableroEmoji} ${av.contexto.tableroNombre}`,
        equipo: av.contexto.equipoNombre,
        vence: av.tarjeta.vence,
        prioridad: av.tarjeta.prioridad,
        descripcion: av.tarjeta.descripcion,
        url: urlTarjeta(av.tarjeta.tableroId, av.tarjeta.id),
      },
    });
    try {
      await enviar('tableros', { to: email, subject, html, replyTo: yo.email });
    } catch (error) {
      console.error('Tableros · aviso de asignación:', error instanceof Error ? error.message : error);
    }
  }
}

/** Avisa a quien acaban de meter en un equipo, con los tableros que tiene. */
export async function avisarEquipo(equipoId: string, nuevos: Persona[], yo: Yo): Promise<void> {
  if (!emailConfigurado() || nuevos.length === 0) return;
  const [equipo, tableros, noQuieren, quien] = await Promise.all([
    db.select({ nombre: tabEquipos.nombre, emoji: tabEquipos.emoji }).from(tabEquipos).where(eq(tabEquipos.id, equipoId)).then((f) => f[0]),
    db
      .select({ nombre: tabTableros.nombre, emoji: tabTableros.emoji })
      .from(tabTableros)
      .where(and(eq(tabTableros.equipoId, equipoId), eq(tabTableros.archivado, false)))
      .orderBy(asc(tabTableros.orden)),
    quienesNoQuieren(
      nuevos.map((n) => n.email),
      'correoAsignacion',
    ),
    nombreEnClaustro(yo),
  ]);
  if (!equipo) return;
  for (const p of nuevos) {
    if (noQuieren.has(p.email)) continue;
    const { subject, html } = correoEquipo({
      saludo: pilaDe(p.nombre || p.email.split('@')[0]),
      quien,
      equipo: `${equipo.emoji} ${equipo.nombre}`,
      tableros: tableros.map((t) => `${t.emoji} ${t.nombre}`),
      url: `${appBaseUrl()}/gestion/tableros`,
    });
    try {
      await enviar('tableros', { to: p.email, subject, html, replyTo: yo.email });
    } catch (error) {
      console.error('Tableros · aviso de equipo:', error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Margen del aviso «vence ya»: hoy y mañana… salvo el viernes, que avisa también de lo del
 * lunes (el cron no manda nada en fin de semana).
 */
export function margenAviso(hoy: string): number {
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  return dia === 5 ? 3 : 1;
}

/**
 * El aviso diario por correo (cron de `vercel.json`): a cada responsable, un solo correo con lo
 * suyo que vence ya y lo que se le ha pasado. Cada tarjeta avisa una vez por deadline (ver
 * `avisoQueToca`), así que es idempotente: lanzarlo dos veces el mismo día no repite nada.
 */
export async function enviarAvisosVencimiento(ahora = new Date()): Promise<{ correos: number; tarjetas: number; mensaje: string }> {
  const hoy = hoyISO(ahora);
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  if (dia === 0 || dia === 6) return { correos: 0, tarjetas: 0, mensaje: 'Fin de semana: no se avisa' };
  if (!emailConfigurado()) return { correos: 0, tarjetas: 0, mensaje: 'Sin transporte de correo configurado' };
  const limite = sumarDias(hoy, margenAviso(hoy));

  const filas = await db
    .select({
      id: tabTarjetas.id,
      titulo: tabTarjetas.titulo,
      prioridad: tabTarjetas.prioridad,
      vence: tabTarjetas.vence,
      responsables: tabTarjetas.responsables,
      avisoProximoPara: tabTarjetas.avisoProximoPara,
      avisoVencidoPara: tabTarjetas.avisoVencidoPara,
      tableroId: tabTableros.id,
      tableroNombre: tabTableros.nombre,
      tableroEmoji: tabTableros.emoji,
      equipoId: tabEquipos.id,
      equipoNombre: tabEquipos.nombre,
    })
    .from(tabTarjetas)
    .innerJoin(tabColumnas, eq(tabColumnas.id, tabTarjetas.columnaId))
    .innerJoin(tabTableros, eq(tabTableros.id, tabTarjetas.tableroId))
    .innerJoin(tabEquipos, eq(tabEquipos.id, tabTableros.equipoId))
    .where(
      and(
        isNull(tabTarjetas.archivadaAt),
        eq(tabColumnas.hecho, false),
        eq(tabTableros.archivado, false),
        eq(tabEquipos.archivado, false),
        lte(tabTarjetas.vence, limite),
        sql`jsonb_array_length(${tabTarjetas.responsables}) > 0`,
      ),
    );

  const tocan = filas
    .map((f) => ({ ...f, vence: f.vence as string, tipo: avisoQueToca({ ...f, vence: f.vence as string }, hoy, margenAviso(hoy)) }))
    .filter((f): f is typeof f & { tipo: 'proximo' | 'vencido' } => f.tipo !== null);
  if (tocan.length === 0) return { correos: 0, tarjetas: 0, mensaje: 'Nada que avisar hoy' };

  const equipos = [...new Set(tocan.map((t) => t.equipoId))];
  const todos = [...new Set(tocan.flatMap((t) => t.responsables))];
  const [miembros, noQuieren] = await Promise.all([
    db
      .select({ equipoId: tabMiembros.equipoId, email: tabMiembros.email, nombre: tabMiembros.nombre })
      .from(tabMiembros)
      .where(inArray(tabMiembros.equipoId, equipos)),
    quienesNoQuieren(todos, 'correoVencimientos'),
  ]);
  const esMiembro = (equipoId: string, email: string) => miembros.some((m) => m.equipoId === equipoId && m.email === email);

  const porPersona = new Map<string, ItemVencimiento[]>();
  for (const t of tocan) {
    for (const email of t.responsables) {
      if (noQuieren.has(email) || !esMiembro(t.equipoId, email)) continue;
      const lista = porPersona.get(email) ?? [];
      lista.push({
        tipo: t.tipo,
        titulo: t.titulo,
        tablero: `${t.tableroEmoji} ${t.tableroNombre}`,
        equipo: t.equipoNombre,
        vence: t.vence,
        prioridad: (t.prioridad as Prioridad | null) ?? null,
        url: urlTarjeta(t.tableroId, t.id),
      });
      porPersona.set(email, lista);
    }
  }

  let correos = 0;
  for (const [email, items] of porPersona) {
    const nombre = miembros.find((m) => m.email === email)?.nombre || email.split('@')[0];
    const { subject, html } = correoVencimientos({ saludo: pilaDe(nombre), items, hoy, url: `${appBaseUrl()}/gestion/tableros` });
    try {
      await enviar('tableros', { to: email, subject, html });
      correos++;
    } catch (error) {
      console.error('Tableros · aviso de vencimiento:', error instanceof Error ? error.message : error);
    }
  }

  // Se marca aunque algún correo haya fallado: mejor un aviso perdido que uno repetido cada día
  // a todo el equipo.
  const proximas = tocan.filter((t) => t.tipo === 'proximo').map((t) => t.id);
  const vencidas = tocan.filter((t) => t.tipo === 'vencido').map((t) => t.id);
  const lote: BatchItem<'pg'>[] = [];
  if (proximas.length) lote.push(db.update(tabTarjetas).set({ avisoProximoPara: sql`${tabTarjetas.vence}` }).where(inArray(tabTarjetas.id, proximas)));
  if (vencidas.length) lote.push(db.update(tabTarjetas).set({ avisoVencidoPara: sql`${tabTarjetas.vence}` }).where(inArray(tabTarjetas.id, vencidas)));
  if (lote.length) await db.batch(lote as Batch);

  return { correos, tarjetas: tocan.length, mensaje: `${correos} correo${correos === 1 ? '' : 's'} por ${tocan.length} tarjeta${tocan.length === 1 ? '' : 's'}` };
}
