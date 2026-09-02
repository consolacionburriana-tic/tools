// Capa de servidor de Tutorías: gestión rápida de qué profe tutoriza qué clase.
// Muchos-a-muchos a propósito (una clase puede tener varios tutores, un profe puede
// tutorizar varias clases): sin restricción de cardinalidad, la pantalla es la que decide.
import { and, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { eduStudents, eduTeachers, eduTutorias, type EduTeacher } from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { planPromocion, resumenPlan } from '@/lib/tutorias';

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

/**
 * Promociona todas las tutorías del curso académico en vigor (ver `cursoSiguiente()` para
 * las reglas). El plan se **recalcula aquí**, no se fía del que ve el cliente, igual que el
 * sync de Educamos. Se hace borrando las tutorías implicadas y reinsertando las que tienen
 * destino, en un único `db.batch` (transacción): así se esquiva que el índice único no
 * deduplique las filas con `letra IS NULL`.
 */
export async function promocionarTutores(): Promise<{ movidas: number; liberadas: number }> {
  const academicYear = academicYearActual();
  const cambios = planPromocion(await getClasesConTutores());
  if (cambios.length === 0) return { movidas: 0, liberadas: 0 };

  const nuevas = cambios
    .filter((c) => c.hasta)
    .map((c) => ({ curso: c.hasta!.curso, letra: c.hasta!.letra, eduTeacherId: c.teacherId, academicYear }));
  // Defensivo: dos tutorías distintas nunca deberían caer en la misma clase con el mismo
  // profe, pero si pasara, el índice único reventaría el batch entero.
  const vistas = new Set<string>();
  const sinDuplicados = nuevas.filter((n) => {
    const k = `${n.curso}|${n.letra ?? ''}|${n.eduTeacherId}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });

  const statements: BatchItem<'pg'>[] = [
    db.delete(eduTutorias).where(inArray(eduTutorias.id, cambios.map((c) => c.tutoriaId))),
  ];
  if (sinDuplicados.length > 0) statements.push(db.insert(eduTutorias).values(sinDuplicados));
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

  return resumenPlan(cambios);
}

/**
 * Borra las tutorías del curso académico en vigor, todas o solo las de una etapa.
 * No toca el histórico de otros años. Ojo: el formulario del ABC usa las tutorías para
 * sugerir destinatarios, así que dejarlo vacío tiene efecto fuera de esta pantalla.
 */
export async function limpiarTutorias(etapa?: Etapa): Promise<number> {
  const academicYear = academicYearActual();
  if (!etapa) {
    const borradas = await db
      .delete(eduTutorias)
      .where(eq(eduTutorias.academicYear, academicYear))
      .returning({ id: eduTutorias.id });
    return borradas.length;
  }
  // `etapa` no es una columna: se deriva del curso, así que filtramos en memoria.
  const filas = await db
    .select({ id: eduTutorias.id, curso: eduTutorias.curso })
    .from(eduTutorias)
    .where(eq(eduTutorias.academicYear, academicYear));
  const ids = filas.filter((f) => etapaDeCurso(f.curso) === etapa).map((f) => f.id);
  if (ids.length === 0) return 0;
  await db.delete(eduTutorias).where(and(eq(eduTutorias.academicYear, academicYear), inArray(eduTutorias.id, ids)));
  return ids.length;
}

export { academicYearActual };
