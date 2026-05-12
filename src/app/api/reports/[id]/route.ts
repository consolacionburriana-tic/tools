import { NextResponse } from 'next/server';
import { db } from '@/db';
import { behaviorReports, students, teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [report] = await db
      .select({
        report: behaviorReports,
        student: students,
        teacher: teachers,
      })
      .from(behaviorReports)
      .leftJoin(students, eq(behaviorReports.studentId, students.id))
      .leftJoin(teachers, eq(behaviorReports.teacherId, teachers.id))
      .where(eq(behaviorReports.id, id))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error cargando reporte:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(behaviorReports).where(eq(behaviorReports.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando reporte:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
