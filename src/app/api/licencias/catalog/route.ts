import { NextResponse } from 'next/server';
import { getCatalog, getStudentById } from '@/lib/licencias-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const curso = searchParams.get('curso');
    if (!studentId || !curso) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }
    const student = await getStudentById(studentId);
    if (!student) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });

    const books = await getCatalog(student, curso);
    return NextResponse.json({ books, bancoLibros: student.bancoLibros });
  } catch (error) {
    console.error('Error en catalog:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
