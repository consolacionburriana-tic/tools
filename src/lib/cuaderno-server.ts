// Capa de servidor del Cuaderno de tutor: todo lo que toca Neon.
// Ficha del módulo: docs/18-cuaderno-tutor.md
//
// El módulo es **lector** de `edu_*`: no mantiene su propio listado de alumnado ni de
// tutores, y el reparto de alumnos entre los dos tutores de una clase sale de
// `edu_tutor_personal` (módulo Tutorías), no se decide aquí. Lo único propio son las
// plantillas, los alias, la numeración congelada y la bitácora de tiradas.
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  cuadAjustes,
  cuadAlias,
  cuadAsignaturas,
  cuadEventos,
  cuadHojas,
  cuadItems,
  cuadNumeracion,
  cuadPersonas,
  cuadPlantillas,
  cuadTiradas,
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  eduTeachers,
  eduTutorias,
  eduTutorPersonal,
  type CuadAjustes,
  type CuadAsignatura,
  type CuadEvento,
  type CuadItem,
  type CuadPlantilla,
  type CuadTirada,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { construirMapeo, normalizarEtiqueta, type Repeticion } from '@/lib/cuaderno/campos';
import { claseCorta } from '@/lib/cuaderno/nombres';
import { correoBonito, mayusculasBellas, nombresDe, type NombreAMano } from '@/lib/cuaderno/personas';

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

/**
 * Cuánto historial se lleva por delante quitar una plantilla. Se enseña ANTES de borrar,
 * porque «quitar la plantilla» y «borrar los 30 documentos que salieron de ella» no son la
 * misma decisión y quien la toma tiene que saberlo.
 */
export async function historialDePlantilla(id: string): Promise<{ documentos: number; hojas: number }> {
  const [documentos, hojas] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(cuadItems).where(eq(cuadItems.plantillaId, id)),
    db.select({ n: sql<number>`count(*)::int` }).from(cuadHojas).where(eq(cuadHojas.plantillaId, id)),
  ]);
  return { documentos: documentos[0]?.n ?? 0, hojas: hojas[0]?.n ?? 0 };
}

/**
 * Quita una plantilla y, con ella, los ítems de tirada y las hojas que salieron de ella
 * (las dos tablas van en cascada). Lo de Drive no se toca: los documentos ya generados son
 * del tutor, no de aquí.
 */
export async function borrarPlantilla(id: string): Promise<boolean> {
  const borradas = await db.delete(cuadPlantillas).where(eq(cuadPlantillas.id, id)).returning({ id: cuadPlantillas.id });
  return borradas.length > 0;
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
  /** El de las hojas: nombre de pila + apellidos («Carlos Valero Aicart»). */
  nombre: string;
  /** El de carpetas y archivos («Carlos V»). */
  corto: string;
  /** Todo lo que trae el export («Carlos Andres Valero Aicart»), por si hace falta. */
  completo: string;
  /** Los trozos sueltos, para plantillas que los piden por separado. */
  pila: string;
  apellido1: string;
  apellido2: string;
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

// ─── Nombres a mano ───────────────────────────────────────────────────────────
//
// Educamos manda los nombres A GRITOS y con todos los nombres de pila («CARLOS ANDRES
// VALERO AICART»). `nombresDe()` los arregla solo, y lo poco que la heurística no acierta
// se escribe a mano aquí. La clave del mapa es `ambito:personaId`.

export type ClavePersona = `profe:${string}` | `alumno:${string}` | `familiar:${string}`;

export async function getNombresAMano(): Promise<Map<string, NombreAMano>> {
  const filas = await db.select().from(cuadPersonas);
  return new Map(filas.map((f) => [`${f.ambito}:${f.personaId}`, { pila: f.pila, completo: f.completo }]));
}

/**
 * Fija (o borra) el nombre de una persona en el cuaderno. Con los dos campos en blanco se
 * quita la fila y se vuelve a lo que diga el export.
 */
export async function fijarNombre(opciones: {
  ambito: 'profe' | 'alumno' | 'familiar';
  personaId: string;
  pila: string | null;
  completo: string | null;
}): Promise<void> {
  const pila = opciones.pila?.trim() || null;
  const completo = opciones.completo?.trim() || null;
  const donde = and(eq(cuadPersonas.ambito, opciones.ambito), eq(cuadPersonas.personaId, opciones.personaId));
  if (!pila && !completo) {
    await db.delete(cuadPersonas).where(donde);
    return;
  }
  await db
    .insert(cuadPersonas)
    .values({ ambito: opciones.ambito, personaId: opciones.personaId, pila, completo })
    .onConflictDoUpdate({
      target: [cuadPersonas.ambito, cuadPersonas.personaId],
      set: { pila, completo, updatedAt: new Date() },
    });
}

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
  const [alumnado, tutorias, profes, personales, aMano] = await Promise.all([
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
    getNombresAMano(),
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
        .map((p) => {
          const n = nombresDe(p, aMano.get(`profe:${p.id}`));
          return {
            teacherId: p.id,
            nombre: n.usual,
            corto: n.corto,
            completo: n.completo,
            pila: n.pila,
            apellido1: mayusculasBellas(p.apellido1),
            apellido2: mayusculasBellas(p.apellido2),
            email: correoBonito(p.email ?? p.emailOtro) || null,
          };
        })
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
    const suyo = nombresDe(a, aMano.get(`alumno:${a.id}`));
    clase.alumnos.push({
      id: a.id,
      nombre: suyo.pila,
      // Cada apellido por su lado: partir `suyo.apellidos` por el espacio dejaría
      // «de la Fuente Pons» como apellido1 «de» y apellido2 «la Fuente Pons».
      apellido1: mayusculasBellas(a.apellido1),
      apellido2: mayusculasBellas(a.apellido2),
      nia: a.nia ?? '',
      email: correoBonito(a.email ?? a.emailGoogle),
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
  const aMano = await getNombresAMano();
  const filas = await db
    .select({
      studentId: eduStudentGuardians.studentId,
      guardianId: eduGuardians.id,
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
        nombre: nombresDe(g, aMano.get(`familiar:${g.guardianId}`)).usual,
        telefono: telefonoDe(g),
        correo: correoBonito(g.email ?? g.emailGoogle),
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
  const [alumnado, tutorias, profes, personales, aMano] = await Promise.all([
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
    getNombresAMano(),
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
        .map((p) => {
          const n = nombresDe(p, aMano.get(`profe:${p.id}`));
          return { nombre: n.usual, corto: n.corto, email: correoBonito(p.email ?? p.emailOtro) || null };
        })
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

// ─── Asignaturas por curso ───────────────────────────────────────────────────
//
// El CÓDIGO de una asignatura (`<<asignatura1>>`) es su POSICIÓN dentro del curso, no su id:
// la plantilla es la misma para todos y cada clase rellena las suyas. Si se borra la 2, la
// que era 3 pasa a ser 2 — el panel lo enseña, y por eso los códigos se ven ahí siempre.

export interface AsignaturaCuaderno {
  id: string;
  curso: string;
  /** 1, 2, 3… = la etiqueta `<<asignaturaN>>`. Es la posición, se recalcula al leer. */
  codigo: number;
  nombre: string;
  nombreCorto: string | null;
  /** Lo que sale de verdad en la hoja: el corto si lo hay, si no el largo. */
  enLaHoja: string;
  origen: string;
  horMateriaId: string | null;
  /** Alumnos de las clases donde consta esa materia en el horario (null si es manual). */
  alumnos: number | null;
  /**
   * La abreviatura que el horario tiene para esa materia, limpia del dígito de nivel
   * (`MAT1` → `MAT`). Se ofrece como SUGERENCIA, no se copia sola: en Untis son códigos
   * internos y hay unos cuantos que no se entienden fuera («MYD» para Music, «EPV» para
   * Arts). Quien decide qué se imprime en la hoja es la persona, no el horario.
   */
  sugerenciaCorto: string | null;
}

const conCodigos = (
  filas: CuadAsignatura[],
  alumnosPorMateria: Map<string, number>,
  abreviaturas: Map<string, string> = new Map(),
): AsignaturaCuaderno[] =>
  filas
    .filter((f) => f.active)
    .sort((a, b) => a.orden - b.orden || cmpEs(a.nombre, b.nombre))
    .map((f, i) => ({
      id: f.id,
      curso: f.curso,
      codigo: i + 1,
      nombre: f.nombre,
      nombreCorto: f.nombreCorto,
      enLaHoja: f.nombreCorto?.trim() || f.nombre,
      origen: f.origen,
      horMateriaId: f.horMateriaId,
      alumnos: f.horMateriaId ? alumnosPorMateria.get(`${f.curso}|${f.horMateriaId}`) ?? 0 : null,
      sugerenciaCorto: f.horMateriaId ? abreviaturas.get(f.horMateriaId) ?? null : null,
    }));

/**
 * Cuántos alumnos tiene cada (curso, materia) según el horario: los de las clases donde esa
 * materia se imparte. Ojo con lo que NO dice: en un desdoble (Religión / Valores) los dos
 * salen con la clase entera, porque el horario no guarda quién va a cuál. Por eso el panel
 * lo llama "alumnos de las clases que la tienen" y no "matriculados".
 */
async function alumnosPorMateriaDelHorario(): Promise<Map<string, number>> {
  const filas = await db.execute<{ curso: string; materia_id: string; alumnos: number }>(sql`
    SELECT g.curso, a.materia_id, count(DISTINCT s.id)::int AS alumnos
    FROM hor_asignacion_grupos g
    JOIN hor_asignaciones a ON a.id = g.asignacion_id AND a.active AND a.materia_id IS NOT NULL
    JOIN edu_students s ON s.active AND s.curso = g.curso
      AND (g.letra IS NULL OR coalesce(s.letra, '') = g.letra)
    GROUP BY g.curso, a.materia_id
  `);
  return new Map(filas.rows.map((f) => [`${f.curso}|${f.materia_id}`, Number(f.alumnos)]));
}

/** Asignaturas guardadas, por curso, ya con su código. */
export async function getAsignaturas(academicYear: string): Promise<Map<string, AsignaturaCuaderno[]>> {
  const [filas, alumnos, abreviaturas] = await Promise.all([
    db.select().from(cuadAsignaturas).where(eq(cuadAsignaturas.academicYear, academicYear)),
    alumnosPorMateriaDelHorario(),
    abreviaturasDelHorario(),
  ]);
  const porCurso = new Map<string, CuadAsignatura[]>();
  for (const f of filas) porCurso.set(f.curso, [...(porCurso.get(f.curso) ?? []), f]);
  return new Map([...porCurso].map(([curso, suyas]) => [curso, conCodigos(suyas, alumnos, abreviaturas)]));
}

/**
 * Abreviatura del horario por materia, ya limpia. En Untis vienen con el nivel pegado
 * (`MAT1`, `EFI3`, `LEN1`) porque allí distinguen la materia de 1º de la de 3º; aquí eso
 * sobra, así que se le quita el dígito final. Las de dos letras o menos no se tocan.
 */
export async function abreviaturasDelHorario(): Promise<Map<string, string>> {
  const filas = await db.execute<{ id: string; abreviatura: string | null }>(sql`
    SELECT id, abreviatura FROM hor_materias WHERE active AND abreviatura IS NOT NULL AND abreviatura <> ''
  `);
  const mapa = new Map<string, string>();
  for (const f of filas.rows ?? []) {
    const limpia = limpiarAbreviatura(f.abreviatura);
    if (limpia) mapa.set(f.id, limpia);
  }
  return mapa;
}

export function limpiarAbreviatura(abreviatura: string | null): string | null {
  const bruta = (abreviatura ?? '').trim();
  if (bruta === '') return null;
  const sinNivel = bruta.replace(/\d+$/, '');
  return (sinNivel.length >= 2 ? sinNivel : bruta) || null;
}

export interface MateriaDelHorario {
  curso: string;
  materiaId: string;
  nombre: string;
  abreviatura: string | null;
  alumnos: number;
  /** ¿Está ya en las asignaturas del cuaderno de ese curso? */
  yaEsta: boolean;
}

/** Lo que el horario sabe de cada curso: la fuente del botón «traer del horario». */
export async function getMateriasDelHorario(academicYear: string): Promise<MateriaDelHorario[]> {
  const [filas, guardadas, alumnos] = await Promise.all([
    db.execute<{ curso: string; materia_id: string; nombre: string; abreviatura: string | null }>(sql`
      SELECT DISTINCT g.curso, m.id AS materia_id, m.nombre, m.abreviatura
      FROM hor_asignacion_grupos g
      JOIN hor_asignaciones a ON a.id = g.asignacion_id AND a.active AND a.materia_id IS NOT NULL
      JOIN hor_materias m ON m.id = a.materia_id AND m.active
      ORDER BY g.curso, m.nombre
    `),
    db.select().from(cuadAsignaturas).where(eq(cuadAsignaturas.academicYear, academicYear)),
    alumnosPorMateriaDelHorario(),
  ]);
  const yaEstan = new Set(guardadas.filter((g) => g.active && g.horMateriaId).map((g) => `${g.curso}|${g.horMateriaId}`));
  return filas.rows.map((f) => ({
    curso: f.curso,
    materiaId: f.materia_id,
    nombre: f.nombre,
    abreviatura: f.abreviatura,
    alumnos: alumnos.get(`${f.curso}|${f.materia_id}`) ?? 0,
    yaEsta: yaEstan.has(`${f.curso}|${f.materia_id}`),
  }));
}

async function siguienteOrden(academicYear: string, curso: string): Promise<number> {
  const [fila] = await db
    .select({ max: sql<number>`coalesce(max(${cuadAsignaturas.orden}), 0)` })
    .from(cuadAsignaturas)
    .where(and(eq(cuadAsignaturas.academicYear, academicYear), eq(cuadAsignaturas.curso, curso)));
  return (fila?.max ?? 0) + 1;
}

export async function crearAsignatura(datos: {
  academicYear: string;
  curso: string;
  nombre: string;
  nombreCorto?: string | null;
  horMateriaId?: string | null;
  origen?: string;
}): Promise<CuadAsignatura> {
  const orden = await siguienteOrden(datos.academicYear, datos.curso);
  const [fila] = await db
    .insert(cuadAsignaturas)
    .values({ ...datos, orden, origen: datos.origen ?? 'manual' })
    .returning();
  return fila;
}

export async function actualizarAsignatura(
  id: string,
  cambios: Partial<{ nombre: string; nombreCorto: string | null; orden: number; active: boolean }>,
): Promise<void> {
  await db
    .update(cuadAsignaturas)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(cuadAsignaturas.id, id));
}

/**
 * Pone el mismo nombre corto a las asignaturas que se llaman igual en los demás cursos.
 *
 * «Biología» es «BG» en 1º de la ESO y en 3º y en 4º: escribirlo cinco veces es una pérdida
 * de tiempo. Por defecto solo rellena las que están **en blanco**, para no pisar un nombre
 * corto que alguien puso a propósito; con `pisar` se aplica a todas.
 *
 * Devuelve a cuántas llegó («BG puesto también en 4 cursos») y cuántas se quedaron fuera
 * por tener ya un nombre corto distinto, que es lo que el panel ofrece pisar.
 */
export async function propagarNombreCorto(opciones: {
  academicYear: string;
  nombre: string;
  nombreCorto: string | null;
  excluirId: string;
  pisar?: boolean;
}): Promise<{ propagadas: number; conOtro: number }> {
  const { academicYear, nombre, nombreCorto, excluirId, pisar = false } = opciones;
  const hermanas = await db
    .select({ id: cuadAsignaturas.id, nombre: cuadAsignaturas.nombre, nombreCorto: cuadAsignaturas.nombreCorto })
    .from(cuadAsignaturas)
    .where(and(eq(cuadAsignaturas.academicYear, academicYear), eq(cuadAsignaturas.active, true)));

  // Se comparan los nombres con la misma normalización que las etiquetas: así «Biología y
  // Geología» y «BIOLOGIA Y GEOLOGIA» son la misma asignatura, que es lo que uno espera.
  const clave = normalizarEtiqueta(nombre);
  const gemelas = hermanas.filter(
    (a) => a.id !== excluirId && normalizarEtiqueta(a.nombre) === clave && a.nombreCorto !== nombreCorto,
  );
  const ids = gemelas.filter((a) => pisar || !a.nombreCorto).map((a) => a.id);
  const conOtro = pisar ? 0 : gemelas.filter((a) => a.nombreCorto).length;
  if (ids.length === 0) return { propagadas: 0, conOtro };
  await db
    .update(cuadAsignaturas)
    .set({ nombreCorto, updatedAt: new Date() })
    .where(inArray(cuadAsignaturas.id, ids));
  return { propagadas: ids.length, conOtro };
}

export async function getAsignatura(id: string): Promise<CuadAsignatura | null> {
  const [fila] = await db.select().from(cuadAsignaturas).where(eq(cuadAsignaturas.id, id)).limit(1);
  return fila ?? null;
}

export async function borrarAsignatura(id: string): Promise<void> {
  await db.delete(cuadAsignaturas).where(eq(cuadAsignaturas.id, id));
}

/**
 * Sube o baja una asignatura dentro de su curso intercambiando el `orden` con su vecina.
 * Cambiar el orden cambia el código: lo que era `<<asignatura3>>` pasa a ser `<<asignatura2>>`.
 */
export async function moverAsignatura(id: string, direccion: 'arriba' | 'abajo'): Promise<void> {
  const [actual] = await db.select().from(cuadAsignaturas).where(eq(cuadAsignaturas.id, id)).limit(1);
  if (!actual) return;
  const hermanas = (
    await db
      .select()
      .from(cuadAsignaturas)
      .where(
        and(eq(cuadAsignaturas.academicYear, actual.academicYear), eq(cuadAsignaturas.curso, actual.curso)),
      )
  )
    .filter((f) => f.active)
    .sort((a, b) => a.orden - b.orden);
  const i = hermanas.findIndex((f) => f.id === id);
  const j = direccion === 'arriba' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= hermanas.length) return;
  // Se reescriben los dos órdenes con la posición, no se intercambian los valores: así una
  // lista con órdenes duplicados (o con huecos) se va arreglando sola al usarla.
  await db.update(cuadAsignaturas).set({ orden: j + 1, updatedAt: new Date() }).where(eq(cuadAsignaturas.id, hermanas[i].id));
  await db.update(cuadAsignaturas).set({ orden: i + 1, updatedAt: new Date() }).where(eq(cuadAsignaturas.id, hermanas[j].id));
}

/**
 * Trae del horario las materias que falten. **No pisa nada**: las que ya están se dejan como
 * estén (con su nombre corto editado a mano), y solo se añaden las nuevas al final.
 */
export async function sincronizarDesdeHorario(
  academicYear: string,
  curso?: string,
): Promise<{ anadidas: number; cursos: string[] }> {
  const materias = (await getMateriasDelHorario(academicYear)).filter(
    (m) => !m.yaEsta && (!curso || m.curso === curso),
  );
  const cursos = new Set<string>();
  let anadidas = 0;
  for (const materia of materias) {
    // El nombre corto se deja VACÍO a propósito: la abreviatura del horario es un código
    // interno del generador ('EPV1', 'MYD1', 'LCO1') y en una hoja impresa no dice nada.
    // El corto lo pone David cuando quiere ("Valencià: Llengua i Literatura" → "Valencià").
    await crearAsignatura({
      academicYear,
      curso: materia.curso,
      nombre: materia.nombre,
      horMateriaId: materia.materiaId,
      origen: 'horario',
    });
    cursos.add(materia.curso);
    anadidas++;
  }
  return { anadidas, cursos: [...cursos] };
}

/** Cursos con alumnado activo, para que el panel enseñe también los que no tienen nada. */
export async function getCursosConAlumnado(): Promise<{ curso: string; alumnos: number }[]> {
  const filas = await db
    .select({ curso: eduStudents.curso, n: sql<number>`count(*)::int` })
    .from(eduStudents)
    .where(eq(eduStudents.active, true))
    .groupBy(eduStudents.curso);
  return filas
    .filter((f): f is { curso: string; n: number } => Boolean(f.curso))
    .map((f) => ({ curso: f.curso, alumnos: f.n }))
    .sort((a, b) => compararClases({ curso: a.curso, letra: null }, { curso: b.curso, letra: null }));
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
    latidoAt: Date | null;
  }>,
): Promise<void> {
  await db
    .update(cuadTiradas)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(cuadTiradas.id, id));
}

// ─── Bitácora ─────────────────────────────────────────────────────────────────
//
// Cada tirada deja escrito lo que le pasa. Es lo que el panel le cuenta a quien la lanzó
// («el worker no ha arrancado nunca» vs. «va por el documento 7 de 12») y lo que se mira
// después para saber por qué un documento no salió. Escribir un evento NUNCA puede tumbar
// una tirada: si falla el INSERT, se queda en el log del servidor y se sigue.

export interface EventoNuevo {
  tiradaId?: string | null;
  itemId?: string | null;
  nivel?: 'info' | 'aviso' | 'error';
  fase: 'lanzar' | 'worker' | 'drive' | 'documento' | 'cierre' | 'correo' | 'toque';
  mensaje: string;
  datos?: Record<string, unknown>;
}

export async function registrarEvento(evento: EventoNuevo): Promise<void> {
  const nivel = evento.nivel ?? 'info';
  // Espejo en el log del servidor: en Vercel se lee ahí incluso si Neon está caído.
  const linea = `[cuaderno:${evento.fase}] ${evento.mensaje}`;
  if (nivel === 'error') console.error(linea);
  else console.log(linea);
  try {
    await db.insert(cuadEventos).values({
      tiradaId: evento.tiradaId ?? null,
      itemId: evento.itemId ?? null,
      nivel,
      fase: evento.fase,
      mensaje: evento.mensaje.slice(0, 2000),
      datos: evento.datos ?? null,
    });
  } catch (error) {
    console.error('[cuaderno] no se pudo guardar el evento:', error instanceof Error ? error.message : error);
  }
}

export async function getEventos(tiradaId: string, limite = 60): Promise<CuadEvento[]> {
  const filas = await db
    .select()
    .from(cuadEventos)
    .where(eq(cuadEventos.tiradaId, tiradaId))
    .orderBy(desc(cuadEventos.createdAt))
    .limit(limite);
  return filas.reverse(); // en el panel se leen de arriba abajo, como un diario
}

/** Un pase del worker sobre la tirada: mueve el latido y suma la vuelta. */
export async function anotarPase(tiradaId: string): Promise<number> {
  const [fila] = await db
    .update(cuadTiradas)
    .set({ latidoAt: new Date(), pases: sql`${cuadTiradas.pases} + 1`, updatedAt: new Date() })
    .where(eq(cuadTiradas.id, tiradaId))
    .returning({ pases: cuadTiradas.pases });
  return fila?.pases ?? 0;
}

/**
 * Devuelve a la cola los ítems que se quedaron en `haciendo`. Pasa de verdad: si la
 * función del worker se agota o se cae en mitad de un documento, el ítem queda reclamado
 * para siempre y la tirada se queda a medias sin nada pendiente que la despierte.
 */
export async function rescatarItemsColgados(tiradaId: string, antiguedadMs = 180_000): Promise<number> {
  const filas = await db
    .update(cuadItems)
    .set({ estado: 'pendiente', updatedAt: new Date() })
    .where(
      and(
        eq(cuadItems.tiradaId, tiradaId),
        eq(cuadItems.estado, 'haciendo'),
        lt(cuadItems.updatedAt, new Date(Date.now() - antiguedadMs)),
      ),
    )
    .returning({ id: cuadItems.id });
  return filas.length;
}

/** Tiradas vivas que llevan mucho sin latir: las que el cron tiene que rescatar. */
export async function tiradasColgadas(antiguedadMs = 300_000): Promise<CuadTirada[]> {
  return db
    .select()
    .from(cuadTiradas)
    .where(
      and(
        inArray(cuadTiradas.estado, ['pendiente', 'ejecutando']),
        lt(cuadTiradas.updatedAt, new Date(Date.now() - antiguedadMs)),
      ),
    )
    .orderBy(asc(cuadTiradas.createdAt))
    .limit(10);
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
