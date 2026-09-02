// Capa de servidor del módulo Puntualidad: queries Drizzle y las dos reglas de negocio
// del módulo (el cálculo del retraso y el ciclo de tres que dispara la consecuencia).
//
// El alumnado sale SIEMPRE de la BBDD central (`edu_students`), filtrado a secundaria
// (ESO y PDC). El módulo no mantiene ningún listado propio de alumnos: solo registros.
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  conConsequenceRecords,
  conConsequenceTypes,
  conConsequences,
  eduStudents,
  eduTeachers,
  eduTutorias,
  punDigestRuns,
  punRecords,
  punSubjects,
  type ConConsequence,
  type PunSubject,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { nombreClase } from '@/lib/cursos';
import { vePuntualidadCompleta, type Role } from '@/lib/permissions';
import {
  HORA_LIMITE,
  cursoEnPuntualidad,
  indiceDiaSemana,
  minutosRetraso,
  resumenHistorial,
  type ResumenHistorial,
} from '@/lib/puntualidad';

export const TIPO_CONSECUENCIA_DEFECTO = 'sin_patio';

/** Nombre completo tal y como se pinta en el módulo (panel interno del claustro). */
export function nombreAlumno(a: {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
}): string {
  return [a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' ');
}

// ─── Asignaturas ──────────────────────────────────────────────────────────────

// Relleno de ejemplo de secundaria: se siembra la primera vez que se abre el panel para
// que el formulario no salga vacío. David las ajusta desde /gestion/puntualidad/asignaturas.
const ASIGNATURAS_EJEMPLO = [
  'Castellano',
  'Valenciano',
  'Inglés',
  'Matemáticas',
  'Geografía e Historia',
  'Biología y Geología',
  'Física y Química',
  'Tecnología',
  'Educación Física',
  'Música',
  'Plástica',
  'Religión',
  'Tutoría',
];

export async function getSubjects(soloActivas = false): Promise<PunSubject[]> {
  const rows = await db
    .select()
    .from(punSubjects)
    .where(soloActivas ? eq(punSubjects.active, true) : undefined)
    .orderBy(asc(punSubjects.orden), asc(punSubjects.nombre));
  return rows;
}

/** Siembra las asignaturas de ejemplo si la tabla está vacía (idempotente). */
export async function ensureSubjects(): Promise<PunSubject[]> {
  const existentes = await getSubjects();
  if (existentes.length > 0) return existentes;
  await db
    .insert(punSubjects)
    .values(ASIGNATURAS_EJEMPLO.map((nombre, i) => ({ nombre, orden: i * 10 })))
    .onConflictDoNothing();
  return getSubjects();
}

export async function crearSubject(datos: { nombre: string; abreviatura?: string | null; eduTeacherId?: string | null }) {
  const [maxOrden] = await db.select({ max: sql<number>`coalesce(max(${punSubjects.orden}), 0)` }).from(punSubjects);
  const [creada] = await db
    .insert(punSubjects)
    .values({
      nombre: datos.nombre.trim(),
      abreviatura: datos.abreviatura?.trim() || null,
      eduTeacherId: datos.eduTeacherId ?? null,
      orden: (maxOrden?.max ?? 0) + 10,
    })
    .returning();
  return creada;
}

export async function updateSubject(
  id: string,
  cambios: { nombre?: string; abreviatura?: string | null; eduTeacherId?: string | null; active?: boolean; orden?: number },
) {
  await db
    .update(punSubjects)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(punSubjects.id, id));
}

/** Tipos de consecuencia disponibles (catálogo abierto; se siembra 'sin_patio'). */
export async function ensureTiposConsecuencia() {
  const rows = await db.select().from(conConsequenceTypes).orderBy(asc(conConsequenceTypes.orden));
  if (rows.length > 0) return rows;
  await db
    .insert(conConsequenceTypes)
    .values([{ clave: TIPO_CONSECUENCIA_DEFECTO, nombre: 'Se queda sin patio', orden: 0 }])
    .onConflictDoNothing();
  return db.select().from(conConsequenceTypes).orderBy(asc(conConsequenceTypes.orden));
}

// ─── Alumnado ─────────────────────────────────────────────────────────────────

export interface AlumnoBusqueda {
  eduStudentId: string;
  nombre: string;
  clase: string;
  curso: string | null;
  letra: string | null;
  nia: string | null;
}

const CURSOS_MODULO = sql`(${eduStudents.curso} ILIKE '%ESO%' OR ${eduStudents.curso} ILIKE '%PDC%')`;

/**
 * Buscador del formulario: nombre y/o apellido, desde 2 caracteres. Devuelve nombre
 * completo + clase porque el profe tiene que distinguir a los dos Robertos de dos clases
 * distintas de un vistazo (decisión de David: en este módulo se ven nombres completos).
 */
export async function buscarAlumnos(query: string, limite = 25): Promise<AlumnoBusqueda[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const palabras = q.split(/\s+/).filter(Boolean).slice(0, 3);

  // Cada palabra tiene que aparecer en alguno de los campos del nombre: así "rober her"
  // encuentra a Roberto Herrero sin tener que teclear el nombre entero ni en orden.
  const condiciones = palabras.map((p) =>
    or(
      ilike(eduStudents.nombre, `%${p}%`),
      ilike(eduStudents.apellido1, `%${p}%`),
      ilike(eduStudents.apellido2, `%${p}%`),
      ilike(eduStudents.nia, `%${p}%`),
    ),
  );

  const rows = await db
    .select()
    .from(eduStudents)
    .where(and(eq(eduStudents.active, true), CURSOS_MODULO, ...condiciones))
    .limit(limite * 2);

  return rows
    .filter((a) => cursoEnPuntualidad(a.curso))
    .map((a) => ({
      eduStudentId: a.id,
      nombre: nombreAlumno(a),
      clase: nombreClase(a.curso, a.letra),
      curso: a.curso,
      letra: a.letra,
      nia: a.nia,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite);
}

export async function getAlumno(eduStudentId: string) {
  const [row] = await db.select().from(eduStudents).where(eq(eduStudents.id, eduStudentId)).limit(1);
  return row ?? null;
}

// ─── Historial de un alumno ───────────────────────────────────────────────────

export interface RetrasoFila {
  id: string;
  fecha: string;
  hora: string;
  minutosRetraso: number;
  justificado: boolean;
  justificacionTipo: string | null;
  justificacionNota: string | null;
  subeAClase: boolean;
  observaciones: string | null;
  asignatura: string | null;
  clase: string;
  profe: string | null;
  registradoPorEmail: string | null;
  /** Ya vinculado a una consecuencia: no cuenta para el ciclo en curso. */
  consumido: boolean;
}

async function filasDeRetrasos(where: SQL | undefined): Promise<RetrasoFila[]> {
  const rows = await db
    .select({
      r: punRecords,
      asignatura: punSubjects.nombre,
      profeNombre: eduTeachers.nombre,
      profeApellido: eduTeachers.apellido1,
      consequenceId: conConsequenceRecords.consequenceId,
    })
    .from(punRecords)
    .leftJoin(punSubjects, eq(punRecords.subjectId, punSubjects.id))
    .leftJoin(eduTeachers, eq(punRecords.eduTeacherId, eduTeachers.id))
    .leftJoin(conConsequenceRecords, eq(conConsequenceRecords.punRecordId, punRecords.id))
    .where(where)
    .orderBy(desc(punRecords.fecha), desc(punRecords.hora));

  return rows.map(({ r, asignatura, profeNombre, profeApellido, consequenceId }) => ({
    id: r.id,
    fecha: r.fecha,
    hora: r.hora,
    minutosRetraso: r.minutosRetraso,
    justificado: r.justificado,
    justificacionTipo: r.justificacionTipo,
    justificacionNota: r.justificacionNota,
    subeAClase: r.subeAClase,
    observaciones: r.observaciones,
    asignatura,
    clase: nombreClase(r.curso, r.letra),
    profe: profeNombre ? `${profeNombre} ${profeApellido ?? ''}`.trim() : null,
    registradoPorEmail: r.registradoPorEmail,
    consumido: consequenceId !== null,
  }));
}

export interface HistorialAlumno {
  alumno: { eduStudentId: string; nombre: string; clase: string };
  retrasos: RetrasoFila[];
  resumen: ResumenHistorial;
  consecuencias: ConConsequence[];
}

/**
 * Todo lo que hace falta saber de un alumno al registrarle un retraso: sus retrasos del
 * curso, el resumen legible y sus consecuencias. `hoy` es la fecha del registro en curso.
 */
export async function historialAlumno(
  eduStudentId: string,
  hoy: string,
  academicYear = academicYearActual(),
): Promise<HistorialAlumno | null> {
  const alumno = await getAlumno(eduStudentId);
  if (!alumno) return null;

  const [retrasos, consecuencias] = await Promise.all([
    filasDeRetrasos(and(eq(punRecords.eduStudentId, eduStudentId), eq(punRecords.academicYear, academicYear))),
    db
      .select()
      .from(conConsequences)
      .where(and(eq(conConsequences.eduStudentId, eduStudentId), eq(conConsequences.academicYear, academicYear)))
      .orderBy(desc(conConsequences.createdAt)),
  ]);

  return {
    alumno: {
      eduStudentId,
      nombre: nombreAlumno(alumno),
      clase: nombreClase(alumno.curso, alumno.letra),
    },
    retrasos,
    resumen: resumenHistorial(retrasos, hoy),
    consecuencias,
  };
}

// ─── Tutorías (a quién se avisa y quién ve qué) ────────────────────────────────

export interface TutorClase {
  eduTeacherId: string;
  nombre: string;
  email: string | null;
}

/** Tutor/es de una clase en el curso académico en vigor. */
export async function tutoresDeClase(
  curso: string | null,
  letra: string | null,
  academicYear = academicYearActual(),
): Promise<TutorClase[]> {
  if (!curso) return [];
  const rows = await db
    .select({ t: eduTeachers })
    .from(eduTutorias)
    .innerJoin(eduTeachers, eq(eduTutorias.eduTeacherId, eduTeachers.id))
    .where(
      and(
        eq(eduTutorias.curso, curso),
        letra ? eq(eduTutorias.letra, letra) : isNull(eduTutorias.letra),
        eq(eduTutorias.academicYear, academicYear),
      ),
    );
  return rows.map(({ t }) => ({
    eduTeacherId: t.id,
    nombre: [t.nombre, t.apellido1].filter(Boolean).join(' '),
    email: t.email,
  }));
}

/** Clases que tutoriza esta persona (para filtrar el panel a "lo mío"). */
export async function clasesDeTutor(
  email: string,
  academicYear = academicYearActual(),
): Promise<{ curso: string; letra: string | null }[]> {
  const rows = await db
    .select({ curso: eduTutorias.curso, letra: eduTutorias.letra })
    .from(eduTutorias)
    .innerJoin(eduTeachers, eq(eduTutorias.eduTeacherId, eduTeachers.id))
    .where(and(eq(eduTutorias.academicYear, academicYear), ilike(eduTeachers.email, email)));
  return rows;
}

async function teacherIdDeEmail(email: string): Promise<string | null> {
  const [row] = await db.select({ id: eduTeachers.id }).from(eduTeachers).where(ilike(eduTeachers.email, email)).limit(1);
  return row?.id ?? null;
}

// ─── Alta de registros ────────────────────────────────────────────────────────

export interface NuevoRetraso {
  eduStudentId: string;
  fecha: string; // 'yyyy-MM-dd'
  hora: string; // 'HH:mm'
  subjectId?: string | null;
  justificado?: boolean;
  justificacionTipo?: string | null;
  justificacionNota?: string | null;
  subeAClase?: boolean;
  observaciones?: string | null;
}

export interface ResultadoRegistro {
  recordId: string;
  alumno: string;
  clase: string;
  /** Resumen DESPUÉS de guardar (lo que se le enseña al profe en el toast). */
  total: number;
  esteMes: number;
  /** Consecuencia generada por este registro, si ha cerrado el ciclo de tres. */
  consecuencia: { id: string; motivo: string; avisados: string[] } | null;
  /** Ya tenía un registro ese mismo día (posible duplicado). */
  duplicado: boolean;
}

/**
 * Guarda uno o varios retrasos y, para cada alumno, comprueba si se cierra un ciclo de
 * tres no justificados. Si se cierra: crea la consecuencia (sin fecha), la vincula a esos
 * tres retrasos —que dejan de contar para el ciclo siguiente— y avisa al tutor.
 *
 * El aviso por correo se hace desde el route handler (esta función devuelve qué hay que
 * avisar) para que un fallo de correo no deje el registro a medias.
 */
export async function crearRegistros(
  items: NuevoRetraso[],
  quien: { email: string },
): Promise<{ resultados: ResultadoRegistro[]; avisos: AvisoConsecuencia[] }> {
  const academicYear = academicYearActual();
  const eduTeacherId = await teacherIdDeEmail(quien.email);
  const resultados: ResultadoRegistro[] = [];
  const avisos: AvisoConsecuencia[] = [];

  for (const item of items) {
    const alumno = await getAlumno(item.eduStudentId);
    if (!alumno) throw new Error('Alumno no encontrado en la BBDD central');

    const previos = await filasDeRetrasos(
      and(eq(punRecords.eduStudentId, item.eduStudentId), eq(punRecords.academicYear, academicYear)),
    );
    const justificado = item.justificado ?? false;

    const [creado] = await db
      .insert(punRecords)
      .values({
        eduStudentId: item.eduStudentId,
        curso: alumno.curso,
        letra: alumno.letra,
        fecha: item.fecha,
        hora: item.hora,
        horaLimite: HORA_LIMITE,
        minutosRetraso: minutosRetraso(item.hora),
        subjectId: item.subjectId || null,
        justificado,
        justificacionTipo: justificado ? item.justificacionTipo || null : null,
        justificacionNota: justificado ? item.justificacionNota || null : null,
        subeAClase: item.subeAClase ?? false,
        observaciones: item.observaciones || null,
        eduTeacherId,
        registradoPorEmail: quien.email,
        academicYear,
      })
      .returning();

    const enCiclo = previos.filter((r) => !r.justificado && !r.consumido);
    const cierra = !justificado && enCiclo.length + 1 >= 3;

    let consecuencia: ResultadoRegistro['consecuencia'] = null;
    if (cierra) {
      const delCiclo = [...enCiclo.slice(-2).map((r) => r.id), creado.id];
      const fechas = [...enCiclo.slice(-2).map((r) => r.fecha), item.fecha];
      const aviso = await crearConsecuenciaDeCiclo({
        eduStudentId: item.eduStudentId,
        recordIds: delCiclo,
        fechas,
        alumnoNombre: nombreAlumno(alumno),
        clase: nombreClase(alumno.curso, alumno.letra),
        curso: alumno.curso,
        letra: alumno.letra,
        academicYear,
      });
      avisos.push(aviso);
      consecuencia = { id: aviso.consequenceId, motivo: aviso.motivo, avisados: aviso.destinatarios };
    }

    resultados.push({
      recordId: creado.id,
      alumno: nombreAlumno(alumno),
      clase: nombreClase(alumno.curso, alumno.letra),
      total: previos.length + 1,
      esteMes: previos.filter((r) => r.fecha.slice(0, 7) === item.fecha.slice(0, 7)).length + 1,
      consecuencia,
      duplicado: previos.some((r) => r.fecha === item.fecha),
    });
  }

  return { resultados, avisos };
}

export interface AvisoConsecuencia {
  consequenceId: string;
  token: string;
  alumnoNombre: string;
  clase: string;
  motivo: string;
  destinatarios: string[];
  retrasos: { fecha: string; hora: string; asignatura: string | null; profe: string | null }[];
  totalCurso: number;
}

const DIAS_VALIDEZ_TOKEN = 60;

function nuevoToken(): string {
  return `pun_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function crearConsecuenciaDeCiclo(datos: {
  eduStudentId: string;
  recordIds: string[];
  fechas: string[];
  alumnoNombre: string;
  clase: string;
  curso: string | null;
  letra: string | null;
  academicYear: string;
}): Promise<AvisoConsecuencia> {
  const totalNoJustificados = await db
    .select({ n: sql<number>`count(*)` })
    .from(punRecords)
    .where(
      and(
        eq(punRecords.eduStudentId, datos.eduStudentId),
        eq(punRecords.academicYear, datos.academicYear),
        eq(punRecords.justificado, false),
      ),
    );
  const acumulados = Number(totalNoJustificados[0]?.n ?? datos.recordIds.length);
  const motivo = `${acumulados} retrasos sin justificar este curso (${datos.fechas
    .map((f) => f.split('-').reverse().slice(0, 2).join('/'))
    .join(', ')})`;

  const token = nuevoToken();
  const expira = new Date();
  expira.setDate(expira.getDate() + DIAS_VALIDEZ_TOKEN);

  const [consecuencia] = await db
    .insert(conConsequences)
    .values({
      eduStudentId: datos.eduStudentId,
      tipoClave: TIPO_CONSECUENCIA_DEFECTO,
      origen: 'puntualidad',
      motivo,
      token,
      tokenExpiraAt: expira,
      academicYear: datos.academicYear,
    })
    .returning();

  await db
    .insert(conConsequenceRecords)
    .values(datos.recordIds.map((punRecordId) => ({ consequenceId: consecuencia.id, punRecordId })))
    .onConflictDoNothing();

  const [tutores, detalle] = await Promise.all([
    tutoresDeClase(datos.curso, datos.letra, datos.academicYear),
    filasDeRetrasos(inArray(punRecords.id, datos.recordIds)),
  ]);
  const destinatarios = tutores.map((t) => t.email).filter((e): e is string => Boolean(e));

  return {
    consequenceId: consecuencia.id,
    token,
    alumnoNombre: datos.alumnoNombre,
    clase: datos.clase,
    motivo,
    destinatarios,
    retrasos: detalle
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((r) => ({ fecha: r.fecha, hora: r.hora, asignatura: r.asignatura, profe: r.profe })),
    totalCurso: acumulados,
  };
}

/** Marca la consecuencia como avisada (con quién recibió el correo). */
export async function marcarAvisoEnviado(consequenceId: string, destinatarios: string[]) {
  await db
    .update(conConsequences)
    .set({ avisoEnviadoAt: new Date(), avisoDestinatarios: destinatarios, updatedAt: new Date() })
    .where(eq(conConsequences.id, consequenceId));
}

// ─── Edición y borrado de registros ───────────────────────────────────────────

export async function updateRegistro(
  id: string,
  cambios: {
    justificado?: boolean;
    justificacionTipo?: string | null;
    justificacionNota?: string | null;
    subeAClase?: boolean;
    observaciones?: string | null;
    subjectId?: string | null;
    hora?: string;
    fecha?: string;
  },
) {
  const set: Record<string, unknown> = { ...cambios, updatedAt: new Date() };
  if (cambios.hora) set.minutosRetraso = minutosRetraso(cambios.hora);
  if (cambios.justificado === true) set.subeAClase = cambios.subeAClase ?? true;
  await db.update(punRecords).set(set).where(eq(punRecords.id, id));
}

export async function borrarRegistro(id: string) {
  await db.delete(punRecords).where(eq(punRecords.id, id));
}

export async function getRegistro(id: string) {
  const [row] = await db.select().from(punRecords).where(eq(punRecords.id, id)).limit(1);
  return row ?? null;
}

// ─── Listado y dashboard ──────────────────────────────────────────────────────

export interface FiltroRetrasos {
  desde?: string;
  hasta?: string;
  clases?: { curso: string; letra: string | null }[] | null; // null = todas
  eduStudentId?: string;
  soloNoJustificados?: boolean;
  academicYear?: string;
}

export interface RetrasoListado extends RetrasoFila {
  eduStudentId: string;
  alumno: string;
}

export async function listarRetrasos(filtro: FiltroRetrasos, limite = 500): Promise<RetrasoListado[]> {
  const condiciones = [eq(punRecords.academicYear, filtro.academicYear ?? academicYearActual())];
  if (filtro.desde) condiciones.push(gte(punRecords.fecha, filtro.desde));
  if (filtro.hasta) condiciones.push(lte(punRecords.fecha, filtro.hasta));
  if (filtro.eduStudentId) condiciones.push(eq(punRecords.eduStudentId, filtro.eduStudentId));
  if (filtro.soloNoJustificados) condiciones.push(eq(punRecords.justificado, false));
  if (filtro.clases) {
    if (filtro.clases.length === 0) return [];
    const porClase = filtro.clases.map((c) =>
      and(eq(punRecords.curso, c.curso), c.letra ? eq(punRecords.letra, c.letra) : isNull(punRecords.letra)),
    );
    const combinada = or(...porClase);
    if (combinada) condiciones.push(combinada);
  }

  const rows = await db
    .select({
      r: punRecords,
      asignatura: punSubjects.nombre,
      profeNombre: eduTeachers.nombre,
      profeApellido: eduTeachers.apellido1,
      alumnoNombre: eduStudents.nombre,
      alumnoAp1: eduStudents.apellido1,
      alumnoAp2: eduStudents.apellido2,
      consequenceId: conConsequenceRecords.consequenceId,
    })
    .from(punRecords)
    .leftJoin(punSubjects, eq(punRecords.subjectId, punSubjects.id))
    .leftJoin(eduTeachers, eq(punRecords.eduTeacherId, eduTeachers.id))
    .leftJoin(eduStudents, eq(punRecords.eduStudentId, eduStudents.id))
    .leftJoin(conConsequenceRecords, eq(conConsequenceRecords.punRecordId, punRecords.id))
    .where(and(...condiciones))
    .orderBy(desc(punRecords.fecha), desc(punRecords.hora))
    .limit(limite);

  return rows.map((row) => ({
    id: row.r.id,
    eduStudentId: row.r.eduStudentId,
    alumno: nombreAlumno({ nombre: row.alumnoNombre, apellido1: row.alumnoAp1, apellido2: row.alumnoAp2 }),
    fecha: row.r.fecha,
    hora: row.r.hora,
    minutosRetraso: row.r.minutosRetraso,
    justificado: row.r.justificado,
    justificacionTipo: row.r.justificacionTipo,
    justificacionNota: row.r.justificacionNota,
    subeAClase: row.r.subeAClase,
    observaciones: row.r.observaciones,
    asignatura: row.asignatura,
    clase: nombreClase(row.r.curso, row.r.letra),
    profe: row.profeNombre ? `${row.profeNombre} ${row.profeApellido ?? ''}`.trim() : null,
    registradoPorEmail: row.r.registradoPorEmail,
    consumido: row.consequenceId !== null,
  }));
}

export interface DashboardPuntualidad {
  rango: { desde: string; hasta: string; dias: number };
  total: number;
  noJustificados: number;
  justificados: number;
  alumnosDistintos: number;
  minutosMedios: number;
  reincidentes: { eduStudentId: string; alumno: string; clase: string; total: number; noJustificados: number }[];
  porDiaSemana: { dia: string; total: number }[];
  porAsignatura: { asignatura: string; total: number }[];
  porClase: { clase: string; total: number }[];
  porProfe: { profe: string; total: number }[];
  porFecha: { fecha: string; total: number }[];
  porHora: { hora: string; total: number }[];
  consecuenciasPendientes: number;
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Agregados del panel. Se calcula en JS: son cientos de filas, no millones. */
export async function dashboard(filtro: FiltroRetrasos & { desde: string; hasta: string }): Promise<DashboardPuntualidad> {
  const filas = await listarRetrasos(filtro, 5000);

  const cuenta = <T extends string>(claves: (T | null)[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const k of claves) {
      const clave = k ?? '—';
      m.set(clave, (m.get(clave) ?? 0) + 1);
    }
    return m;
  };
  const ordenado = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));

  const porAlumno = new Map<string, { alumno: string; clase: string; total: number; noJustificados: number }>();
  for (const f of filas) {
    const actual = porAlumno.get(f.eduStudentId) ?? { alumno: f.alumno, clase: f.clase, total: 0, noJustificados: 0 };
    actual.total += 1;
    if (!f.justificado) actual.noJustificados += 1;
    porAlumno.set(f.eduStudentId, actual);
  }

  const diaSemana = new Array(7).fill(0) as number[];
  for (const f of filas) diaSemana[indiceDiaSemana(f.fecha)] += 1;

  const pendientes = await db
    .select({ n: sql<number>`count(*)` })
    .from(conConsequences)
    .where(and(eq(conConsequences.academicYear, filtro.academicYear ?? academicYearActual()), isNull(conConsequences.fecha)));

  const minutos = filas.map((f) => f.minutosRetraso);

  return {
    rango: {
      desde: filtro.desde,
      hasta: filtro.hasta,
      dias: Math.max(1, Math.round((Date.parse(filtro.hasta) - Date.parse(filtro.desde)) / 86_400_000) + 1),
    },
    total: filas.length,
    noJustificados: filas.filter((f) => !f.justificado).length,
    justificados: filas.filter((f) => f.justificado).length,
    alumnosDistintos: porAlumno.size,
    minutosMedios: minutos.length ? Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length) : 0,
    reincidentes: [...porAlumno.entries()]
      .map(([eduStudentId, v]) => ({ eduStudentId, ...v }))
      .sort((a, b) => b.total - a.total || a.alumno.localeCompare(b.alumno, 'es'))
      .slice(0, 12),
    porDiaSemana: DIAS.slice(0, 5).map((dia, i) => ({ dia, total: diaSemana[i] })),
    porAsignatura: ordenado(cuenta(filas.map((f) => f.asignatura))).map(([asignatura, total]) => ({ asignatura, total })),
    porClase: ordenado(cuenta(filas.map((f) => f.clase))).map(([clase, total]) => ({ clase, total })),
    porProfe: ordenado(cuenta(filas.map((f) => f.profe))).map(([profe, total]) => ({ profe, total })),
    porFecha: [...cuenta(filas.map((f) => f.fecha)).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, total]) => ({ fecha, total })),
    porHora: [...cuenta(filas.map((f) => f.hora)).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, total]) => ({ hora, total })),
    consecuenciasPendientes: Number(pendientes[0]?.n ?? 0),
  };
}

// ─── Consecuencias ────────────────────────────────────────────────────────────

export interface ConsecuenciaFila {
  id: string;
  eduStudentId: string;
  alumno: string;
  clase: string;
  tipoClave: string;
  origen: string;
  fecha: string | null;
  motivo: string | null;
  notas: string | null;
  cumplida: boolean;
  avisadaEducamos: boolean;
  avisoEnviadoAt: Date | null;
  fijadaPorEmail: string | null;
  createdAt: Date;
  retrasos: { fecha: string; hora: string; asignatura: string | null; profe: string | null }[];
}

export async function listarConsecuencias(
  filtro: { clases?: { curso: string; letra: string | null }[] | null; eduStudentId?: string; academicYear?: string } = {},
): Promise<ConsecuenciaFila[]> {
  const academicYear = filtro.academicYear ?? academicYearActual();
  const condiciones = [eq(conConsequences.academicYear, academicYear)];
  if (filtro.eduStudentId) condiciones.push(eq(conConsequences.eduStudentId, filtro.eduStudentId));

  const rows = await db
    .select({
      c: conConsequences,
      nombre: eduStudents.nombre,
      ap1: eduStudents.apellido1,
      ap2: eduStudents.apellido2,
      curso: eduStudents.curso,
      letra: eduStudents.letra,
    })
    .from(conConsequences)
    .leftJoin(eduStudents, eq(conConsequences.eduStudentId, eduStudents.id))
    .where(and(...condiciones))
    .orderBy(desc(conConsequences.createdAt));

  const permitida = (curso: string | null, letra: string | null) =>
    !filtro.clases || filtro.clases.some((c) => c.curso === curso && (c.letra ?? null) === (letra ?? null));

  const visibles = rows.filter((r) => permitida(r.curso, r.letra));
  if (visibles.length === 0) return [];

  const detalles = await db
    .select({ consequenceId: conConsequenceRecords.consequenceId, r: punRecords, asignatura: punSubjects.nombre })
    .from(conConsequenceRecords)
    .innerJoin(punRecords, eq(conConsequenceRecords.punRecordId, punRecords.id))
    .leftJoin(punSubjects, eq(punRecords.subjectId, punSubjects.id))
    .where(inArray(conConsequenceRecords.consequenceId, visibles.map((v) => v.c.id)));

  const porConsecuencia = new Map<string, ConsecuenciaFila['retrasos']>();
  for (const d of detalles) {
    const lista = porConsecuencia.get(d.consequenceId) ?? [];
    lista.push({ fecha: d.r.fecha, hora: d.r.hora, asignatura: d.asignatura, profe: null });
    porConsecuencia.set(d.consequenceId, lista);
  }

  return visibles.map(({ c, nombre, ap1, ap2, curso, letra }) => ({
    id: c.id,
    eduStudentId: c.eduStudentId,
    alumno: nombreAlumno({ nombre, apellido1: ap1, apellido2: ap2 }),
    clase: nombreClase(curso, letra),
    tipoClave: c.tipoClave,
    origen: c.origen,
    fecha: c.fecha,
    motivo: c.motivo,
    notas: c.notas,
    cumplida: c.cumplida,
    avisadaEducamos: c.avisadaEducamos,
    avisoEnviadoAt: c.avisoEnviadoAt,
    fijadaPorEmail: c.fijadaPorEmail,
    createdAt: c.createdAt,
    retrasos: (porConsecuencia.get(c.id) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }));
}

/** Consecuencia por su token de un clic (el del correo al tutor). */
export async function consecuenciaPorToken(token: string): Promise<ConsecuenciaFila | null> {
  const [row] = await db.select().from(conConsequences).where(eq(conConsequences.token, token)).limit(1);
  if (!row) return null;
  if (row.tokenExpiraAt && row.tokenExpiraAt.getTime() < Date.now()) return null;
  const lista = await listarConsecuencias({ eduStudentId: row.eduStudentId, academicYear: row.academicYear });
  return lista.find((c) => c.id === row.id) ?? null;
}

export async function updateConsecuencia(
  id: string,
  cambios: {
    fecha?: string | null;
    notas?: string | null;
    tipoClave?: string;
    cumplida?: boolean;
    avisadaEducamos?: boolean;
  },
  quien?: string,
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (cambios.fecha !== undefined) {
    set.fecha = cambios.fecha;
    if (quien) set.fijadaPorEmail = quien;
  }
  if (cambios.notas !== undefined) set.notas = cambios.notas;
  if (cambios.tipoClave !== undefined) set.tipoClave = cambios.tipoClave;
  if (cambios.cumplida !== undefined) {
    set.cumplida = cambios.cumplida;
    set.cumplidaAt = cambios.cumplida ? new Date() : null;
  }
  if (cambios.avisadaEducamos !== undefined) {
    set.avisadaEducamos = cambios.avisadaEducamos;
    set.avisadaEducamosAt = cambios.avisadaEducamos ? new Date() : null;
  }
  await db.update(conConsequences).set(set).where(eq(conConsequences.id, id));
}

/** Consecuencia a mano (sin retrasos detrás): la puerta abierta a que esto sea su módulo. */
export async function crearConsecuenciaManual(datos: {
  eduStudentId: string;
  tipoClave?: string;
  fecha?: string | null;
  motivo?: string | null;
  notas?: string | null;
  creadaPorEmail: string;
}) {
  const [creada] = await db
    .insert(conConsequences)
    .values({
      eduStudentId: datos.eduStudentId,
      tipoClave: datos.tipoClave ?? TIPO_CONSECUENCIA_DEFECTO,
      origen: 'manual',
      fecha: datos.fecha ?? null,
      motivo: datos.motivo ?? null,
      notas: datos.notas ?? null,
      creadaPorEmail: datos.creadaPorEmail,
      fijadaPorEmail: datos.fecha ? datos.creadaPorEmail : null,
      academicYear: academicYearActual(),
    })
    .returning();
  return creada;
}

export async function borrarConsecuencia(id: string) {
  await db.delete(conConsequences).where(eq(conConsequences.id, id));
}

// ─── Resumen semanal a tutores ────────────────────────────────────────────────

export interface ResumenTutor {
  email: string;
  nombre: string;
  clases: string[];
  filas: RetrasoListado[];
}

/**
 * Retrasos de la semana agrupados por tutor/a. Solo devuelve tutores CON retrasos: si en
 * una clase no ha llegado nadie tarde, no se manda correo (decisión de David).
 */
export async function resumenSemanalPorTutor(desde: string, hasta: string): Promise<ResumenTutor[]> {
  const academicYear = academicYearActual();
  const [filas, tutorias] = await Promise.all([
    listarRetrasos({ desde, hasta, academicYear }, 2000),
    db
      .select({ curso: eduTutorias.curso, letra: eduTutorias.letra, t: eduTeachers })
      .from(eduTutorias)
      .innerJoin(eduTeachers, eq(eduTutorias.eduTeacherId, eduTeachers.id))
      .where(eq(eduTutorias.academicYear, academicYear)),
  ]);

  const porTutor = new Map<string, ResumenTutor>();
  for (const { curso, letra, t } of tutorias) {
    if (!t.email) continue;
    const clase = nombreClase(curso, letra);
    const actual = porTutor.get(t.email) ?? {
      email: t.email,
      nombre: [t.nombre, t.apellido1].filter(Boolean).join(' '),
      clases: [],
      filas: [],
    };
    if (!actual.clases.includes(clase)) actual.clases.push(clase);
    actual.filas.push(...filas.filter((f) => f.clase === clase));
    porTutor.set(t.email, actual);
  }

  return [...porTutor.values()].filter((t) => t.filas.length > 0);
}

export async function digestYaEnviado(semana: string): Promise<boolean> {
  const [row] = await db.select({ id: punDigestRuns.id }).from(punDigestRuns).where(eq(punDigestRuns.semana, semana)).limit(1);
  return Boolean(row);
}

export async function registrarDigest(semana: string, destinatarios: string[]) {
  await db
    .insert(punDigestRuns)
    .values({ semana, enviados: destinatarios.length, destinatarios })
    .onConflictDoNothing();
}

// ─── Alcance (quién ve qué) ───────────────────────────────────────────────────

/**
 * Clases que esta persona puede ver en el panel, o `null` si ve todo el centro.
 * Dirección, jefatura, orientación y TIC ven todo; un tutor, solo sus tutorías.
 */
export async function alcanceClases(user: {
  email: string;
  role: Role | null;
}): Promise<{ curso: string; letra: string | null }[] | null> {
  if (vePuntualidadCompleta(user.role)) return null;
  return clasesDeTutor(user.email);
}

/** ¿Puede esta persona tocar/ver un registro concreto? (mismo criterio que el listado) */
export async function puedeConRegistro(
  user: { email: string; role: Role | null },
  registro: { curso: string | null; letra: string | null },
): Promise<boolean> {
  const alcance = await alcanceClases(user);
  if (alcance === null) return true;
  return alcance.some((c) => c.curso === registro.curso && (c.letra ?? null) === (registro.letra ?? null));
}
