import { NextResponse } from 'next/server';
import { cursoEfectivo } from '@/lib/licencias';
import { getCatalog, getPacks, getStudentById } from '@/lib/licencias-server';

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

    // Si el alumno es PDC (letra='PDC'), forzamos su catálogo PDC aunque haya pulsado otro botón
    const cursoFinal = cursoEfectivo(student.curso, student.letra, curso);
    const [books, packs] = await Promise.all([
      getCatalog(student, cursoFinal),
      getPacks(student.campaignId, cursoFinal),
    ]);
    return NextResponse.json({
      books,
      bancoLibros: student.bancoLibros,
      lenguaBase: student.lenguaBase,
      curso: cursoFinal,
      esPdc: cursoFinal.endsWith('PDC'),
      packs: packs.map((p) => ({ name: p.name, selectionMode: p.selectionMode, bookCods: p.bookCods })),
    });
  } catch (error) {
    console.error('Error en catalog:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
