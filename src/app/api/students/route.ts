import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { ensureAbcStudent, getAbcStudentsPanel, getEduStudentByNia } from '@/lib/abc-server';
import { db } from '@/db';
import { abcStudents } from '@/db/schema';
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

const altaSchema = z.object({ nia: z.string().min(1) });

// Alta de un alumno en el módulo: SIEMPRE por NIA contra la BBDD central. No se teclean
// nombres: se sacan de edu_students y solo se guardan las siglas.
export async function POST(request: Request) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const parsed = altaSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Falta el NIA' }, { status: 400 });

    const edu = await getEduStudentByNia(parsed.data.nia);
    if (!edu) return NextResponse.json({ error: 'No hay ningún alumno con ese NIA en la BBDD central' }, { status: 404 });

    const student = await ensureAbcStudent(edu);
    // Alta manual desde el panel = alumno de seguimiento: destacado en el formulario.
    if (!student.destacado || !student.active) {
      await db.update(abcStudents).set({ destacado: true, active: true }).where(eq(abcStudents.id, student.id));
    }
    const panel = (await getAbcStudentsPanel()).find((s) => s.id === student.id);
    return NextResponse.json(panel, { status: 201 });
  } catch (error) {
    console.error('Error creando alumno:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
