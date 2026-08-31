import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { ensureAbcStudent, getAbcStudentsPanel, getEduStudentByNia } from '@/lib/abc-server';
import { db } from '@/db';
import { abcStudents, eduStudents } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Config del alumnado del ABC: siglas + clase resueltas de la BBDD central (nunca nombres).
export async function GET() {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await getAbcStudentsPanel());
  } catch (error) {
    console.error('Error cargando alumnos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

const altaSchema = z.object({ eduStudentId: z.string().uuid().optional(), nia: z.string().min(1).optional() });

// Alta de un alumno en el módulo: por el alumno elegido en el buscador (eduStudentId) o,
// como respaldo, tecleando su NIA directamente. No se teclean nombres: se sacan de
// edu_students y solo se guardan las siglas.
export async function POST(request: Request) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const parsed = altaSchema.safeParse(await request.json());
    if (!parsed.success || (!parsed.data.eduStudentId && !parsed.data.nia)) {
      return NextResponse.json({ error: 'Falta el alumno' }, { status: 400 });
    }

    const edu = parsed.data.eduStudentId
      ? (await db.select().from(eduStudents).where(eq(eduStudents.id, parsed.data.eduStudentId)).limit(1))[0]
      : await getEduStudentByNia(parsed.data.nia!);
    if (!edu) return NextResponse.json({ error: 'Alumno no encontrado en la BBDD central' }, { status: 404 });

    const student = await ensureAbcStudent(edu);
    // Alta manual desde el panel = alumno de seguimiento: sale en el formulario.
    if (!student.active) {
      await db.update(abcStudents).set({ active: true }).where(eq(abcStudents.id, student.id));
    }
    const panel = (await getAbcStudentsPanel()).find((s) => s.id === student.id);
    return NextResponse.json(panel, { status: 201 });
  } catch (error) {
    console.error('Error creando alumno:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
