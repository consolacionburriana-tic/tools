// Capa de servidor del Banco de libros: participantes (edu_students.banco_libros),
// lotes numerados por clase asignados por curso académico, y valoración POR LIBRO
// (digitaliza el Word "Registro de valoración de los libros").
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  blAsignaciones,
  blLibroRegistros,
  blLotes,
  eduStudents,
  licBooks,
  licCampaigns,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';

export interface AlumnoBanco {
  eduStudentId: string;
  nombre: string;
  banco: boolean;
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
      .where(and(eq(eduStudents.active, true), eq(eduStudents.curso, curso), letra === null ? isNull(eduStudents.letra) : eq(eduStudents.letra, letra)))
      .orderBy(asc(eduStudents.apellido1), asc(eduStudents.apellido2)),
    db
      .select({ a: blAsignaciones, numero: blLotes.numero })
      .from(blAsignaciones)
      .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
      .where(and(eq(blAsignaciones.academicYear, year), eq(blLotes.curso, curso), letra === null ? isNull(blLotes.letra) : eq(blLotes.letra, letra))),
  ]);
  const porStudent = new Map(asignaciones.map((x) => [x.a.studentId, x]));
  return alumnos.map((s) => {
    const asig = porStudent.get(s.id);
    return {
      eduStudentId: s.id,
      nombre: [s.apellido1, s.apellido2].filter(Boolean).join(' ') + (s.nombre ? `, ${s.nombre}` : ''),
      banco: s.bancoLibros,
      asignacionId: asig?.a.id ?? null,
      lote: asig?.numero ?? null,
      entregado: asig?.a.entregado ?? false,
      docInicio: asig?.a.docInicio ?? false,
      docFin: asig?.a.docFin ?? false,
    };
  });
}

export async function setBanco(eduStudentId: string, banco: boolean): Promise<void> {
  await db.update(eduStudents).set({ bancoLibros: banco, updatedAt: new Date() }).where(eq(eduStudents.id, eduStudentId));
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

/** Libros del banco para un curso (catálogo de Licencias, campaña más reciente). */
export async function getLibrosBanco(curso: string, letra: string | null): Promise<LibroBanco[]> {
  const year = academicYearActual();
  const [campaign] = await db.select().from(licCampaigns).orderBy(desc(licCampaigns.createdAt)).limit(1);
  if (!campaign) return [];
  const [libros, asignaciones] = await Promise.all([
    db
      .select()
      .from(licBooks)
      .where(and(eq(licBooks.campaignId, campaign.id), eq(licBooks.curso, curso), eq(licBooks.bancoLibros, true), eq(licBooks.active, true)))
      .orderBy(asc(licBooks.asignatura), asc(licBooks.cod)),
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
  return libros.map((b) => ({
    cod: b.cod,
    nombre: b.nombreLibro ?? b.cod,
    asignatura: b.asignatura,
    valorados: registros.filter((r) => r.bookCod === b.cod && r.estado !== null).length,
    total: asigIds.length,
  }));
}

export interface FilaPasarLista {
  asignacionId: string;
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
  return filas
    .map((f) => {
      const r = porAsig.get(f.a.id);
      return {
        asignacionId: f.a.id,
        lote: f.numero,
        alumno: [f.s.apellido1, f.s.apellido2].filter(Boolean).join(' ') + (f.s.nombre ? `, ${f.s.nombre}` : ''),
        estado: r?.estado ?? null,
        borrado: r?.borrado ?? true,
        forrado: r?.forrado ?? true,
        notas: r?.notas ?? null,
      };
    })
    .sort((a, b) => a.lote - b.lote);
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
