// Calendarios del dominio · lo que toca Neon y orquesta Google. Ficha: docs/25-calendarios.md
//
// El escaneo va POR PASOS que lanza la pantalla uno detrás de otro (con su barra de
// progreso), no en un único request: un dominio con cientos de usuarios no cabe en el
// tiempo de una función. Cada paso es idempotente y devuelve el cursor del siguiente.
//
//   1. classroom → todas las clases del dominio con su calendarId (paginado de 200)
//   2. usuarios  → el calendarList de cada usuario, de 30 en 30 (opcional pero recomendado:
//                  es lo único que encuentra los calendarios de clases ya borradas)
//   3. eventos   → cuántos eventos tiene cada calendario, de 12 en 12
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { calCalendarios, calSuscripciones } from '@/db/schema';
import {
  candidatosParaBorrar,
  cursoDeCalendario,
  grupoDeCalendario,
  pareceDeClassroom,
  type CalendarioFila,
} from '@/lib/calendarios';
import {
  borrarCalendario,
  calendariosDeUsuario,
  contarEventos,
  enParalelo,
  explicarError,
  mapaUsuarios,
  paginaClases,
  paginaUsuarios,
  type EntradaLista,
} from '@/lib/calendarios-google';

/** Marca de las clases que ya no salen en Classroom (se borraron): la fila se queda. */
export const CLASE_DESAPARECIDA = 'DESAPARECIDA';

/**
 * A quién se suplanta para leer Directory y Classroom: tiene que ser administrador del
 * dominio. `GOOGLE_ADMIN_BUZON` si está puesto; si no, quien está usando la pantalla (que,
 * si entra aquí, es TIC y casi seguro admin).
 */
export function buzonAdmin(emailSesion: string): string {
  return (process.env.GOOGLE_ADMIN_BUZON || emailSesion).trim().toLowerCase();
}

// ── Paso 1: Classroom ──────────────────────────────────────────────────────────

export async function pasoClassroom(
  admin: string,
  cursor: string | null,
  inicio: Date,
): Promise<{ siguiente: string | null; clases: number; conCalendario: number }> {
  const [usuarios, { clases, siguiente }] = await Promise.all([mapaUsuarios(admin), paginaClases(admin, cursor)]);
  const ahora = new Date();
  const filas = clases
    .filter((c) => c.calendarId)
    .map((c) => ({
      id: c.calendarId!,
      nombre: c.nombre,
      esClassroom: true,
      courseId: c.id,
      courseNombre: c.nombre,
      courseSeccion: c.seccion,
      courseEstado: c.estado,
      courseCreadoAt: c.creadaAt,
      courseOwnerEmail: c.ownerId ? (usuarios.get(c.ownerId) ?? null) : null,
      courseVistoAt: ahora,
      vistoAt: ahora,
      updatedAt: ahora,
    }));
  if (filas.length > 0) {
    await db
      .insert(calCalendarios)
      .values(filas)
      .onConflictDoUpdate({
        target: calCalendarios.id,
        set: {
          esClassroom: sql`true`,
          courseId: sql`excluded.course_id`,
          courseNombre: sql`excluded.course_nombre`,
          courseSeccion: sql`excluded.course_seccion`,
          courseEstado: sql`excluded.course_estado`,
          courseCreadoAt: sql`excluded.course_creado_at`,
          courseOwnerEmail: sql`excluded.course_owner_email`,
          courseVistoAt: sql`excluded.course_visto_at`,
          // El nombre bueno es el del calendario (lo pone el barrido); si no hay, el de la clase.
          nombre: sql`coalesce(${calCalendarios.nombre}, excluded.nombre)`,
          vistoAt: sql`excluded.visto_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  // Última página: lo que tenía clase y esta vez no ha salido es que la clase se borró.
  if (!siguiente) {
    await db
      .update(calCalendarios)
      .set({ courseEstado: CLASE_DESAPARECIDA, updatedAt: ahora })
      .where(and(sql`${calCalendarios.courseId} is not null`, lt(calCalendarios.courseVistoAt, inicio)));
  }
  return { siguiente, clases: clases.length, conCalendario: filas.length };
}

// ── Paso 2: barrido por usuarios ─────────────────────────────────────────────────

export async function pasoUsuarios(
  admin: string,
  cursor: string | null,
): Promise<{ siguiente: string | null; usuarios: number; saltados: number; errores: number; calendarios: number }> {
  const { usuarios, siguiente } = await paginaUsuarios(admin, cursor, 30);
  const activos = usuarios.filter((u) => !u.suspendido);
  const resultados = await enParalelo(activos, 6, async (u) => {
    try {
      return { email: u.email, lista: await calendariosDeUsuario(u.email) };
    } catch (e) {
      // Alumnado sin Calendar habilitado, cuentas recién creadas…: se cuenta y se sigue.
      console.error('Calendarios: no se lee la lista de un usuario:', explicarError(e));
      return { email: u.email, lista: null as EntradaLista[] | null };
    }
  });

  const ahora = new Date();
  const leidos = resultados.filter((r) => r.lista !== null);
  const porCalendario = new Map<string, EntradaLista>();
  const subs: { calendarId: string; email: string; rol: string; vistoAt: Date }[] = [];
  for (const r of leidos) {
    for (const e of r.lista!) {
      // El nombre y la descripción son los mismos para todos; se prefiere lo que ve el dueño.
      if (!porCalendario.has(e.id) || e.rol === 'owner') porCalendario.set(e.id, e);
      subs.push({ calendarId: e.id, email: r.email, rol: e.rol, vistoAt: ahora });
    }
  }

  if (porCalendario.size > 0) {
    await db
      .insert(calCalendarios)
      .values(
        [...porCalendario.values()].map((e) => ({
          id: e.id,
          nombre: e.nombre,
          descripcion: e.descripcion,
          esClassroom: pareceDeClassroom(e.id),
          vistoAt: ahora,
          updatedAt: ahora,
        })),
      )
      .onConflictDoUpdate({
        target: calCalendarios.id,
        set: {
          nombre: sql`coalesce(excluded.nombre, ${calCalendarios.nombre})`,
          descripcion: sql`coalesce(excluded.descripcion, ${calCalendarios.descripcion})`,
          esClassroom: sql`${calCalendarios.esClassroom} or excluded.es_classroom`,
          vistoAt: sql`excluded.visto_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  // Las suscripciones de quien se ha leído bien se rehacen enteras (foto, no diario).
  if (leidos.length > 0) {
    await db.delete(calSuscripciones).where(inArray(calSuscripciones.email, leidos.map((r) => r.email)));
    if (subs.length > 0) {
      for (let i = 0; i < subs.length; i += 500) {
        await db.insert(calSuscripciones).values(subs.slice(i, i + 500)).onConflictDoNothing();
      }
    }
  }
  return {
    siguiente,
    usuarios: activos.length,
    saltados: usuarios.length - activos.length,
    errores: resultados.length - leidos.length,
    calendarios: porCalendario.size,
  };
}

// ── Paso 3: eventos ────────────────────────────────────────────────────────────

async function lectoresDe(ids: string[]): Promise<Map<string, { owners: string[]; resto: string[] }>> {
  const filas =
    ids.length === 0
      ? []
      : await db
          .select({ calendarId: calSuscripciones.calendarId, email: calSuscripciones.email, rol: calSuscripciones.rol })
          .from(calSuscripciones)
          .where(inArray(calSuscripciones.calendarId, ids));
  const mapa = new Map<string, { owners: string[]; resto: string[] }>();
  for (const f of filas) {
    const m = mapa.get(f.calendarId) ?? { owners: [], resto: [] };
    (f.rol === 'owner' ? m.owners : m.resto).push(f.email);
    mapa.set(f.calendarId, m);
  }
  return mapa;
}

export async function pasoEventos(inicio: Date): Promise<{ hechos: number; quedan: number }> {
  const pendiente = and(
    isNull(calCalendarios.borradoAt),
    or(isNull(calCalendarios.eventosContadosAt), lt(calCalendarios.eventosContadosAt, inicio)),
  );
  const lote = await db
    .select({ id: calCalendarios.id, courseOwnerEmail: calCalendarios.courseOwnerEmail })
    .from(calCalendarios)
    .where(pendiente)
    .limit(12);
  const lectores = await lectoresDe(lote.map((c) => c.id));
  const ahora = new Date();

  await enParalelo(lote, 4, async (c) => {
    const l = lectores.get(c.id);
    // Primero los dueños; luego el profe de la clase; luego un par de suscriptores cualquiera.
    const candidatos = [...new Set([...(l?.owners ?? []), ...(c.courseOwnerEmail ? [c.courseOwnerEmail] : []), ...(l?.resto ?? []).slice(0, 2)])];
    let ultimoError = candidatos.length ? '' : 'Nadie del dominio lo tiene en su lista';
    for (const buzon of candidatos) {
      try {
        const r = await contarEventos(buzon, c.id, ahora);
        await db
          .update(calCalendarios)
          .set({
            eventos: r.total,
            eventosFuturos: r.futuros,
            primerEventoAt: r.primero,
            ultimoEventoAt: r.ultimo,
            eventosContadosAt: ahora,
            eventosError: null,
            updatedAt: ahora,
          })
          .where(eq(calCalendarios.id, c.id));
        return;
      } catch (e) {
        ultimoError = explicarError(e);
      }
    }
    // Se marca como contado igualmente (con su error) para que el paso avance.
    await db
      .update(calCalendarios)
      .set({ eventosContadosAt: ahora, eventosError: ultimoError, updatedAt: ahora })
      .where(eq(calCalendarios.id, c.id));
  });

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(calCalendarios).where(pendiente);
  return { hechos: lote.length, quedan: n };
}

// ── Lectura para la pantalla ────────────────────────────────────────────────────

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function listarCalendarios(hoy = new Date()): Promise<CalendarioFila[]> {
  const agregados = db
    .select({
      calendarId: calSuscripciones.calendarId,
      suscriptores: sql<number>`count(*)::int`.as('suscriptores'),
      propietarios: sql<string[]>`coalesce(array_agg(${calSuscripciones.email}) filter (where ${calSuscripciones.rol} = 'owner'), '{}')`.as(
        'propietarios',
      ),
    })
    .from(calSuscripciones)
    .groupBy(calSuscripciones.calendarId)
    .as('agg');

  const filas = await db
    .select({
      c: calCalendarios,
      suscriptores: agregados.suscriptores,
      propietarios: agregados.propietarios,
    })
    .from(calCalendarios)
    .leftJoin(agregados, eq(agregados.calendarId, calCalendarios.id));

  return filas.map(({ c, suscriptores, propietarios }) => {
    const clasePresente = c.courseId !== null && c.courseEstado !== CLASE_DESAPARECIDA;
    const datos = {
      esClassroom: c.esClassroom,
      courseId: c.courseId,
      courseNombre: c.courseNombre,
      nombre: c.nombre,
      courseCreadoAt: c.courseCreadoAt,
      clasePresente,
      primerEventoAt: c.primerEventoAt,
    };
    return {
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      esClassroom: c.esClassroom,
      courseId: c.courseId,
      courseNombre: c.courseNombre,
      courseSeccion: c.courseSeccion,
      courseEstado: c.courseEstado,
      courseCreadoAt: iso(c.courseCreadoAt),
      courseOwnerEmail: c.courseOwnerEmail,
      clasePresente,
      curso: cursoDeCalendario(datos),
      grupo: grupoDeCalendario(datos, hoy),
      eventos: c.eventos,
      eventosFuturos: c.eventosFuturos,
      primerEventoAt: iso(c.primerEventoAt),
      ultimoEventoAt: iso(c.ultimoEventoAt),
      eventosError: c.eventosError,
      suscriptores: suscriptores ?? 0,
      propietarios: propietarios ?? [],
      vistoAt: c.vistoAt.toISOString(),
      borradoAt: iso(c.borradoAt),
      borradoPor: c.borradoPor,
      borradoError: c.borradoError,
    };
  });
}

// ── Borrado ───────────────────────────────────────────────────────────────────

export interface ResultadoBorrar {
  id: string;
  ok: boolean;
  como: string | null;
  mensaje: string;
}

/**
 * Borra calendarios de verdad (esto NO se deshace). Para cada uno se prueba a suplantar a
 * sus propietarios vistos y, detrás, al profe dueño de la clase, hasta que uno pueda.
 *
 * El 404: Calendar lo da igual si el calendario ya no existe que si ese buzón no llega a
 * verlo. Solo se cree cuando lo dice un propietario que lo tenía en su lista (así que
 * antes sí lo veía); si lo dice el profe de la clase sin más, se deja como error.
 */
export async function borrarCalendarios(ids: string[], quien: string): Promise<ResultadoBorrar[]> {
  const filas = await db
    .select({ id: calCalendarios.id, courseOwnerEmail: calCalendarios.courseOwnerEmail, borradoAt: calCalendarios.borradoAt })
    .from(calCalendarios)
    .where(inArray(calCalendarios.id, ids));
  const lectores = await lectoresDe(filas.map((f) => f.id));

  return enParalelo(filas, 4, async (f): Promise<ResultadoBorrar> => {
    if (f.borradoAt) return { id: f.id, ok: true, como: null, mensaje: 'Ya estaba borrado' };
    const owners = lectores.get(f.id)?.owners ?? [];
    const candidatos = candidatosParaBorrar(owners, f.courseOwnerEmail);
    if (candidatos.length === 0) {
      return { id: f.id, ok: false, como: null, mensaje: 'No se sabe quién es su propietario: haz el barrido por usuarios' };
    }
    const errores: string[] = [];
    for (const buzon of candidatos) {
      const r = await borrarCalendario(buzon, f.id);
      const yaNoEsta = !r.ok && (r.status === 404 || r.status === 410) && owners.includes(buzon);
      if (r.ok || yaNoEsta) {
        const ahora = new Date();
        await db
          .update(calCalendarios)
          .set({ borradoAt: ahora, borradoPor: quien, borradoComo: buzon, borradoError: null, updatedAt: ahora })
          .where(eq(calCalendarios.id, f.id));
        return { id: f.id, ok: true, como: buzon, mensaje: yaNoEsta ? 'Ya no existía en Google' : 'Borrado' };
      }
      errores.push(`${buzon}: ${r.error}`);
    }
    const mensaje = errores.join(' · ').slice(0, 900);
    await db.update(calCalendarios).set({ borradoError: mensaje, updatedAt: new Date() }).where(eq(calCalendarios.id, f.id));
    return { id: f.id, ok: false, como: null, mensaje };
  });
}
