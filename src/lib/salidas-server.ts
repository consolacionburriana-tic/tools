// Capa de servidor de Salidas y pagos: salidas, responsables, inscripciones y
// justificantes. Lee alumnado de la BBDD central (edu_students), nunca lista propia.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  eduStudents,
  eduTeachers,
  salSignups,
  salTripManagers,
  salTrips,
  type EduTeacher,
  type SalSignup,
  type SalTrip,
} from '@/db/schema';
import type { SessionUser } from '@/lib/auth-guards';

export interface Clase {
  curso: string;
  letra: string | null;
}

export function claseLabel(c: Clase): string {
  return c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso;
}

function claseKey(curso: string | null, letra: string | null): string {
  return `${curso ?? ''}|${letra ?? ''}`;
}

function tripIncluye(trip: SalTrip, curso: string | null, letra: string | null): boolean {
  return (trip.clases ?? []).some((c) => claseKey(c.curso, c.letra) === claseKey(curso, letra));
}

/** Clases reales disponibles (curso+letra distintos del alumnado activo). */
export async function getClasesDisponibles(): Promise<Clase[]> {
  const rows = await db
    .selectDistinct({ curso: eduStudents.curso, letra: eduStudents.letra })
    .from(eduStudents)
    .where(eq(eduStudents.active, true))
    .orderBy(asc(eduStudents.curso), asc(eduStudents.letra));
  return rows.filter((r): r is Clase => r.curso !== null);
}

// ─── Salidas ──────────────────────────────────────────────────────────────────

export interface TripConStats extends SalTrip {
  responsables: { id: string; nombre: string }[];
  stats: TripStats;
}

export interface TripStats {
  objetivo: number; // alumnado de las clases de la salida
  noVan: number;
  entregados: number; // justificante subido o validado
  validados: number;
  pendientes: number; // objetivo - noVan - entregados
  manuales: number; // entradas manuales (familia no encontrada): revisar y enlazar
}

async function statsDe(trip: SalTrip, signups: SalSignup[]): Promise<TripStats> {
  const alumnado = await db
    .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
    .from(eduStudents)
    .where(eq(eduStudents.active, true));
  const objetivo = alumnado.filter((a) => tripIncluye(trip, a.curso, a.letra)).length;
  const conAlumno = signups.filter((s) => s.studentId !== null);
  const manuales = signups.length - conAlumno.length;
  const noVan = conAlumno.filter((s) => s.estado === 'no_va').length;
  const entregados = conAlumno.filter((s) => s.estado !== 'no_va' && s.justificanteEstado !== null && s.justificanteEstado !== 'rechazado').length;
  const validados = signups.filter((s) => s.justificanteEstado === 'validado').length;
  return { objetivo, noVan, entregados, validados, pendientes: Math.max(0, objetivo - noVan - entregados), manuales };
}

export async function getTripStats(tripId: string): Promise<TripStats | null> {
  const [trip] = await db.select().from(salTrips).where(eq(salTrips.id, tripId)).limit(1);
  if (!trip) return null;
  const signups = await db.select().from(salSignups).where(eq(salSignups.tripId, tripId));
  return statsDe(trip, signups);
}

/** Salidas visibles según rol: profe/tutor solo las suyas (creadas o de las que son responsables). */
export async function getTripsForUser(user: SessionUser): Promise<TripConStats[]> {
  const [trips, managers, profes] = await Promise.all([
    db.select().from(salTrips).orderBy(desc(salTrips.fecha), desc(salTrips.createdAt)),
    db.select().from(salTripManagers),
    db.select().from(eduTeachers),
  ]);
  const profePorId = new Map(profes.map((p) => [p.id, p]));
  const miTeacher = profes.find((p) => p.email === user.email) ?? null;

  const soloMias = user.role === 'profe' || user.role === 'tutor';
  const visibles = trips.filter((t) => {
    if (!soloMias) return true;
    if (t.createdByEmail === user.email) return true;
    return managers.some((m) => m.tripId === t.id && miTeacher && m.eduTeacherId === miTeacher.id);
  });

  const signupsAll = visibles.length
    ? await db.select().from(salSignups).where(inArray(salSignups.tripId, visibles.map((t) => t.id)))
    : [];

  return Promise.all(
    visibles.map(async (t) => ({
      ...t,
      responsables: managers
        .filter((m) => m.tripId === t.id)
        .map((m) => profePorId.get(m.eduTeacherId))
        .filter((p): p is EduTeacher => !!p)
        .map((p) => ({ id: p.id, nombre: [p.nombre, p.apellido1].filter(Boolean).join(' ') })),
      stats: await statsDe(t, signupsAll.filter((s) => s.tripId === t.id)),
    })),
  );
}

export async function createTrip(input: {
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  importe: string | null;
  clases: Clase[];
  responsables: string[]; // edu_teacher ids
  user: SessionUser;
}): Promise<SalTrip> {
  const [profe] = await db.select().from(eduTeachers).where(eq(eduTeachers.email, input.user.email)).limit(1);
  const [trip] = await db
    .insert(salTrips)
    .values({
      nombre: input.nombre,
      descripcion: input.descripcion,
      fecha: input.fecha,
      importe: input.importe,
      clases: input.clases,
      createdByEmail: input.user.email,
      createdByTeacherId: profe?.id ?? null,
    })
    .returning();
  if (input.responsables.length) {
    await db.insert(salTripManagers).values(input.responsables.map((id) => ({ tripId: trip.id, eduTeacherId: id })));
  }
  return trip;
}

export async function updateTrip(
  tripId: string,
  cambios: Partial<Pick<SalTrip, 'nombre' | 'descripcion' | 'fecha' | 'importe' | 'clases' | 'estado'>>,
  responsables?: string[],
): Promise<void> {
  await db.update(salTrips).set({ ...cambios, updatedAt: new Date() }).where(eq(salTrips.id, tripId));
  if (responsables) {
    await db.delete(salTripManagers).where(eq(salTripManagers.tripId, tripId));
    if (responsables.length) {
      await db.insert(salTripManagers).values(responsables.map((id) => ({ tripId, eduTeacherId: id })));
    }
  }
}

// ─── Detalle: listas de seguimiento ───────────────────────────────────────────

export interface SeguimientoAlumno {
  eduStudentId: string | null; // null = entrada manual (¡enlazar!)
  nombre: string; // completo — zona de gestión
  clase: string;
  signupId: string | null;
  estado: 'pendiente' | 'apuntado' | 'no_va';
  justificanteEstado: string | null;
  justificanteSubidoAt: Date | null;
  emailContacto: string | null;
  manual: boolean;
  manualIdentificador: string | null;
}

export async function getTripSeguimiento(tripId: string): Promise<{ trip: SalTrip; responsables: EduTeacher[]; alumnos: SeguimientoAlumno[] } | null> {
  const [trip] = await db.select().from(salTrips).where(eq(salTrips.id, tripId)).limit(1);
  if (!trip) return null;
  const [signups, alumnado, managers] = await Promise.all([
    db.select().from(salSignups).where(eq(salSignups.tripId, tripId)),
    db.select().from(eduStudents).where(eq(eduStudents.active, true)),
    db
      .select({ t: eduTeachers })
      .from(salTripManagers)
      .innerJoin(eduTeachers, eq(salTripManagers.eduTeacherId, eduTeachers.id))
      .where(eq(salTripManagers.tripId, tripId)),
  ]);
  const porStudent = new Map(signups.filter((s) => s.studentId).map((s) => [s.studentId!, s]));
  const alumnos: SeguimientoAlumno[] = alumnado
    .filter((a) => tripIncluye(trip, a.curso, a.letra))
    .map((a) => {
      const s = porStudent.get(a.id) ?? null;
      return {
        eduStudentId: a.id,
        nombre: [a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' '),
        clase: claseLabel({ curso: a.curso!, letra: a.letra }),
        signupId: s?.id ?? null,
        estado: (s?.estado ?? 'pendiente') as SeguimientoAlumno['estado'],
        justificanteEstado: s?.justificanteEstado ?? null,
        justificanteSubidoAt: s?.justificanteSubidoAt ?? null,
        emailContacto: s?.emailContacto ?? null,
        manual: false,
        manualIdentificador: null,
      };
    })
    .sort((a, b) => a.clase.localeCompare(b.clase) || a.nombre.localeCompare(b.nombre));
  // Entradas manuales al principio: son las que hay que revisar y enlazar
  const manuales: SeguimientoAlumno[] = signups
    .filter((s) => s.studentId === null)
    .map((s) => ({
      eduStudentId: null,
      nombre: s.manualNombre ?? '(sin nombre)',
      clase: s.manualClase ?? '¿?',
      signupId: s.id,
      estado: (s.estado ?? 'apuntado') as SeguimientoAlumno['estado'],
      justificanteEstado: s.justificanteEstado ?? null,
      justificanteSubidoAt: s.justificanteSubidoAt ?? null,
      emailContacto: s.emailContacto ?? null,
      manual: true,
      manualIdentificador: s.manualIdentificador,
    }));
  return { trip, responsables: managers.map((m) => m.t), alumnos: [...manuales, ...alumnos] };
}

// ─── Flujo público (familias) ─────────────────────────────────────────────────

export interface TripFamilia {
  tripId: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  importe: string | null;
  estado: 'pendiente' | 'no_va' | 'subido' | 'validado' | 'rechazado';
}

/** Salidas abiertas de la clase del alumno + estado de su justificante. */
export async function getActiveTripsForStudent(eduStudentId: string): Promise<TripFamilia[]> {
  const [alumno] = await db.select().from(eduStudents).where(eq(eduStudents.id, eduStudentId)).limit(1);
  if (!alumno) return [];
  const abiertas = (await db.select().from(salTrips).where(eq(salTrips.estado, 'abierta'))).filter((t) =>
    tripIncluye(t, alumno.curso, alumno.letra),
  );
  if (abiertas.length === 0) return [];
  const signups = await db
    .select()
    .from(salSignups)
    .where(and(eq(salSignups.studentId, eduStudentId), inArray(salSignups.tripId, abiertas.map((t) => t.id))));
  const porTrip = new Map(signups.map((s) => [s.tripId, s]));
  return abiertas
    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
    .map((t) => {
      const s = porTrip.get(t.id);
      const estado: TripFamilia['estado'] =
        s?.estado === 'no_va' ? 'no_va' : (s?.justificanteEstado as TripFamilia['estado']) ?? 'pendiente';
      return { tripId: t.id, nombre: t.nombre, descripcion: t.descripcion, fecha: t.fecha, importe: t.importe, estado };
    });
}

/** Registra el justificante subido (upsert de la inscripción). */
export async function registrarJustificante(input: {
  tripId: string;
  eduStudentId: string;
  pathname: string;
  emailContacto: string | null;
}): Promise<SalSignup> {
  const [row] = await db
    .insert(salSignups)
    .values({
      tripId: input.tripId,
      studentId: input.eduStudentId,
      estado: 'apuntado',
      justificanteUrl: input.pathname,
      justificanteEstado: 'subido',
      justificanteSubidoAt: new Date(),
      emailContacto: input.emailContacto,
    })
    .onConflictDoUpdate({
      target: [salSignups.tripId, salSignups.studentId],
      set: {
        estado: 'apuntado',
        justificanteUrl: input.pathname,
        justificanteEstado: 'subido',
        justificanteSubidoAt: new Date(),
        ...(input.emailContacto ? { emailContacto: input.emailContacto } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/** Entrada MANUAL: la familia no se encontró con DNI/NIA y tecleó clase + nombre. */
export async function registrarJustificanteManual(input: {
  tripId: string;
  nombre: string;
  clase: string;
  identificador: string | null; // lo que tecleó y no casó
  pathname: string;
  emailContacto: string | null;
}): Promise<SalSignup> {
  const [row] = await db
    .insert(salSignups)
    .values({
      tripId: input.tripId,
      studentId: null,
      manualNombre: input.nombre,
      manualClase: input.clase,
      manualIdentificador: input.identificador,
      estado: 'apuntado',
      justificanteUrl: input.pathname,
      justificanteEstado: 'subido',
      justificanteSubidoAt: new Date(),
      emailContacto: input.emailContacto,
    })
    .returning();
  return row;
}

/** Clases (curso+letra) que tienen alguna salida abierta — para el flujo manual. */
export async function getClasesConSalidasAbiertas(): Promise<Clase[]> {
  const abiertas = await db.select().from(salTrips).where(eq(salTrips.estado, 'abierta'));
  const mapa = new Map<string, Clase>();
  for (const t of abiertas) {
    for (const c of t.clases ?? []) mapa.set(claseKey(c.curso, c.letra), c);
  }
  return [...mapa.values()].sort((a, b) => claseLabel(a).localeCompare(claseLabel(b)));
}

/** Salidas abiertas de una clase concreta (flujo manual, sin alumno enlazado). */
export async function getTripsAbiertasDeClase(clase: Clase): Promise<SalTrip[]> {
  const abiertas = await db.select().from(salTrips).where(eq(salTrips.estado, 'abierta'));
  return abiertas
    .filter((t) => tripIncluye(t, clase.curso, clase.letra))
    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
}

export async function marcarNoVa(tripId: string, eduStudentId: string): Promise<void> {
  await db
    .insert(salSignups)
    .values({ tripId, studentId: eduStudentId, estado: 'no_va' })
    .onConflictDoUpdate({
      target: [salSignups.tripId, salSignups.studentId],
      set: { estado: 'no_va', updatedAt: new Date() },
    });
}

export async function getResponsablesEmails(tripId: string): Promise<string[]> {
  const rows = await db
    .select({ email: eduTeachers.email })
    .from(salTripManagers)
    .innerJoin(eduTeachers, eq(salTripManagers.eduTeacherId, eduTeachers.id))
    .where(eq(salTripManagers.tripId, tripId));
  return rows.map((r) => r.email).filter((e): e is string => !!e);
}
