// Capa de servidor del Banco de libros: participantes (edu_students.banco_libros),
// lotes numerados por clase asignados por curso académico, y valoración POR LIBRO
// (digitaliza el Word "Registro de valoración de los libros").
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import {
  blAsignaciones,
  blLibroRegistros,
  blLibrosCurso,
  blLotes,
  eduStudents,
  licBooks,
  licCampaigns,
  licStudents,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { CURSOS_FORM } from '@/lib/licencias';
import { getBooksFromSheet } from '@/lib/google-sheets';

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

/**
 * Marca o desmarca a un alumno como participante del banco de libros.
 *
 * OJO, el dato vive en DOS sitios: la verdad es `edu_students.banco_libros` (BBDD
 * central), pero el formulario público de Licencias y su panel leen el **snapshot de
 * campaña** `lic_students.banco_libros` (ver `getCatalog` en `licencias-server.ts`, que
 * decide con ese flag qué libros ve la familia). Escribir solo en la central deja el
 * cambio invisible en Licencias hasta que alguien ejecute a mano el sync de alumnado —
 * que es exactamente el fallo que reportó David el 2026-09-02 (marcó a Isabel Porcar
 * como del banco y a Elena no, y en Licencias seguía al revés). Así que se propaga en
 * el mismo acto a la campaña vigente.
 */
export async function setBanco(eduStudentId: string, banco: boolean): Promise<void> {
  await db.update(eduStudents).set({ bancoLibros: banco, updatedAt: new Date() }).where(eq(eduStudents.id, eduStudentId));
  await propagarBancoACampania([eduStudentId], banco);
}

/**
 * Refleja el flag del banco en el snapshot de la campaña de Licencias vigente (la más
 * reciente, mismo criterio que `getLibrosBanco` y `getCurrentCampaign`). No hace nada si
 * no hay campaña o si el alumno no está en su alumnado: en ese caso el que falta es el
 * alumno en Licencias, y eso se arregla con el sync de alumnado, no desde aquí.
 */
async function propagarBancoACampania(eduStudentIds: string[], banco: boolean): Promise<void> {
  if (eduStudentIds.length === 0) return;
  const [campaign] = await db
    .select({ id: licCampaigns.id })
    .from(licCampaigns)
    .orderBy(desc(licCampaigns.createdAt))
    .limit(1);
  if (!campaign) return;
  await db
    .update(licStudents)
    .set({ bancoLibros: banco })
    .where(and(eq(licStudents.campaignId, campaign.id), inArray(licStudents.eduStudentId, eduStudentIds)));
}

export async function setAmpa(eduStudentIds: string[], ampa: boolean): Promise<void> {
  if (eduStudentIds.length === 0) return;
  await db.update(eduStudents).set({ ampa, updatedAt: new Date() }).where(inArray(eduStudents.id, eduStudentIds));
}

/**
 * Alumnos activos de un curso con Licencias que **no están en el alumnado de la campaña
 * vigente**. Pasa cada vez que se importa gente nueva desde Educamos: el alta entra en
 * `edu_students` pero el snapshot `lic_students` no se puebla hasta que alguien ejecuta el
 * sync de alumnado de Licencias, y hasta entonces la familia teclea su NIA en el
 * formulario público y le sale "no encontrado" (reportado el 2026-09-02: 13 alumnos así,
 * entre ellos el NIA 13620087). Solo es un aviso: el arreglo es darle al sync.
 */
export async function getAlumnosFueraDeCampania(): Promise<{ nombre: string; curso: string; letra: string | null }[]> {
  const cursosLicencias = CURSOS_FORM.map((c) => c.base);
  const [campaign] = await db
    .select({ id: licCampaigns.id })
    .from(licCampaigns)
    .orderBy(desc(licCampaigns.createdAt))
    .limit(1);
  if (!campaign) return [];
  const rows = await db
    .select({ nombre: eduStudents.nombre, apellido1: eduStudents.apellido1, apellido2: eduStudents.apellido2, curso: eduStudents.curso, letra: eduStudents.letra })
    .from(eduStudents)
    .where(
      and(
        eq(eduStudents.active, true),
        inArray(eduStudents.curso, cursosLicencias),
        sql`not exists (select 1 from ${licStudents} where ${licStudents.eduStudentId} = ${eduStudents.id} and ${licStudents.campaignId} = ${campaign.id})`,
      ),
    );
  return ordenLista(rows).map((r) => ({
    nombre: [r.apellido1, r.apellido2].filter(Boolean).join(' ') + (r.nombre ? `, ${r.nombre}` : ''),
    curso: r.curso!,
    letra: r.letra,
  }));
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

// ── Conector: Excel "BBDD Libros" → catálogo del banco (bl_libros_curso) ───────────────
// Mismo Excel/Sheet que ya alimenta lic_books (ver getBooksSyncPlan/syncBooksFromSheet en
// licencias-server.ts), y mismo patrón vista previa → aplicar. La diferencia es el destino
// y el alcance: aquí no hay campaña ni límite de cursos (BBDD Libros trae el colegio entero
// según se vaya rellenando, no solo 6ºEP-4ºESO como Licencias), y solo interesan las filas
// con Banco de Libros=Sí (lo demás no pinta nada en este módulo).
//
// OJO doble fuente: `getLibrosBanco()` (más abajo) ya enseña automáticamente, sin sincronizar
// nada, los libros que estén en `lic_books` de la campaña vigente (los trae el propio sync de
// Licencias, sin filtro de curso). Si este conector metiera esos mismos libros también en
// `bl_libros_curso`, cada uno saldría DOS veces en la pestaña Libros (una vez por catálogo,
// otra por "manual"), con dos códigos de valoración distintos para el mismo libro físico. Por
// eso se excluye del Excel cualquier (curso, cod) que ya esté activo en `lic_books` — este
// conector solo rellena los huecos que Licencias no cubre (hoy: cursos por debajo de 6ºEP; a
// futuro, cualquier curso nuevo que aparezca en el Excel antes de que Licencias lo sincronice).
//
// Cada fila importada queda enlazada por su `cod` (columna A del Excel); los libros
// tecleados a mano en el panel (sin `cod`) no los toca nunca esta sincronización, así que
// conviven sin pisarse. Se emparejan por (curso, cod) — igual que lic_books.
export interface FieldChange {
  field: string;
  before: string;
  after: string;
}
function diffFields(pairs: [string, string, string][]): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, before, after] of pairs) {
    if ((before ?? '') !== (after ?? '')) changes.push({ field, before: before || '—', after: after || '—' });
  }
  return changes;
}

export interface LibroCursoPlanItem {
  key: string;
  cod: string;
  curso: string;
  label: string;
  changes: FieldChange[];
}
export interface LibroCursoSyncPlan {
  toInsert: LibroCursoPlanItem[];
  toUpdate: LibroCursoPlanItem[];
  toDeactivate: { key: string; cod: string; curso: string; label: string }[];
  unchanged: number;
  /** Filas del Excel ignoradas porque `lic_books` (Licencias) ya las cubre automáticamente. */
  outOfScope: number;
}

function libroCursoLabel(r: { asignatura: string | null; nombre: string; curso: string }): string {
  return `${r.asignatura ? `${r.asignatura} · ` : ''}${r.nombre} (${r.curso})`;
}

/** Claves `curso::cod` que ya enseña `getLibrosBanco()` vía el catálogo vigente de Licencias. */
async function getClavesCubiertasPorLicencias(): Promise<Set<string>> {
  const [campaign] = await db.select({ id: licCampaigns.id }).from(licCampaigns).orderBy(desc(licCampaigns.createdAt)).limit(1);
  if (!campaign) return new Set();
  const rows = await db
    .select({ curso: licBooks.curso, cod: licBooks.cod })
    .from(licBooks)
    .where(and(eq(licBooks.campaignId, campaign.id), eq(licBooks.bancoLibros, true), eq(licBooks.active, true)));
  return new Set(rows.map((r) => `${r.curso}::${r.cod}`));
}

/** Filas del Excel que le tocan a este conector: Banco de Libros=Sí y no cubiertas ya por Licencias. */
async function getLibrosBancoFromSheet(): Promise<{ rows: Awaited<ReturnType<typeof getBooksFromSheet>>; outOfScope: number }> {
  const [sheetRows, cubiertas] = await Promise.all([getBooksFromSheet(), getClavesCubiertasPorLicencias()]);
  const deBanco = sheetRows.filter((r) => r.bancoLibros);
  const rows = deBanco.filter((r) => !cubiertas.has(`${r.curso}::${r.cod}`));
  return { rows, outOfScope: deBanco.length - rows.length };
}

/** Vista previa: qué cambiaría en bl_libros_curso si se sincroniza ahora. No escribe nada. */
export async function getLibrosCursoSyncPlan(): Promise<LibroCursoSyncPlan> {
  const [{ rows, outOfScope }, existing] = await Promise.all([
    getLibrosBancoFromSheet(),
    db.select().from(blLibrosCurso).where(isNotNull(blLibrosCurso.cod)),
  ]);
  const existingByKey = new Map(existing.map((b) => [`${b.curso}::${b.cod}`, b]));
  const sheetKeys = new Set(rows.map((r) => `${r.curso}::${r.cod}`));

  const toInsert: LibroCursoPlanItem[] = [];
  const toUpdate: LibroCursoPlanItem[] = [];
  let unchanged = 0;
  for (const r of rows) {
    const key = `${r.curso}::${r.cod}`;
    const dbRow = existingByKey.get(key);
    const nombre = r.nombreLibro || r.cod;
    const label = libroCursoLabel({ asignatura: r.asignatura || null, nombre, curso: r.curso });
    if (!dbRow) {
      toInsert.push({ key, cod: r.cod, curso: r.curso, label, changes: [] });
    } else {
      const changes = diffFields([
        ['Asignatura', dbRow.asignatura ?? '', r.asignatura],
        ['Nombre', dbRow.nombre, nombre],
        ['Activo', dbRow.activo ? 'Sí' : 'No', 'Sí'],
      ]);
      if (changes.length > 0) toUpdate.push({ key, cod: r.cod, curso: r.curso, label, changes });
      else unchanged++;
    }
  }
  // También se desactiva lo que ya estuviera importado aquí y ahora lo cubra Licencias
  // (deja de aparecer en `rows` en cuanto entra en `lic_books`): evita el duplicado.
  const toDeactivate = existing
    .filter((b) => b.activo && !sheetKeys.has(`${b.curso}::${b.cod}`))
    .map((b) => ({ key: `${b.curso}::${b.cod}`, cod: b.cod!, curso: b.curso, label: libroCursoLabel(b) }));

  return { toInsert, toUpdate, toDeactivate, unchanged, outOfScope };
}

/**
 * Importa/actualiza bl_libros_curso desde el Excel. Upsert por (curso, cod); lo que ya no
 * esté en el Excel, o haya pasado a estar cubierto por Licencias, se desactiva (nunca se
 * borra: puede tener valoraciones — `bl_libro_registros` — enganchadas por ese mismo cod).
 */
export async function syncLibrosCursoFromSheet(): Promise<{ upserted: number; deactivated: number; outOfScope: number }> {
  const { rows, outOfScope } = await getLibrosBancoFromSheet();

  const currentKeys = new Set(rows.map((r) => `${r.curso}::${r.cod}`));
  const existing = await db
    .select({ id: blLibrosCurso.id, curso: blLibrosCurso.curso, cod: blLibrosCurso.cod, activo: blLibrosCurso.activo })
    .from(blLibrosCurso)
    .where(isNotNull(blLibrosCurso.cod));
  const toDeactivate = existing.filter((b) => b.activo && !currentKeys.has(`${b.curso}::${b.cod}`)).map((b) => b.id);

  if (rows.length === 0 && toDeactivate.length === 0) return { upserted: 0, deactivated: 0, outOfScope };

  const statements: BatchItem<'pg'>[] = rows.map((r) => {
    const nombre = r.nombreLibro || r.cod;
    return db
      .insert(blLibrosCurso)
      .values({ curso: r.curso, cod: r.cod, asignatura: r.asignatura || null, nombre, activo: true })
      .onConflictDoUpdate({
        target: [blLibrosCurso.curso, blLibrosCurso.cod],
        set: { asignatura: r.asignatura || null, nombre, activo: true, updatedAt: new Date() },
      });
  });
  if (toDeactivate.length > 0) {
    statements.push(db.update(blLibrosCurso).set({ activo: false, updatedAt: new Date() }).where(inArray(blLibrosCurso.id, toDeactivate)));
  }
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

  return { upserted: rows.length, deactivated: toDeactivate.length, outOfScope };
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
