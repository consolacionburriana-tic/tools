// Capa de servidor de Tutorías: gestión rápida de qué profe tutoriza qué clase.
// Muchos-a-muchos a propósito (una clase puede tener varios tutores, un profe puede
// tutorizar varias clases): sin restricción de cardinalidad, la pantalla es la que decide.
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { eduStudents, eduTeachers, eduTutorias, type EduTeacher } from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases } from '@/lib/cursos';

export interface ClaseConTutores {
  curso: string;
  letra: string | null;
  numAlumnos: number;
  tutores: { id: string; teacherId: string; nombre: string }[];
}

const nombreCompleto = (p: Pick<EduTeacher, 'nombre' | 'apellido1' | 'apellido2'>) =>
  [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' ');

/** Todas las clases reales (con alumnado activo) y sus tutores del curso académico actual. */
export async function getClasesConTutores(): Promise<ClaseConTutores[]> {
  const academicYear = academicYearActual();
  const [alumnado, tutorias, profes] = await Promise.all([
    db.select({ curso: eduStudents.curso, letra: eduStudents.letra }).from(eduStudents).where(eq(eduStudents.active, true)),
    db.select().from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
    db.select().from(eduTeachers).where(eq(eduTeachers.active, true)),
  ]);
  const profePorId = new Map(profes.map((p) => [p.id, p]));

  const clases = new Map<string, { curso: string; letra: string | null; numAlumnos: number }>();
  for (const a of alumnado) {
    if (!a.curso) continue;
    const k = `${a.curso}|${a.letra ?? ''}`;
    const c = clases.get(k) ?? { curso: a.curso, letra: a.letra, numAlumnos: 0 };
    c.numAlumnos++;
    clases.set(k, c);
  }

  return [...clases.values()]
    .sort(compararClases)
    .map((c) => ({
      ...c,
      tutores: tutorias
        .filter((t) => t.curso === c.curso && (t.letra ?? '') === (c.letra ?? ''))
        .map((t) => {
          const p = profePorId.get(t.eduTeacherId);
          return { id: t.id, teacherId: t.eduTeacherId, nombre: p ? nombreCompleto(p) : '(profe dado de baja)' };
        }),
    }));
}

/** Asigna un profe como tutor de una clase (no-op si ya lo era). Devuelve el id de la tutoría. */
export async function asignarTutor(curso: string, letra: string | null, teacherId: string): Promise<string> {
  const [row] = await db
    .insert(eduTutorias)
    .values({ curso, letra, eduTeacherId: teacherId, academicYear: academicYearActual() })
    .onConflictDoUpdate({
      target: [eduTutorias.curso, eduTutorias.letra, eduTutorias.eduTeacherId, eduTutorias.academicYear],
      set: { academicYear: academicYearActual() }, // no-op, solo para poder devolver el id existente
    })
    .returning({ id: eduTutorias.id });
  return row.id;
}

/** Quita a un profe de una tutoría. */
export async function quitarTutor(tutoriaId: string): Promise<void> {
  await db.delete(eduTutorias).where(eq(eduTutorias.id, tutoriaId));
}

export { academicYearActual };
