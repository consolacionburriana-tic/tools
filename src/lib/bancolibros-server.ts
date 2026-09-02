// Capa de servidor del Banco de libros: participantes (edu_students.banco_libros),
// lotes numerados por clase asignados por curso académico, y valoración POR LIBRO
// (digitaliza el Word "Registro de valoración de los libros").
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  blAsignaciones,
  blLibroRegistros,
  blLibrosCurso,
  blLotes,
  eduStudents,
  licBooks,
  licCampaigns,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';

export interface AlumnoBanco {
  eduStudentId: string;
  nombre: string;
  numeroLista: number; // orden alfabético apellido1 → apellido2 → nombre (PDC = clase aparte)
  banco: boolean;
  ampa: boolean;
  asignacionId: string | null;
  lote: number | null;
  entregado: boolean;
  docInicio: boolean;
  docFin: boolean;
}

/** Alumnado de una clase con su situación en el banco este curso académico. */
export async function getAlumnadoClase(curso: string, letra: string | null): Promise<AlumnoBanco[]> {
  const year = academicYearActual();
  const [alumnos, asignaciones] = await Promise.all([
    db
      .select()
      .from(eduStudents)
      .where(and(eq(eduStudents.active, true), eq(eduStudents.curso, curso), letra === null ? isNull(eduStudents.letra) : eq(eduStudents.letra, letra))),
    db
      .select({ a: blAsignaciones, numero: blLotes.numero })
      .from(blAsignaciones)
      .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
      .where(and(eq(blAsignaciones.academicYear, year), eq(blLotes.curso, curso), letra === null ? isNull(blLotes.letra) : eq(blLotes.letra, letra))),
  ]);
  const porStudent = new Map(asignaciones.map((x) => [x.a.studentId, x]));
  return ordenLista(alumnos).map((s, i) => {
    const asig = porStudent.get(s.id);
    return {
      eduStudentId: s.id,
      nombre: [s.apellido1, s.apellido2].filter(Boolean).join(' ') + (s.nombre ? `, ${s.nombre}` : ''),
      numeroLista: i + 1,
      banco: s.bancoLibros,
      ampa: s.ampa,
      asignacionId: asig?.a.id ?? null,
      lote: asig?.numero ?? null,
      entregado: asig?.a.entregado ?? false,
      docInicio: asig?.a.docInicio ?? false,
      docFin: asig?.a.docFin ?? false,
    };
  });
}

/** Orden de lista oficial: apellido1 → apellido2 → nombre (colación española). */
function ordenLista<T extends { apellido1: string | null; apellido2: string | null; nombre: string | null }>(alumnos: T[]): T[] {
  const cmp = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' });
  return [...alumnos].sort(
    (a, b) => cmp(a.apellido1, b.apellido1) || cmp(a.apellido2, b.apellido2) || cmp(a.nombre, b.nombre),
  );
}

export async function setBanco(eduStudentId: string, banco: boolean): Promise<void> {
  await db.update(eduStudents).set({ bancoLibros: banco, updatedAt: new Date() }).where(eq(eduStudents.id, eduStudentId));
}

export async function setAmpa(eduStudentIds: string[], ampa: boolean): Promise<void> {
  if (eduStudentIds.length === 0) return;
  await db.update(eduStudents).set({ ampa, updatedAt: new Date() }).where(inArray(eduStudents.id, eduStudentIds));
}

export interface ResumenClase {
  curso: string;
  letra: string | null;
  total: number;
  banco: number;
  ampa: number;
}

/** Nº de alumnos, en banco y en AMPA por clase — vista agregada (sumable por curso en el cliente). */
export async function getResumenClases(): Promise<ResumenClase[]> {
  const rows = await db
    .select({
      curso: eduStudents.curso,
      letra: eduStudents.letra,
      total: sql<number>`count(*)::int`,
      banco: sql<number>`count(*) filter (where ${eduStudents.bancoLibros})::int`,
      ampa: sql<number>`count(*) filter (where ${eduStudents.ampa})::int`,
    })
    .from(eduStudents)
    .where(eq(eduStudents.active, true))
    .groupBy(eduStudents.curso, eduStudents.letra);
  return rows.filter((r): r is ResumenClase => r.curso !== null);
}

/**
 * Asigna (o cambia) el nº de lote de un alumno este curso. numero=null quita la
 * asignación. numero='auto' usa el siguiente número libre de la clase.
 */
export async function asignarLote(input: {
  curso: string;
  letra: string | null;
  eduStudentId: string;
  numero: number | 'auto' | null;
}): Promise<{ numero: number | null }> {
  const year = academicYearActual();
  const { curso, letra, eduStudentId } = input;

  // Asignación previa del alumno en esta clase/año
  const previas = await db
    .select({ a: blAsignaciones, numero: blLotes.numero, loteId: blLotes.id })
    .from(blAsignaciones)
    .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
    .where(
      and(
        eq(blAsignaciones.academicYear, year),
        eq(blAsignaciones.studentId, eduStudentId),
        eq(blLotes.curso, curso),
        letra === null ? isNull(blLotes.letra) : eq(blLotes.letra, letra),
      ),
    );

  if (input.numero === null) {
    if (previas.length) await db.delete(blAsignaciones).where(inArray(blAsignaciones.id, previas.map((p) => p.a.id)));
    return { numero: null };
  }

  const lotesClase = await db
    .select()
    .from(blLotes)
    .where(and(eq(blLotes.curso, curso), letra === null ? isNull(blLotes.letra) : eq(blLotes.letra, letra)));
  const ocupados = await db
    .select({ loteId: blAsignaciones.loteId })
    .from(blAsignaciones)
    .where(and(eq(blAsignaciones.academicYear, year), inArray(blAsignaciones.loteId, lotesClase.map((l) => l.id).concat('00000000-0000-0000-0000-000000000000'))));
  const ocupadosSet = new Set(ocupados.map((o) => o.loteId));

  let numero: number;
  if (input.numero === 'auto') {
    const usados = new Set(lotesClase.filter((l) => ocupadosSet.has(l.id)).map((l) => l.numero));
    numero = 1;
    while (usados.has(numero)) numero++;
  } else {
    numero = input.numero;
  }

  // Lote destino (se crea si no existe)
  let lote = lotesClase.find((l) => l.numero === numero) ?? null;
  if (!lote) {
    [lote] = await db.insert(blLotes).values({ curso, letra, numero }).returning();
  } else if (ocupadosSet.has(lote.id) && !previas.some((p) => p.loteId === lote!.id)) {
    throw new Error(`El lote ${numero} ya está asignado a otro alumno este curso`);
  }

  if (previas.length) {
    await db.update(blAsignaciones).set({ loteId: lote.id, updatedAt: new Date() }).where(eq(blAsignaciones.id, previas[0].a.id));
    if (previas.length > 1) await db.delete(blAsignaciones).where(inArray(blAsignaciones.id, previas.slice(1).map((p) => p.a.id)));
  } else {
    await db.insert(blAsignaciones).values({ loteId: lote.id, academicYear: year, studentId: eduStudentId });
  }
  return { numero };
}

/** Marca entregado/doc en una o varias asignaciones (bulk por clase incluido). */
export async function setChecks(
  asignacionIds: string[],
  campos: Partial<{ entregado: boolean; docInicio: boolean; docFin: boolean }>,
): Promise<void> {
  if (asignacionIds.length === 0 || Object.keys(campos).length === 0) return;
  await db
    .update(blAsignaciones)
    .set({ ...campos, updatedAt: new Date() })
    .where(inArray(blAsignaciones.id, asignacionIds));
}

// ─── Libros y valoración ──────────────────────────────────────────────────────

export interface LibroBanco {
  cod: string;
  nombre: string;
  asignatura: string | null;
  /** Nº de alumnos de la clase con valoración de este libro / total con lote */
  valorados: number;
  total: number;
}

/** Prefijo del `bookCod` sintético de un libro manual, para no chocar nunca con un COD de lic_books. */
const PREFIJO_MANUAL = 'manual:';

/**
 * Libros del banco para un curso: el catálogo de Licencias (campaña más reciente,
 * `banco_libros=true`) más los que se hayan configurado a mano en este módulo (mientras el
 * catálogo no esté listo, o para asignaturas con varios libros). Los manuales usan un
 * `bookCod` sintético `manual:<id>`, así que la valoración/pasar-lista funciona igual para
 * ambos sin tocar `lic_books`.
 */
export async function getLibrosBanco(curso: string, letra: string | null): Promise<LibroBanco[]> {
  const year = academicYearActual();
  const [campaign] = await db.select().from(licCampaigns).orderBy(desc(licCampaigns.createdAt)).limit(1);
  const [librosCatalogo, librosManuales, asignaciones] = await Promise.all([
    campaign
      ? db
          .select()
          .from(licBooks)
          .where(and(eq(licBooks.campaignId, campaign.id), eq(licBooks.curso, curso), eq(licBooks.bancoLibros, true), eq(licBooks.active, true)))
          .orderBy(asc(licBooks.asignatura), asc(licBooks.cod))
      : Promise.resolve([]),
    db
      .select()
      .from(blLibrosCurso)
      .where(and(eq(blLibrosCurso.curso, curso), eq(blLibrosCurso.activo, true)))
      .orderBy(asc(blLibrosCurso.orden), asc(blLibrosCurso.asignatura)),
    db
      .select({ id: blAsignaciones.id })
      .from(blAsignaciones)
      .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
      .where(and(eq(blAsignaciones.academicYear, year), eq(blLotes.curso, curso), letra === null ? isNull(blLotes.letra) : eq(blLotes.letra, letra))),
  ]);
  const asigIds = asignaciones.map((a) => a.id);
  const registros = asigIds.length
    ? await db.select().from(blLibroRegistros).where(inArray(blLibroRegistros.asignacionId, asigIds))
    : [];
  const valorados = (cod: string) => registros.filter((r) => r.bookCod === cod && r.estado !== null).length;
  return [
    ...librosCatalogo.map((b) => ({
      cod: b.cod,
      nombre: b.nombreLibro ?? b.cod,
      asignatura: b.asignatura,
      valorados: valorados(b.cod),
      total: asigIds.length,
    })),
    ...librosManuales.map((b) => ({
      cod: `${PREFIJO_MANUAL}${b.id}`,
      nombre: b.nombre,
      asignatura: b.asignatura,
      valorados: valorados(`${PREFIJO_MANUAL}${b.id}`),
      total: asigIds.length,
    })),
  ];
}

/** Libros manuales de un curso, incluidos los desactivados (para poder reactivarlos). */
export async function getLibrosManualesCurso(curso: string): Promise<
  { id: string; curso: string; asignatura: string | null; nombre: string; orden: number; activo: boolean }[]
> {
  return db
    .select()
    .from(blLibrosCurso)
    .where(eq(blLibrosCurso.curso, curso))
    .orderBy(asc(blLibrosCurso.orden), asc(blLibrosCurso.asignatura));
}

export async function crearLibroManual(input: { curso: string; asignatura: string | null; nombre: string }): Promise<void> {
  const [{ maxOrden }] = await db
    .select({ maxOrden: sql<number>`coalesce(max(${blLibrosCurso.orden}), 0)::int` })
    .from(blLibrosCurso)
    .where(eq(blLibrosCurso.curso, input.curso));
  await db.insert(blLibrosCurso).values({ ...input, orden: maxOrden + 1 });
}

export async function actualizarLibroManual(
  id: string,
  campos: Partial<{ asignatura: string | null; nombre: string; activo: boolean }>,
): Promise<void> {
  await db.update(blLibrosCurso).set({ ...campos, updatedAt: new Date() }).where(eq(blLibrosCurso.id, id));
}

export interface FilaPasarLista {
  asignacionId: string;
  numeroLista: number;
  lote: number;
  alumno: string;
  estado: string | null;
  borrado: boolean;
  forrado: boolean;
  notas: string | null;
}

/** Filas del "pasar lista" de un libro en una clase (el Word, digitalizado). */
export async function getPasarLista(curso: string, letra: string | null, bookCod: string): Promise<FilaPasarLista[]> {
  const year = academicYearActual();
  const filas = await db
    .select({ a: blAsignaciones, numero: blLotes.numero, s: eduStudents })
    .from(blAsignaciones)
    .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
    .innerJoin(eduStudents, eq(blAsignaciones.studentId, eduStudents.id))
    .where(and(eq(blAsignaciones.academicYear, year), eq(blLotes.curso, curso), letra === null ? isNull(blLotes.letra) : eq(blLotes.letra, letra)));
  const registros = filas.length
    ? await db
        .select()
        .from(blLibroRegistros)
        .where(and(inArray(blLibroRegistros.asignacionId, filas.map((f) => f.a.id)), eq(blLibroRegistros.bookCod, bookCod)))
    : [];
  const porAsig = new Map(registros.map((r) => [r.asignacionId, r]));
  // Nº de lista sobre TODA la clase (aunque solo listemos a quien tiene lote)
  const clase = await db
    .select({ id: eduStudents.id, apellido1: eduStudents.apellido1, apellido2: eduStudents.apellido2, nombre: eduStudents.nombre })
    .from(eduStudents)
    .where(and(eq(eduStudents.active, true), eq(eduStudents.curso, curso), letra === null ? isNull(eduStudents.letra) : eq(eduStudents.letra, letra)));
  const numeroDe = new Map(ordenLista(clase).map((s, i) => [s.id, i + 1]));
  return filas
    .map((f) => {
      const r = porAsig.get(f.a.id);
      return {
        asignacionId: f.a.id,
        numeroLista: numeroDe.get(f.s.id) ?? 0,
        lote: f.numero,
        alumno: [f.s.apellido1, f.s.apellido2].filter(Boolean).join(' ') + (f.s.nombre ? `, ${f.s.nombre}` : ''),
        estado: r?.estado ?? null,
        borrado: r?.borrado ?? true,
        forrado: r?.forrado ?? true,
        notas: r?.notas ?? null,
      };
    })
    .sort((a, b) => a.numeroLista - b.numeroLista);
}

export async function upsertRegistro(input: {
  asignacionId: string;
  bookCod: string;
  campos: Partial<{ estado: string | null; borrado: boolean; forrado: boolean; notas: string | null }>;
  revisorEmail: string;
}): Promise<void> {
  await db
    .insert(blLibroRegistros)
    .values({
      asignacionId: input.asignacionId,
      bookCod: input.bookCod,
      ...input.campos,
      revisadoPorEmail: input.revisorEmail,
      revisadoAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [blLibroRegistros.asignacionId, blLibroRegistros.bookCod],
      set: { ...input.campos, revisadoPorEmail: input.revisorEmail, revisadoAt: new Date() },
    });
}

/**
 * Igual que upsertRegistro pero para varias asignaciones a la vez (bulk "todos MB" de un
 * curso): un único insert multi-fila en vez de N rondas secuenciales al driver HTTP de Neon.
 */
export async function upsertRegistros(input: {
  asignacionIds: string[];
  bookCod: string;
  campos: Partial<{ estado: string | null; borrado: boolean; forrado: boolean; notas: string | null }>;
  revisorEmail: string;
}): Promise<void> {
  const revisadoAt = new Date();
  await db
    .insert(blLibroRegistros)
    .values(
      input.asignacionIds.map((asignacionId) => ({
        asignacionId,
        bookCod: input.bookCod,
        ...input.campos,
        revisadoPorEmail: input.revisorEmail,
        revisadoAt,
      })),
    )
    .onConflictDoUpdate({
      target: [blLibroRegistros.asignacionId, blLibroRegistros.bookCod],
      set: { ...input.campos, revisadoPorEmail: input.revisorEmail, revisadoAt },
    });
}
