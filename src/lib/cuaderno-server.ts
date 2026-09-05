// Capa de servidor del Cuaderno de tutor: todo lo que toca Neon.
// Ficha del módulo: docs/18-cuaderno-tutor.md
//
// El módulo es **lector** de `edu_*`: no mantiene su propio listado de alumnado ni de
// tutores, y el reparto de alumnos entre los dos tutores de una clase sale de
// `edu_tutor_personal` (módulo Tutorías), no se decide aquí. Lo único propio son las
// plantillas, los alias, la numeración congelada y la bitácora de tiradas.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  cuadAjustes,
  cuadAlias,
  cuadHojas,
  cuadItems,
  cuadNumeracion,
  cuadPlantillas,
  cuadTiradas,
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  eduTeachers,
  eduTutorias,
  eduTutorPersonal,
  type CuadAjustes,
  type CuadItem,
  type CuadPlantilla,
  type CuadTirada,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { construirMapeo, normalizarEtiqueta, type Repeticion } from '@/lib/cuaderno/campos';
import { claseCorta, tutorCorto, tutorCompleto } from '@/lib/cuaderno/nombres';

export { academicYearActual };

// ─── Ajustes ──────────────────────────────────────────────────────────────────

const AJUSTES_ID = 'global';

export const AJUSTES_POR_DEFECTO = {
  id: AJUSTES_ID,
  carpetaBaseId: null,
  carpetaBaseUrl: null,
  nombreCentro: 'Colegio Consolación Burriana',
  permisoTutores: 'writer',
} as const;

export async function getAjustes(): Promise<CuadAjustes> {
  const [fila] = await db.select().from(cuadAjustes).where(eq(cuadAjustes.id, AJUSTES_ID)).limit(1);
  return fila ?? { ...AJUSTES_POR_DEFECTO, updatedAt: new Date() };
}

export async function guardarAjustes(cambios: {
  carpetaBaseId?: string | null;
  carpetaBaseUrl?: string | null;
  nombreCentro?: string;
  permisoTutores?: string;
}): Promise<CuadAjustes> {
  const [fila] = await db
    .insert(cuadAjustes)
    .values({ id: AJUSTES_ID, ...cambios, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cuadAjustes.id, set: { ...cambios, updatedAt: new Date() } })
    .returning();
  return fila;
}

// ─── Plantillas y alias ───────────────────────────────────────────────────────

export async function getPlantillas(soloActivas = false): Promise<CuadPlantilla[]> {
  const filas = await db.select().from(cuadPlantillas).orderBy(asc(cuadPlantillas.orden), asc(cuadPlantillas.nombre));
  return soloActivas ? filas.filter((p) => p.activa) : filas;
}

export async function getPlantilla(id: string): Promise<CuadPlantilla | null> {
  const [fila] = await db.select().from(cuadPlantillas).where(eq(cuadPlantillas.id, id)).limit(1);
  return fila ?? null;
}

export async function crearPlantilla(datos: {
  nombre: string;
  googleDocId: string;
  repeticion: Repeticion;
  etapa: Etapa | null;
  orden?: number;
  generaPdf?: boolean;
  saltoDePagina?: boolean;
}): Promise<CuadPlantilla> {
  const orden = datos.orden ?? (await siguienteOrdenPlantilla());
  const [fila] = await db
    .insert(cuadPlantillas)
    .values({ ...datos, orden })
    .returning();
  return fila;
}

async function siguienteOrdenPlantilla(): Promise<number> {
  const [fila] = await db.select({ max: sql<number>`coalesce(max(${cuadPlantillas.orden}), 0)` }).from(cuadPlantillas);
  return (fila?.max ?? 0) + 1;
}

export async function actualizarPlantilla(
  id: string,
  cambios: Partial<{
    nombre: string;
    googleDocId: string;
    repeticion: string;
    etapa: string | null;
    orden: number;
    generaPdf: boolean;
    saltoDePagina: boolean;
    activa: boolean;
    etiquetas: string[];
    tieneFilas: boolean;
    analizadaAt: Date;
  }>,
): Promise<CuadPlantilla | null> {
  const [fila] = await db
    .update(cuadPlantillas)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(cuadPlantillas.id, id))
    .returning();
  return fila ?? null;
}

export async function borrarPlantilla(id: string): Promise<void> {
  await db.delete(cuadPlantillas).where(eq(cuadPlantillas.id, id));
}

/** Alias aprendidos: etiqueta normalizada → campo. */
export async function getAliasAprendidos(): Promise<Record<string, string>> {
  const filas = await db.select().from(cuadAlias);
  return Object.fromEntries(filas.map((f) => [f.etiqueta, f.campo]));
}

export async function getMapeo(): Promise<Map<string, string>> {
  return construirMapeo(await getAliasAprendidos());
}

export async function guardarAlias(etiqueta: string, campo: string, email: string | null): Promise<void> {
  const clave = normalizarEtiqueta(etiqueta);
  if (!clave) return;
  await db
    .insert(cuadAlias)
    .values({ etiqueta: clave, campo, creadoPor: email })
    .onConflictDoUpdate({ target: cuadAlias.etiqueta, set: { campo, creadoPor: email } });
}

export async function borrarAlias(etiqueta: string): Promise<void> {
  await db.delete(cuadAlias).where(eq(cuadAlias.etiqueta, normalizarEtiqueta(etiqueta)));
}

// ─── Clases, tutores y alumnado ───────────────────────────────────────────────

export interface TutorCuaderno {
  teacherId: string;
  nombre: string;
  corto: string;
  email: string | null;
}

export interface FamiliarCuaderno {
  nombre: string;
  telefono: string;
  correo: string;
}

export interface AlumnoCuaderno {
  id: string;
  nombre: string;
  apellido1: string;
  apellido2: string;
  nia: string;
  email: string;
  sexo: string;
  fechaNacimiento: string | null;
  /** teacherId de su tutor personal (null = sin reparto). */
  tutorPersonalId: string | null;
  familiares: FamiliarCuaderno[];
}

export interface ClaseCuaderno {
  curso: string;
  letra: string | null;
  etapa: Etapa | null;
  clase: string;
  tutores: TutorCuaderno[];
  /** Alumnado activo de la clase, en orden alfabético (el orden de la lista). */
  alumnos: AlumnoCuaderno[];
}

const cmpEs = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

const ordenAlfabetico = (a: AlumnoCuaderno, b: AlumnoCuaderno) =>
  cmpEs(a.apellido1, b.apellido1) || cmpEs(a.apellido2, b.apellido2) || cmpEs(a.nombre, b.nombre);

/** El primer teléfono que exista de un familiar (Educamos los reparte en tres columnas). */
const telefonoDe = (g: { telPersonal: string | null; movilTrabajo: string | null; telCasa: string | null }) =>
  g.telPersonal ?? g.movilTrabajo ?? g.telCasa ?? '';

/**
 * Todas las clases con alumnado activo, sus tutores del curso académico en vigor y su
 * alumnado con familiares. Es la fuente de datos de una tirada entera: se pide una vez y
 * se reparte entre los ítems, para no repetir 125 veces las mismas consultas.
 *
 * `filtro` limita a unas clases concretas (regenerar solo 2ºB) y `etapas` a unas etapas.
 */
export async function getClasesCuaderno(opciones?: {
  clases?: { curso: string; letra: string | null }[];
  etapas?: Etapa[];
}): Promise<ClaseCuaderno[]> {
  const academicYear = academicYearActual();
  const [alumnado, tutorias, profes, personales] = await Promise.all([
    db
      .select({
        id: eduStudents.id,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        nia: eduStudents.nia,
        email: eduStudents.email,
        emailGoogle: eduStudents.emailGoogle,
        sexo: eduStudents.sexo,
        fechaNacimiento: eduStudents.fechaNacimiento,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
      })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
    db.select().from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
    db.select().from(eduTeachers),
    db
      .select({ eduStudentId: eduTutorPersonal.eduStudentId, eduTeacherId: eduTutorPersonal.eduTeacherId })
      .from(eduTutorPersonal)
      .where(eq(eduTutorPersonal.academicYear, academicYear)),
  ]);

  const quiere = (curso: string | null, letra: string | null) => {
    if (!curso) return false;
    if (opciones?.etapas && !opciones.etapas.includes(etapaDeCurso(curso) as Etapa)) return false;
    if (!opciones?.clases) return true;
    return opciones.clases.some((c) => c.curso === curso && (c.letra ?? '') === (letra ?? ''));
  };

  const relevantes = alumnado.filter((a) => quiere(a.curso, a.letra));
  const familiaresPorAlumno = await getFamiliares(relevantes.map((a) => a.id));
  const profePorId = new Map(profes.map((p) => [p.id, p]));
  const personalPorAlumno = new Map(personales.map((p) => [p.eduStudentId, p.eduTeacherId]));

  const clases = new Map<string, ClaseCuaderno>();
  for (const a of relevantes) {
    const curso = a.curso as string;
    const clave = `${curso}|${a.letra ?? ''}`;
    let clase = clases.get(clave);
    if (!clase) {
      const tutores: TutorCuaderno[] = tutorias
        .filter((t) => t.curso === curso && (t.letra ?? '') === (a.letra ?? ''))
        .map((t) => profePorId.get(t.eduTeacherId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({
          teacherId: p.id,
          nombre: tutorCompleto(p),
          corto: tutorCorto(p.nombre, p.apellido1),
          email: p.email ?? p.emailOtro ?? null,
        }))
        .sort((x, y) => cmpEs(x.nombre, y.nombre));
      clase = {
        curso,
        letra: a.letra,
        etapa: etapaDeCurso(curso),
        clase: claseCorta(curso, a.letra),
        tutores,
        alumnos: [],
      };
      clases.set(clave, clase);
    }
    clase.alumnos.push({
      id: a.id,
      nombre: a.nombre ?? '',
      apellido1: a.apellido1 ?? '',
      apellido2: a.apellido2 ?? '',
      nia: a.nia ?? '',
      email: a.email ?? a.emailGoogle ?? '',
      sexo: a.sexo ?? '',
      fechaNacimiento: a.fechaNacimiento ?? null,
      tutorPersonalId: personalPorAlumno.get(a.id) ?? null,
      familiares: familiaresPorAlumno.get(a.id) ?? [],
    });
  }

  const salida = [...clases.values()].sort(compararClases);
  for (const clase of salida) clase.alumnos.sort(ordenAlfabetico);
  return salida;
}

/** Familiares (máximo dos, en el orden de Educamos) de cada alumno pedido. */
async function getFamiliares(alumnoIds: string[]): Promise<Map<string, FamiliarCuaderno[]>> {
  const salida = new Map<string, FamiliarCuaderno[]>();
  if (alumnoIds.length === 0) return salida;
  const filas = await db
    .select({
      studentId: eduStudentGuardians.studentId,
      orden: eduStudentGuardians.orden,
      nombre: eduGuardians.nombre,
      apellido1: eduGuardians.apellido1,
      apellido2: eduGuardians.apellido2,
      email: eduGuardians.email,
      emailGoogle: eduGuardians.emailGoogle,
      telPersonal: eduGuardians.telPersonal,
      movilTrabajo: eduGuardians.movilTrabajo,
      telCasa: eduGuardians.telCasa,
    })
    .from(eduStudentGuardians)
    .innerJoin(eduGuardians, eq(eduGuardians.id, eduStudentGuardians.guardianId))
    .where(inArray(eduStudentGuardians.studentId, alumnoIds));

  const porAlumno = new Map<string, typeof filas>();
  for (const f of filas) {
    const lista = porAlumno.get(f.studentId) ?? [];
    lista.push(f);
    porAlumno.set(f.studentId, lista);
  }
  for (const [alumnoId, lista] of porAlumno) {
    const ordenados = [...lista].sort((a, b) => (a.orden ?? 9) - (b.orden ?? 9));
    salida.set(
      alumnoId,
      ordenados.map((g) => ({
        nombre: [g.nombre, g.apellido1, g.apellido2].filter(Boolean).join(' '),
        telefono: telefonoDe(g),
        correo: g.email ?? g.emailGoogle ?? '',
      })),
    );
  }
  return salida;
}

export interface ResumenClasePanel {
  curso: string;
  letra: string | null;
  clase: string;
  etapa: Etapa | null;
  numAlumnos: number;
  tutores: { nombre: string; corto: string; email: string | null }[];
  /** Alumnos que se quedarían fuera de una tirada por no tener tutor personal. */
  sinTutorPersonal: number;
}

/**
 * Versión ligera de `getClasesCuaderno` para el panel: sin familiares ni datos de alumnado,
 * solo lo que hace falta para elegir clases y avisar de lo que está sin repartir.
 */
export async function getResumenClases(): Promise<ResumenClasePanel[]> {
  const academicYear = academicYearActual();
  const [alumnado, tutorias, profes, personales] = await Promise.all([
    db
      .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
    db.select().from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
    db.select().from(eduTeachers),
    db
      .select({ eduStudentId: eduTutorPersonal.eduStudentId, eduTeacherId: eduTutorPersonal.eduTeacherId })
      .from(eduTutorPersonal)
      .where(eq(eduTutorPersonal.academicYear, academicYear)),
  ]);
  const profePorId = new Map(profes.map((p) => [p.id, p]));
  const personalPorAlumno = new Map(personales.map((p) => [p.eduStudentId, p.eduTeacherId]));

  const clases = new Map<string, ResumenClasePanel & { alumnos: string[] }>();
  for (const a of alumnado) {
    if (!a.curso) continue;
    const clave = `${a.curso}|${a.letra ?? ''}`;
    let clase = clases.get(clave);
    if (!clase) {
      const tutores = tutorias
        .filter((t) => t.curso === a.curso && (t.letra ?? '') === (a.letra ?? ''))
        .map((t) => profePorId.get(t.eduTeacherId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({
          nombre: tutorCompleto(p),
          corto: tutorCorto(p.nombre, p.apellido1),
          email: p.email ?? p.emailOtro ?? null,
        }))
        .sort((x, y) => cmpEs(x.nombre, y.nombre));
      clase = {
        curso: a.curso,
        letra: a.letra,
        clase: claseCorta(a.curso, a.letra),
        etapa: etapaDeCurso(a.curso),
        numAlumnos: 0,
        tutores,
        sinTutorPersonal: 0,
        alumnos: [],
      };
      clases.set(clave, clase);
    }
    clase.numAlumnos++;
    clase.alumnos.push(a.id);
  }

  const salida = [...clases.values()].sort(compararClases);
  for (const clase of salida) {
    // Con un solo tutor no hay reparto que hacer: la clase entera es suya.
    if (clase.tutores.length < 2) continue;
    const idsDeLaClase = new Set(
      tutorias
        .filter((t) => t.curso === clase.curso && (t.letra ?? '') === (clase.letra ?? ''))
        .map((t) => t.eduTeacherId),
    );
    clase.sinTutorPersonal = clase.alumnos.filter((id) => {
      const tutor = personalPorAlumno.get(id);
      return !tutor || !idsDeLaClase.has(tutor);
    }).length;
  }
  return salida.map(({ alumnos, ...resto }) => {
    void alumnos;
    return resto;
  });
}

// ─── Numeración congelada ─────────────────────────────────────────────────────

export interface NumeroAlumno {
  /** El número que se le dio (el que está impreso). */
  asignado: number;
  /** Dónde le toca hoy por orden alfabético. */
  alfabetico: number;
}

/**
 * Números de lista de una clase, congelándolos la primera vez. Una vez impreso el
 * cuaderno, el nº 14 es el nº 14 todo el año: el alumnado que llega después recibe el
 * siguiente número libre de su clase en vez de descolocar a los demás.
 */
export async function asegurarNumeracion(
  academicYear: string,
  curso: string,
  letra: string | null,
  alumnosOrdenados: readonly { id: string }[],
): Promise<Map<string, NumeroAlumno>> {
  const letraClave = letra ?? '';
  const existentes = await db
    .select()
    .from(cuadNumeracion)
    .where(and(eq(cuadNumeracion.academicYear, academicYear), eq(cuadNumeracion.curso, curso), eq(cuadNumeracion.letra, letraClave)));

  const porAlumno = new Map(existentes.map((f) => [f.eduStudentId, f.numero]));
  let siguiente = existentes.reduce((max, f) => Math.max(max, f.numero), 0) + 1;
  const nuevos: { eduStudentId: string; academicYear: string; curso: string; letra: string; numero: number }[] = [];

  for (const alumno of alumnosOrdenados) {
    if (porAlumno.has(alumno.id)) continue;
    // Primera vez para la clase entera: numeración alfabética limpia, 1..N. Si ya había
    // números (una tirada anterior), el que llega ahora va al final de la lista.
    const numero = siguiente++;
    porAlumno.set(alumno.id, numero);
    nuevos.push({ eduStudentId: alumno.id, academicYear, curso, letra: letraClave, numero });
  }
  if (nuevos.length > 0) {
    // Un alumno que cambió de clase a mitad de curso ya tiene fila (otra clase): se
    // reubica en la nueva con el número libre que le toque.
    await db
      .insert(cuadNumeracion)
      .values(nuevos)
      .onConflictDoUpdate({
        target: [cuadNumeracion.eduStudentId, cuadNumeracion.academicYear],
        set: {
          curso: sql`excluded.curso`,
          letra: sql`excluded.letra`,
          numero: sql`excluded.numero`,
        },
      });
  }

  const salida = new Map<string, NumeroAlumno>();
  alumnosOrdenados.forEach((alumno, i) => {
    salida.set(alumno.id, { asignado: porAlumno.get(alumno.id) ?? i + 1, alfabetico: i + 1 });
  });
  return salida;
}

// ─── Tiradas y cola ──────────────────────────────────────────────────────────

export interface OpcionesTirada {
  formatos: ('doc' | 'pdf')[];
  cuadernoCompletoPdf: boolean;
  compartir: boolean;
  avisarPorCorreo: boolean;
  soloSinHoja: boolean;
  subcarpetaPropia: boolean;
}

export interface ItemNuevo {
  plantillaId: string;
  curso: string;
  letra: string | null;
  eduTeacherId: string | null;
  indiceTutor: number;
  alumnoIds: string[];
}

export async function crearTirada(datos: {
  academicYear: string;
  opciones: OpcionesTirada;
  lanzadaPor: string | null;
  items: ItemNuevo[];
}): Promise<CuadTirada> {
  const [fila] = await db
    .select({ max: sql<number>`coalesce(max(${cuadTiradas.numero}), 0)` })
    .from(cuadTiradas)
    .where(eq(cuadTiradas.academicYear, datos.academicYear));
  const numero = (fila?.max ?? 0) + 1;

  const [tirada] = await db
    .insert(cuadTiradas)
    .values({
      academicYear: datos.academicYear,
      numero,
      estado: 'pendiente',
      opciones: datos.opciones,
      lanzadaPor: datos.lanzadaPor,
    })
    .returning();

  if (datos.items.length > 0) {
    await db.insert(cuadItems).values(
      datos.items.map((i) => ({
        tiradaId: tirada.id,
        plantillaId: i.plantillaId,
        curso: i.curso,
        letra: i.letra ?? '',
        eduTeacherId: i.eduTeacherId,
        indiceTutor: i.indiceTutor,
        alumnoIds: i.alumnoIds,
      })),
    );
  }
  return tirada;
}

export async function getTirada(id: string): Promise<CuadTirada | null> {
  const [fila] = await db.select().from(cuadTiradas).where(eq(cuadTiradas.id, id)).limit(1);
  return fila ?? null;
}

export async function getItemsDeTirada(tiradaId: string): Promise<CuadItem[]> {
  return db
    .select()
    .from(cuadItems)
    .where(eq(cuadItems.tiradaId, tiradaId))
    .orderBy(asc(cuadItems.curso), asc(cuadItems.letra), asc(cuadItems.indiceTutor));
}

export interface ProgresoTirada {
  tirada: CuadTirada;
  total: number;
  hechos: number;
  errores: number;
  pendientes: number;
  haciendo: number;
}

export async function getProgreso(tiradaId: string): Promise<ProgresoTirada | null> {
  const tirada = await getTirada(tiradaId);
  if (!tirada) return null;
  const filas = await db
    .select({ estado: cuadItems.estado, n: sql<number>`count(*)::int` })
    .from(cuadItems)
    .where(eq(cuadItems.tiradaId, tiradaId))
    .groupBy(cuadItems.estado);
  const cuenta = (estado: string) => filas.find((f) => f.estado === estado)?.n ?? 0;
  return {
    tirada,
    total: filas.reduce((s, f) => s + f.n, 0),
    hechos: cuenta('hecho') + cuenta('omitido'),
    errores: cuenta('error'),
    pendientes: cuenta('pendiente'),
    haciendo: cuenta('haciendo'),
  };
}

export async function listarTiradas(limite = 20): Promise<ProgresoTirada[]> {
  const tiradas = await db.select().from(cuadTiradas).orderBy(desc(cuadTiradas.createdAt)).limit(limite);
  if (tiradas.length === 0) return [];
  const filas = await db
    .select({ tiradaId: cuadItems.tiradaId, estado: cuadItems.estado, n: sql<number>`count(*)::int` })
    .from(cuadItems)
    .where(
      inArray(
        cuadItems.tiradaId,
        tiradas.map((t) => t.id),
      ),
    )
    .groupBy(cuadItems.tiradaId, cuadItems.estado);
  return tiradas.map((tirada) => {
    const suyas = filas.filter((f) => f.tiradaId === tirada.id);
    const cuenta = (estado: string) => suyas.find((f) => f.estado === estado)?.n ?? 0;
    return {
      tirada,
      total: suyas.reduce((s, f) => s + f.n, 0),
      hechos: cuenta('hecho') + cuenta('omitido'),
      errores: cuenta('error'),
      pendientes: cuenta('pendiente'),
      haciendo: cuenta('haciendo'),
    };
  });
}

export async function actualizarTirada(
  id: string,
  cambios: Partial<{
    estado: string;
    carpetaCursoId: string;
    carpetaCursoUrl: string;
    error: string | null;
    finishedAt: Date | null;
  }>,
): Promise<void> {
  await db
    .update(cuadTiradas)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(cuadTiradas.id, id));
}

/** Cancela una tirada: los ítems que aún no se habían hecho se marcan como omitidos. */
export async function cancelarTirada(id: string): Promise<void> {
  await db
    .update(cuadItems)
    .set({ estado: 'omitido', error: 'Cancelada', updatedAt: new Date() })
    .where(and(eq(cuadItems.tiradaId, id), inArray(cuadItems.estado, ['pendiente', 'haciendo'])));
  await actualizarTirada(id, { estado: 'cancelada', finishedAt: new Date() });
}

/** Vuelve a poner en cola los ítems que fallaron. */
export async function reintentarErrores(tiradaId: string): Promise<number> {
  const filas = await db
    .update(cuadItems)
    .set({ estado: 'pendiente', error: null, updatedAt: new Date() })
    .where(and(eq(cuadItems.tiradaId, tiradaId), eq(cuadItems.estado, 'error')))
    .returning({ id: cuadItems.id });
  if (filas.length > 0) await actualizarTirada(tiradaId, { estado: 'pendiente', finishedAt: null, error: null });
  return filas.length;
}

/** Tiradas que tienen trabajo pendiente, más antigua primero. Las coge el worker. */
export async function tiradasConTrabajo(): Promise<CuadTirada[]> {
  const filas = await db
    .selectDistinct({ id: cuadItems.tiradaId })
    .from(cuadItems)
    .where(eq(cuadItems.estado, 'pendiente'));
  if (filas.length === 0) return [];
  return db
    .select()
    .from(cuadTiradas)
    .where(
      and(
        inArray(
          cuadTiradas.id,
          filas.map((f) => f.id),
        ),
        inArray(cuadTiradas.estado, ['pendiente', 'ejecutando']),
      ),
    )
    .orderBy(asc(cuadTiradas.createdAt));
}

/**
 * Reclama el siguiente ítem pendiente de una tirada. El `UPDATE … WHERE estado='pendiente'`
 * es lo que hace que dos workers a la vez no puedan coger el mismo (gana quien escriba
 * primero; el otro recibe 0 filas y prueba con el siguiente).
 */
export async function reclamarItem(tiradaId: string): Promise<CuadItem | null> {
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const [candidato] = await db
      .select({ id: cuadItems.id })
      .from(cuadItems)
      .where(and(eq(cuadItems.tiradaId, tiradaId), eq(cuadItems.estado, 'pendiente')))
      .orderBy(asc(cuadItems.curso), asc(cuadItems.letra), asc(cuadItems.indiceTutor))
      .limit(1);
    if (!candidato) return null;
    const [reclamado] = await db
      .update(cuadItems)
      .set({ estado: 'haciendo', intentos: sql`${cuadItems.intentos} + 1`, updatedAt: new Date() })
      .where(and(eq(cuadItems.id, candidato.id), eq(cuadItems.estado, 'pendiente')))
      .returning();
    if (reclamado) return reclamado;
  }
  return null;
}

export async function marcarItem(
  id: string,
  cambios: Partial<{
    estado: string;
    docId: string | null;
    docUrl: string | null;
    pdfId: string | null;
    pdfUrl: string | null;
    carpetaId: string | null;
    carpetaUrl: string | null;
    error: string | null;
  }>,
): Promise<void> {
  await db
    .update(cuadItems)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(cuadItems.id, id));
}

/** Deja constancia de que estos alumnos ya tienen su hoja de esta plantilla este curso. */
export async function registrarHojas(datos: {
  alumnoIds: string[];
  plantillaId: string;
  academicYear: string;
  tiradaId: string;
  itemId: string;
}): Promise<void> {
  if (datos.alumnoIds.length === 0) return;
  await db
    .insert(cuadHojas)
    .values(
      datos.alumnoIds.map((eduStudentId) => ({
        eduStudentId,
        plantillaId: datos.plantillaId,
        academicYear: datos.academicYear,
        tiradaId: datos.tiradaId,
        itemId: datos.itemId,
      })),
    )
    .onConflictDoUpdate({
      target: [cuadHojas.eduStudentId, cuadHojas.plantillaId, cuadHojas.academicYear],
      set: { tiradaId: datos.tiradaId, itemId: datos.itemId, updatedAt: new Date() },
    });
}

// ─── ¿A quién le falta su hoja? ──────────────────────────────────────────────

export interface AlumnoSinHoja {
  id: string;
  nombre: string;
  curso: string;
  letra: string | null;
  clase: string;
  /** Plantillas (por id) que le faltan. */
  plantillas: string[];
}

/**
 * Alumnado activo que no tiene todas sus hojas de este curso escolar. Es lo que permite la
 * tirada de "los que llegaron tarde": típicamente una matrícula de octubre a la que hay que
 * hacerle su Dossier y sus entrevistas sin rehacer las de los otros 29.
 */
export async function alumnosSinHoja(academicYear: string, etapas?: Etapa[]): Promise<AlumnoSinHoja[]> {
  const plantillas = (await getPlantillas(true)).filter((p) => !etapas || !p.etapa || etapas.includes(p.etapa as Etapa));
  if (plantillas.length === 0) return [];
  const [alumnado, hojas] = await Promise.all([
    db
      .select({
        id: eduStudents.id,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
      })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
    db
      .select({ eduStudentId: cuadHojas.eduStudentId, plantillaId: cuadHojas.plantillaId })
      .from(cuadHojas)
      .where(eq(cuadHojas.academicYear, academicYear)),
  ]);

  const hechasPorAlumno = new Map<string, Set<string>>();
  for (const h of hojas) {
    const set = hechasPorAlumno.get(h.eduStudentId) ?? new Set<string>();
    set.add(h.plantillaId);
    hechasPorAlumno.set(h.eduStudentId, set);
  }

  const salida: AlumnoSinHoja[] = [];
  for (const a of alumnado) {
    if (!a.curso) continue;
    const etapa = etapaDeCurso(a.curso);
    if (etapas && !etapas.includes(etapa as Etapa)) continue;
    const hechas = hechasPorAlumno.get(a.id) ?? new Set<string>();
    const suyas = plantillas.filter((p) => !p.etapa || p.etapa === etapa);
    const faltan = suyas.filter((p) => !hechas.has(p.id)).map((p) => p.id);
    if (faltan.length === 0) continue;
    salida.push({
      id: a.id,
      nombre: [a.apellido1, a.apellido2].filter(Boolean).join(' ') + `, ${a.nombre ?? ''}`,
      curso: a.curso,
      letra: a.letra,
      clase: claseCorta(a.curso, a.letra),
      plantillas: faltan,
    });
  }
  return salida.sort((a, b) => compararClases(a, b) || cmpEs(a.nombre, b.nombre));
}

/**
 * plantillaId → alumnos a los que les falta esa hoja este curso. Es lo que convierte
 * "han llegado tres alumnos nuevos" en una tirada de tres hojas en vez de 125 documentos.
 */
export async function faltasPorPlantilla(academicYear: string): Promise<Record<string, string[]>> {
  const mapa: Record<string, string[]> = {};
  for (const alumno of await alumnosSinHoja(academicYear)) {
    for (const plantillaId of alumno.plantillas) {
      mapa[plantillaId] = [...(mapa[plantillaId] ?? []), alumno.id];
    }
  }
  return mapa;
}

/** Cuántas hojas hay hechas por plantilla este curso (para el panel). */
export async function resumenHojas(academicYear: string): Promise<Record<string, number>> {
  const filas = await db
    .select({ plantillaId: cuadHojas.plantillaId, n: sql<number>`count(*)::int` })
    .from(cuadHojas)
    .where(eq(cuadHojas.academicYear, academicYear))
    .groupBy(cuadHojas.plantillaId);
  return Object.fromEntries(filas.map((f) => [f.plantillaId, f.n]));
}

/** Clases sin ningún tutor asignado en el curso en vigor (bloquean el compartir). */
export async function clasesSinTutor(): Promise<string[]> {
  const academicYear = academicYearActual();
  const [alumnado, tutorias] = await Promise.all([
    db
      .select({ curso: eduStudents.curso, letra: eduStudents.letra })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
    db.select().from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
  ]);
  const conTutor = new Set(tutorias.map((t) => `${t.curso}|${t.letra ?? ''}`));
  const clases = new Set(alumnado.filter((a) => a.curso).map((a) => `${a.curso}|${a.letra ?? ''}`));
  return [...clases]
    .filter((c) => !conTutor.has(c))
    .map((c) => {
      const [curso, letra] = c.split('|');
      return claseCorta(curso, letra || null);
    })
    .sort();
}
