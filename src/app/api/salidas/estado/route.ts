import { NextResponse } from 'next/server';
import { verifyFamilyStudent } from '@/lib/familias-server';
import { getActiveTripsForStudent } from '@/lib/salidas-server';

// Salidas abiertas del alumno + estado de su justificante. Se revalida SIEMPRE que
// el alumno pertenece al identificador (nunca fiarse del id que manda el cliente).
export async function POST(request: Request) {
  try {
    const { identificador, eduStudentId } = (await request.json()) as {
      identificador?: string;
      eduStudentId?: string;
    };
    if (!identificador?.trim() || !eduStudentId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    const hijo = await verifyFamilyStudent(identificador, eduStudentId);
    if (!hijo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const trips = await getActiveTripsForStudent(eduStudentId);
    return NextResponse.json({ trips });
  } catch (error) {
    console.error('Error en estado de salidas:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
