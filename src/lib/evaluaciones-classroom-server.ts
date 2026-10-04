// Evaluaciones → Classroom · lo que toca Neon (historial de lo publicado y tutorías fijadas a
// mano) y la retirada. Lo puro vive en `evaluaciones-classroom.ts`; la ficha, en
// docs/16-evaluaciones.md.
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { evalClassroomDestinos, evalClassroomPosts } from '@/db/schema';
import { COLEGIO } from '@/lib/colegio';
import { googleConfigurado, retirarPublicacion } from '@/lib/calendarios-google';

/** La cuenta que publica: tiene que ser un USUARIO real (los grupos no se pueden suplantar). */
export function buzonClassroom(): string {
  return (process.env.EVALUACIONES_CLASSROOM_BUZON || COLEGIO.correoTic).trim().toLowerCase();
}

// ── Tutorías fijadas a mano ────────────────────────────────────────────────────

/** `curso|letra` → courseId de Classroom, de este curso escolar. */
export async function destinosFijados(academicYear: string): Promise<Map<string, string>> {
  const filas = await db
    .select({ curso: evalClassroomDestinos.curso, letra: evalClassroomDestinos.letra, courseId: evalClassroomDestinos.courseId })
    .from(evalClassroomDestinos)
    .where(eq(evalClassroomDestinos.academicYear, academicYear));
  return new Map(filas.map((f) => [`${f.curso}|${f.letra}`, f.courseId]));
}

export async function fijarDestino(input: {
  academicYear: string;
  curso: string;
  letra: string | null;
  courseId: string;
  courseNombre: string | null;
  email: string | null;
}): Promise<void> {
  const valores = {
    academicYear: input.academicYear,
    curso: input.curso,
    letra: input.letra ?? '',
    courseId: input.courseId,
    courseNombre: input.courseNombre,
    updatedByEmail: input.email,
    updatedAt: new Date(),
  };
  await db
    .insert(evalClassroomDestinos)
    .values(valores)
    .onConflictDoUpdate({
      target: [evalClassroomDestinos.academicYear, evalClassroomDestinos.curso, evalClassroomDestinos.letra],
      set: { courseId: valores.courseId, courseNombre: valores.courseNombre, updatedByEmail: valores.updatedByEmail, updatedAt: valores.updatedAt },
    });
}

export async function olvidarDestino(academicYear: string, curso: string, letra: string | null): Promise<void> {
  await db
    .delete(evalClassroomDestinos)
    .where(
      and(
        eq(evalClassroomDestinos.academicYear, academicYear),
        eq(evalClassroomDestinos.curso, curso),
        eq(evalClassroomDestinos.letra, letra ?? ''),
      ),
    );
}

// ── Historial de lo publicado ──────────────────────────────────────────────────

export interface PostClassroomVista {
  id: string;
  etiqueta: string;
  courseNombre: string | null;
  tipo: 'tarea' | 'anuncio';
  enlace: string | null;
  titulo: string;
  programadoPara: Date | null;
  createdAt: Date;
  retiradoAt: Date | null;
  /** Se puede retirar desde la app (tiene el id de Classroom y no está ya retirada). */
  retirable: boolean;
}

export async function postsDeForm(formId: string): Promise<(PostClassroomVista & { courseId: string })[]> {
  const filas = await db
    .select()
    .from(evalClassroomPosts)
    .where(eq(evalClassroomPosts.formId, formId))
    .orderBy(desc(evalClassroomPosts.createdAt))
    .limit(100);
  return filas.map((f) => ({
    id: f.id,
    courseId: f.courseId,
    etiqueta: f.etiqueta,
    courseNombre: f.courseNombre,
    tipo: f.tipo as 'tarea' | 'anuncio',
    enlace: f.enlace,
    titulo: f.titulo,
    programadoPara: f.programadoPara,
    createdAt: f.createdAt,
    retiradoAt: f.retiradoAt,
    retirable: !f.retiradoAt && !!f.postId,
  }));
}

export async function registrarPost(input: {
  formId: string;
  etiqueta: string;
  courseId: string;
  courseNombre: string | null;
  tipo: 'tarea' | 'anuncio';
  postId: string | null;
  enlace: string | null;
  titulo: string;
  programadoPara: Date | null;
  createdByEmail: string | null;
}): Promise<void> {
  await db.insert(evalClassroomPosts).values(input);
}

export interface ResultadoRetirada {
  id: string;
  etiqueta: string;
  ok: boolean;
  mensaje: string;
}

/**
 * Retira de Classroom lo publicado (todo lo activo del formulario, o solo `ids`) y lo marca como
 * retirado. Si Classroom dice que ya no existe, también se marca: el objetivo es que no quede.
 */
export async function retirarPosts(formIds: string[], quien: string | null, ids: string[] | null = null): Promise<ResultadoRetirada[]> {
  if (formIds.length === 0) return [];
  const filas = await db
    .select()
    .from(evalClassroomPosts)
    .where(
      and(
        inArray(evalClassroomPosts.formId, formIds),
        isNull(evalClassroomPosts.retiradoAt),
        ids ? inArray(evalClassroomPosts.id, ids) : undefined,
      ),
    );
  const buzon = buzonClassroom();
  const out: ResultadoRetirada[] = [];
  for (const f of filas) {
    if (!f.postId) {
      out.push({ id: f.id, etiqueta: f.etiqueta, ok: false, mensaje: 'No tiene id de Classroom: se quita desde la propia clase' });
      continue;
    }
    const r = await retirarPublicacion(buzon, f.courseId, f.tipo as 'tarea' | 'anuncio', f.postId);
    if (!r.ok) {
      out.push({ id: f.id, etiqueta: f.etiqueta, ok: false, mensaje: r.error });
      continue;
    }
    await db.update(evalClassroomPosts).set({ retiradoAt: new Date(), retiradoPor: quien }).where(eq(evalClassroomPosts.id, f.id));
    out.push({ id: f.id, etiqueta: f.etiqueta, ok: true, mensaje: r.yaNoExistia ? 'Ya no estaba en Classroom' : 'Retirada de Classroom' });
  }
  return out;
}

/**
 * Para antes de borrar una evaluación: lo publicado en Classroom llevaría a un enlace muerto.
 * Se intenta retirarlo, y si no se puede (Google sin configurar, sin permiso…) no impide borrar.
 */
export async function retirarPostsAntesDeBorrar(formIds: string[]): Promise<void> {
  if (!googleConfigurado()) return;
  try {
    await retirarPosts(formIds, 'borrado de la evaluación');
  } catch (e) {
    console.error('Evaluaciones: no se pudo retirar lo publicado en Classroom:', e instanceof Error ? e.message : e);
  }
}
